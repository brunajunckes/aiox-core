"""
Enhanced output validation — ensures outputs meet quality standards
"""
from dataclasses import dataclass
from typing import Tuple, Optional

@dataclass
class ValidationResult:
    valid: bool
    feedback: str = ""
    retry_prompt: str = ""
    score: float = 0.0  # 0-10

# ─────────────────────────────────────────────────────────────────────────────
# SEO Output Validation
# ─────────────────────────────────────────────────────────────────────────────

def validate_seo_output(output: dict) -> ValidationResult:
    """Validate SEO workflow output."""
    issues = []

    # Check title
    title = output.get("title", "")
    if not title:
        issues.append("Missing title")
    elif len(title) < 10:
        issues.append(f"Title too short ({len(title)} chars, need 10+)")
    elif len(title) > 70:
        issues.append(f"Title too long ({len(title)} chars, max 70)")

    # Check meta_description
    meta = output.get("meta_description", "")
    if not meta:
        issues.append("Missing meta_description")
    elif len(meta) < 50:
        issues.append(f"Meta too short ({len(meta)} chars, need 50+)")
    elif len(meta) > 160:
        issues.append(f"Meta too long ({len(meta)} chars, max 160)")

    # Check keywords
    keywords = output.get("keywords", [])
    if not isinstance(keywords, list):
        issues.append("Keywords not a list")
    elif len(keywords) < 3:
        issues.append(f"Too few keywords ({len(keywords)}, need 3+)")

    # Check body
    body = output.get("body", "")
    if not body:
        issues.append("Missing body content")
    elif len(body) < 300:
        issues.append(f"Body too short ({len(body)} chars, need 300+)")

    if issues:
        return ValidationResult(
            valid=False,
            feedback="; ".join(issues),
            retry_prompt=f"Fix these issues: {', '.join(issues)}",
            score=max(0, 10 - len(issues) * 2),
        )

    return ValidationResult(valid=True, score=9.0)


# ─────────────────────────────────────────────────────────────────────────────
# Research Output Validation
# ─────────────────────────────────────────────────────────────────────────────

def validate_research_output(output: dict) -> ValidationResult:
    """Validate Research workflow output."""
    issues = []

    # Check title
    title = output.get("title", "")
    if not title:
        issues.append("Missing title")
    elif len(title) < 10:
        issues.append(f"Title too short ({len(title)} chars, need 10+)")

    # Check summary
    summary = output.get("summary", "")
    if not summary:
        issues.append("Missing summary")
    elif len(summary) < 100:
        issues.append(f"Summary too short ({len(summary)} chars, need 100+)")

    # Check findings
    findings = output.get("findings", [])
    if not isinstance(findings, list):
        issues.append("Findings not a list")
    elif len(findings) < 3:
        issues.append(f"Too few findings ({len(findings)}, need 3+)")

    if issues:
        return ValidationResult(
            valid=False,
            feedback="; ".join(issues),
            retry_prompt=f"Fix: {', '.join(issues)}",
            score=max(0, 10 - len(issues) * 2),
        )

    return ValidationResult(valid=True, score=9.0)


# ─────────────────────────────────────────────────────────────────────────────
# Video Output Validation
# ─────────────────────────────────────────────────────────────────────────────

def validate_video_output(output: dict) -> ValidationResult:
    """Validate Video workflow output."""
    issues = []

    # Check script
    script = output.get("script", "")
    if not script:
        issues.append("Missing script")
    elif len(script) < 50:
        issues.append(f"Script too short ({len(script)} chars, need 50+)")

    # Check duration
    duration = output.get("duration_seconds")
    if not duration:
        issues.append("Missing duration_seconds")
    elif not isinstance(duration, int):
        issues.append(f"Duration not int: {type(duration)}")
    elif duration < 15 or duration > 600:
        issues.append(f"Duration out of range ({duration}s, need 15-600)")

    # Check voice
    voice = output.get("voice", "")
    if not voice:
        issues.append("Missing voice")

    # Check style
    style = output.get("style", "")
    if not style:
        issues.append("Missing style")

    # Check scenes
    scenes = output.get("scenes", [])
    if not isinstance(scenes, list):
        issues.append("Scenes not a list")
    elif len(scenes) < 1:
        issues.append("No scenes defined")

    if issues:
        return ValidationResult(
            valid=False,
            feedback="; ".join(issues),
            retry_prompt=f"Fix: {', '.join(issues)}",
            score=max(0, 10 - len(issues) * 2),
        )

    return ValidationResult(valid=True, score=9.0)


# ─────────────────────────────────────────────────────────────────────────────
# Main validator
# ─────────────────────────────────────────────────────────────────────────────

def validate_output(output: dict, output_type: str) -> ValidationResult:
    """Validate output based on workflow type."""
    if output_type == "seo":
        return validate_seo_output(output)
    elif output_type == "research":
        return validate_research_output(output)
    elif output_type == "video":
        return validate_video_output(output)
    else:
        return ValidationResult(valid=True, score=5.0)  # Unknown type, pass
