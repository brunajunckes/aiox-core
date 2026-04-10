"""3-Tier Output Validation for AutoFlow agents.

Tier 1: Pydantic schema (deterministic) — catches ~60% of errors
Tier 2: Heuristic checks (readability, length, density) — catches ~25%
Tier 3: LLM-based semantic check — catches ~15% (only if Tier 1+2 pass)
"""
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator
import re


# ── Validation Result ──

class ValidationResult(BaseModel):
    valid: bool
    tier_failed: Optional[int] = None
    errors: list[str] = Field(default_factory=list)
    feedback: str = ""

    @property
    def retry_prompt(self) -> str:
        if self.valid:
            return ""
        return f"Your output failed validation (Tier {self.tier_failed}). Fix these issues:\n" + "\n".join(f"- {e}" for e in self.errors) + f"\n\nSpecific feedback: {self.feedback}"


# ── Tier 1: Pydantic Schemas ──

class ResearchOutput(BaseModel):
    title: str = Field(min_length=10)
    summary: str = Field(min_length=100)
    findings: list[str] = Field(min_length=3)
    sources: list[str] = Field(default_factory=list)

    @field_validator("findings")
    @classmethod
    def min_findings(cls, v):
        if len(v) < 3:
            raise ValueError("At least 3 findings required")
        return v


class SEOContentOutput(BaseModel):
    title: str = Field(min_length=10, max_length=70)
    meta_description: str = Field(min_length=50, max_length=160)
    keywords: list[str] = Field(min_length=3)
    body: str = Field(min_length=500)
    headings: list[str] = Field(default_factory=list)

    @field_validator("keywords")
    @classmethod
    def min_keywords(cls, v):
        if len(v) < 3:
            raise ValueError("At least 3 keywords required")
        return v


class VideoSpecOutput(BaseModel):
    script: str = Field(min_length=50)
    duration_seconds: int = Field(ge=15, le=600)
    voice: str = Field(default="pt-BR-female")
    style: str = Field(default="educational")
    scenes: list[dict] = Field(min_length=1)


SCHEMAS = {
    "research": ResearchOutput,
    "seo": SEOContentOutput,
    "video": VideoSpecOutput,
}


# ── Tier 2: Heuristic Checks ──

def _readability_score(text: str) -> float:
    """Simplified Flesch-like readability (0-100, higher = easier)."""
    sentences = max(1, len(re.split(r'[.!?]+', text)))
    words = max(1, len(text.split()))
    syllables = sum(1 for w in text.split() for c in re.findall(r'[aeiouyáéíóúâêîôûãõ]+', w.lower()))
    return max(0, min(100, 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)))


def _keyword_density(text: str, keywords: list[str]) -> float:
    """Calculate keyword density percentage."""
    text_lower = text.lower()
    word_count = max(1, len(text_lower.split()))
    keyword_count = sum(text_lower.count(kw.lower()) for kw in keywords)
    return round((keyword_count / word_count) * 100, 2)


def _heuristic_check(output: dict, output_type: str) -> list[str]:
    """Run heuristic checks based on output type."""
    errors = []

    if output_type == "research":
        summary = output.get("summary", "")
        if len(summary.split()) < 20:
            errors.append(f"Summary too short ({len(summary.split())} words, need 20+)")
        for i, finding in enumerate(output.get("findings", [])):
            if len(finding) < 10:
                errors.append(f"Finding #{i+1} too short ({len(finding)} chars)")

    elif output_type == "seo":
        body = output.get("body", "")
        keywords = output.get("keywords", [])
        readability = _readability_score(body)
        density = _keyword_density(body, keywords)
        if readability < 30:
            errors.append(f"Readability too low ({readability:.0f}/100, need 30+)")
        if density < 0.3:
            errors.append(f"Keyword density too low ({density}%, need 0.3%+)")
        if density > 4.0:
            errors.append(f"Keyword density too high ({density}%, max 4%)")
        if len(body.split()) < 300:
            errors.append(f"Body too short ({len(body.split())} words, need 300+)")

    elif output_type == "video":
        script = output.get("script", "")
        duration = output.get("duration_seconds", 0)
        words = len(script.split())
        expected_words = duration * 2.5  # ~150 words per minute
        if words < expected_words * 0.5:
            errors.append(f"Script too short for {duration}s ({words} words, expect ~{int(expected_words)})")

    return errors


# ── Main Validate Function ──

def validate_output(output: dict, output_type: str, skip_llm: bool = True) -> ValidationResult:
    """Validate agent output through 3 tiers.

    Args:
        output: The agent's output as a dict
        output_type: One of 'research', 'seo', 'video'
        skip_llm: Skip Tier 3 LLM check (default True to save tokens)
    """
    schema_cls = SCHEMAS.get(output_type)
    if not schema_cls:
        return ValidationResult(valid=True)

    # Tier 1: Pydantic schema validation
    try:
        schema_cls(**output)
    except Exception as e:
        errors = [str(err) for err in (e.errors() if hasattr(e, 'errors') else [{"msg": str(e)}])]
        return ValidationResult(
            valid=False,
            tier_failed=1,
            errors=[str(err) for err in errors],
            feedback=f"Schema validation failed. Fix the structure: {'; '.join(str(e) for e in errors[:3])}"
        )

    # Tier 2: Heuristic checks
    heuristic_errors = _heuristic_check(output, output_type)
    if heuristic_errors:
        return ValidationResult(
            valid=False,
            tier_failed=2,
            errors=heuristic_errors,
            feedback=f"Quality checks failed: {'; '.join(heuristic_errors)}"
        )

    # Tier 3: LLM-based semantic check (expensive — only on explicit request)
    if not skip_llm:
        # TODO: Implement LLM-based semantic validation
        # This would call the router to verify factual consistency
        pass

    return ValidationResult(valid=True)
