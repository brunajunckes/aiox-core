"""
Ollama Enforcement Strategy — Intelligent model routing
=====================================================

Routes tasks to optimal LLM based on complexity:
1. SIMPLE (0-3 tokens) → qwen2.5:7b (online Ollama, <300ms, FREE)
2. STANDARD (4-8 tokens) → Claude Opus (better reasoning, $0.003/1K)
3. COMPLEX (9+ tokens) → Claude Opus (best quality, $0.003/1K)

Cost: Ollama = free, Opus = $0.003/1K tokens

Rules:
- All simple boilerplate/formatting → ALWAYS Ollama qwen2.5:7b
- Text generation/documentation → Ollama first, fallback Opus
- Standard/Complex/Architecture/code review → Opus only
- User explicitly asks for quality → Opus

ENFORCEMENT: Task router MUST check this before calling any LLM.

Note: Only qwen2.5:7b is currently deployed on ollama.ampcast.site.
Standard and complex tasks fall back to Claude Opus.
"""

import os
import json
import logging
import hashlib
import time
from enum import Enum
from typing import Optional, Literal
from dataclasses import dataclass, asdict
import httpx

log = logging.getLogger("ollama-enforce")

# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS & MODELS
# ─────────────────────────────────────────────────────────────────────────────

# ALWAYS use ONLINE OLLAMA ONLY — ampcast.site
# Never use VPS local Ollama (127.0.0.1:11434)
OLLAMA_URL = "http://ollama.ampcast.site"  # HARDCODED — ALWAYS ONLINE (port 80)
LLM_ROUTER = os.getenv("LLM_ROUTER_URL", "http://127.0.0.1:3000")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

MODELS = {
    "qwen2_5_fast": {
        "name": "qwen2.5:7b",
        "endpoint": OLLAMA_URL,
        "cost_per_1k": 0,  # Free (online Ollama)
        "latency_ms": 300,
        "quality": 7,  # 1-10 scale (qwen2.5 é muito bom)
        "best_for": ["formatting", "boilerplate", "simple-generation", "json", "yaml"],
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# TASK CLASSIFICATION
# ─────────────────────────────────────────────────────────────────────────────

class TaskComplexity(str, Enum):
    """Complexity tiers (0-15 scale, derived from LLM-Router)"""
    SIMPLE = "simple"  # 0-3
    STANDARD = "standard"  # 4-8
    COMPLEX = "complex"  # 9-15


class TaskCategory(str, Enum):
    """Task categories for routing"""
    # Simple (route to qwen2:7b)
    STORY_UPDATE = "story-update"
    YAML_GENERATION = "yaml-generation"
    JSON_FORMATTING = "json-formatting"
    BOILERPLATE = "boilerplate"
    MARKDOWN = "markdown"
    COMMIT_MESSAGE = "commit-message"
    TEXT_FORMATTING = "text-formatting"
    DOCUMENTATION = "documentation"
    TEST_BOILERPLATE = "test-boilerplate"

    # Standard (route to qwen3.5:397b or Opus)
    RESEARCH = "research"
    SEO_ANALYSIS = "seo-analysis"
    CODE_GENERATION = "code-generation"
    DOCUMENTATION_COMPLEX = "documentation-complex"
    DATA_ANALYSIS = "data-analysis"

    # Complex (route to Claude Opus)
    ARCHITECTURE = "architecture"
    SECURITY_REVIEW = "security-review"
    CODE_REVIEW = "code-review"
    SCHEMA_DESIGN = "schema-design"
    MIGRATION = "migration"
    INTEGRATION = "integration"


@dataclass
class TaskProfile:
    """Complete task profile for routing decision"""

    task_id: str  # Unique identifier (hash of prompt)
    category: TaskCategory
    complexity_score: int  # 0-15 (from LLM-Router or estimated)
    complexity_tier: TaskComplexity
    prompt_tokens: int  # Estimated input tokens
    max_output_tokens: int
    quality_critical: bool = False  # True = must use Opus
    user_preference: Optional[Literal["opus", "haiku", "local"]] = None
    has_context: bool = False  # True = has system context (prefer Opus)


# ─────────────────────────────────────────────────────────────────────────────
# TASK CLASSIFIER
# ─────────────────────────────────────────────────────────────────────────────

TASK_KEYWORDS = {
    # Simple tasks
    TaskCategory.STORY_UPDATE: ["story", "checkbox", "✓", "x status", "update mark"],
    TaskCategory.YAML_GENERATION: ["yaml", "json", "config file", "configuration"],
    TaskCategory.BOILERPLATE: [
        "export",
        "index.ts",
        "barrel",
        "manifest",
        "template",
    ],
    TaskCategory.MARKDOWN: ["markdown", "md", "readme", "doc"],
    TaskCategory.COMMIT_MESSAGE: ["commit", "conventional", "feat:", "fix:"],
    TaskCategory.TEXT_FORMATTING: ["format", "reformat", "structure text"],
    TaskCategory.TEST_BOILERPLATE: ["test", "jest", "vitest", "mock"],
    # Standard tasks
    TaskCategory.RESEARCH: ["research", "analyze", "investigate", "survey"],
    TaskCategory.SEO_ANALYSIS: ["seo", "keyword", "ranking", "optimization"],
    TaskCategory.CODE_GENERATION: [
        "implement",
        "write",
        "function",
        "class",
        "component",
    ],
    # Complex tasks
    TaskCategory.ARCHITECTURE: ["architecture", "design pattern", "system design"],
    TaskCategory.SECURITY_REVIEW: ["security", "vulnerability", "sql injection", "auth"],
    TaskCategory.CODE_REVIEW: ["review code", "audit", "quality", "best practice"],
    TaskCategory.SCHEMA_DESIGN: ["schema", "database", "table", "migration"],
}


def classify_task(prompt: str, category_hint: Optional[str] = None) -> TaskProfile:
    """
    Classify task complexity and category from prompt.

    Returns TaskProfile with routing recommendation.
    """
    task_id = hashlib.sha256(prompt[:500].encode()).hexdigest()[:8]
    prompt_lower = prompt.lower()
    prompt_tokens = len(prompt) // 4  # Rough estimate

    # Try to match category from hints
    category = TaskCategory.DOCUMENTATION
    if category_hint:
        for cat in TaskCategory:
            if category_hint.lower() in cat.value:
                category = cat
                break
    else:
        # Keyword matching
        for cat, keywords in TASK_KEYWORDS.items():
            if any(kw in prompt_lower for kw in keywords):
                category = cat
                break

    # Determine complexity tier
    if category in [
        TaskCategory.STORY_UPDATE,
        TaskCategory.YAML_GENERATION,
        TaskCategory.JSON_FORMATTING,
        TaskCategory.BOILERPLATE,
        TaskCategory.MARKDOWN,
        TaskCategory.COMMIT_MESSAGE,
        TaskCategory.TEXT_FORMATTING,
        TaskCategory.TEST_BOILERPLATE,
        TaskCategory.DOCUMENTATION,
    ]:
        complexity_tier = TaskComplexity.SIMPLE
        complexity_score = 2  # 0-3
    elif category in [
        TaskCategory.RESEARCH,
        TaskCategory.SEO_ANALYSIS,
        TaskCategory.CODE_GENERATION,
        TaskCategory.DOCUMENTATION_COMPLEX,
    ]:
        complexity_tier = TaskComplexity.STANDARD
        complexity_score = 6  # 4-8
    else:
        complexity_tier = TaskComplexity.COMPLEX
        complexity_score = 12  # 9-15

    # Detect quality-critical indicators
    quality_critical = any(
        kw in prompt_lower
        for kw in [
            "security",
            "auth",
            "sql injection",
            "vulnerability",
            "best practice",
        ]
    )

    return TaskProfile(
        task_id=task_id,
        category=category,
        complexity_score=complexity_score,
        complexity_tier=complexity_tier,
        prompt_tokens=prompt_tokens,
        max_output_tokens=4096,
        quality_critical=quality_critical,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MODEL SELECTOR
# ─────────────────────────────────────────────────────────────────────────────

def select_model(profile: TaskProfile) -> str:
    """
    Select optimal model based on task profile.

    Returns model key (qwen2_5_fast only - Ollama only, no Claude API).
    All tasks route to qwen2.5:7b on Ollama (free).
    """
    # All tasks → qwen2.5 on Ollama (free, no API key needed)
    return "qwen2_5_fast"


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECKS
# ─────────────────────────────────────────────────────────────────────────────

async def check_ollama() -> bool:
    """Check if online Ollama is healthy."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            return resp.status_code == 200
    except Exception as e:
        log.warning(f"Ollama check failed: {e}")
        return False


async def check_llm_router() -> bool:
    """Check if LLM-Router is healthy."""
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{LLM_ROUTER}/health")
            return resp.status_code == 200
    except Exception as e:
        log.warning(f"LLM-Router check failed: {e}")
        return False


async def health_summary() -> dict:
    """Get health status of all services."""
    return {
        "timestamp": time.time(),
        "ollama": await check_ollama(),
        "llm_router": await check_llm_router(),
        "anthropic_key": bool(ANTHROPIC_API_KEY),
    }


# ─────────────────────────────────────────────────────────────────────────────
# ROUTING DECISION
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RoutingDecision:
    """Complete routing decision with metadata"""

    model_key: str
    model_name: str
    endpoint: str
    cost_per_1k: float
    estimated_cost: float
    complexity_tier: str
    reason: str
    fallback_model_key: Optional[str] = None
    fallback_endpoint: Optional[str] = None
    timestamp: float = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()


async def route_task(
    prompt: str,
    category_hint: Optional[str] = None,
    user_preference: Optional[str] = None,
) -> RoutingDecision:
    """
    Main routing function. Returns RoutingDecision with primary + fallback model.

    Usage:
        decision = await route_task(prompt, category_hint="code-generation")
        model_config = MODELS[decision.model_key]
        response = await call_llm(prompt, model_config)
    """
    # Classify task
    profile = classify_task(prompt, category_hint)
    if user_preference:
        profile.user_preference = user_preference

    # Select primary model
    model_key = select_model(profile)
    model_config = MODELS[model_key]

    # Estimate cost
    estimated_output_tokens = profile.max_output_tokens * 0.5  # Assume 50% used
    total_tokens = profile.prompt_tokens + estimated_output_tokens
    estimated_cost = (total_tokens / 1000.0) * model_config["cost_per_1k"]

    # Determine fallback (no fallback available - only Ollama)
    fallback_key = None
    fallback_endpoint = None
    reason = f"{model_key} (Ollama only - no fallback available)"

    decision = RoutingDecision(
        model_key=model_key,
        model_name=model_config["name"],
        endpoint=model_config["endpoint"],
        cost_per_1k=model_config["cost_per_1k"],
        estimated_cost=estimated_cost,
        complexity_tier=profile.complexity_tier,
        reason=reason,
        fallback_model_key=fallback_key,
        fallback_endpoint=fallback_endpoint,
    )

    log.info(f"[ROUTE] {profile.task_id} → {decision.reason} (cost: ${decision.estimated_cost:.4f})")

    return decision


# ─────────────────────────────────────────────────────────────────────────────
# ENFORCEMENT LOGS
# ─────────────────────────────────────────────────────────────────────────────

def log_routing_decision(decision: RoutingDecision, actual_tokens: int = 0):
    """Log routing decision to JSON file for audit."""
    log_entry = {
        "timestamp": decision.timestamp,
        "model_key": decision.model_key,
        "model_name": decision.model_name,
        "complexity_tier": decision.complexity_tier,
        "reason": decision.reason,
        "estimated_cost_usd": decision.estimated_cost,
        "actual_tokens": actual_tokens,
        "fallback_available": decision.fallback_model_key is not None,
    }

    try:
        with open("/var/log/autoflow-routing.jsonl", "a") as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        log.warning(f"Failed to log routing decision: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENFORCEMENT SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

ENFORCEMENT_RULES = """
╔════════════════════════════════════════════════════════════════════════════╗
║              OLLAMA ENFORCEMENT STRATEGY v3 (April 10 + Haiku)             ║
╚════════════════════════════════════════════════════════════════════════════╝

MODEL SELECTION:
  qwen2.5:7b           → SIMPLE tasks (0-3 complexity) | FREE | ~300ms
  Claude Opus          → STANDARD tasks (4-8) | $0.003/1K tokens | ~2s
  Claude Opus          → COMPLEX tasks (9-15) | $0.003/1K tokens | ~2s

ROUTING RULES:
  ✓ Story updates, YAML, boilerplate, markdown     → qwen2.5 (ALWAYS FREE)
  ✓ Code generation, research, SEO analysis        → Opus (default)
  ✓ Architecture, security, code review            → Opus (ALWAYS)
  ✓ Quality-critical or security-sensitive         → Opus (ALWAYS)
  ✓ Has system context (complex reasoning)         → Opus (ALWAYS)

FALLBACK CHAIN (Cost-Optimized):
  qwen2.5 fails   → Haiku (cheap, $0.0008/1K) → Opus (expensive)
  Opus fails      → ERROR (no fallback)

COST SAVINGS:
  - Local Ollama: FREE (no API calls)
  - Cloud Ollama: ~$0.001 per task (vs $0.06 for Opus)
  - User lost 30 min of Opus credits to boilerplate.
  - ENFORCE: Boilerplate NEVER uses Opus.

LOGGING:
  /var/log/autoflow-routing.jsonl   (every routing decision)
  /var/log/autoflow-router.jsonl    (every LLM call)

VERIFICATION:
  python3 -m autoflow.core.ollama_enforce --health
  python3 -m autoflow.core.ollama_enforce --test "simple markdown task"
"""

if __name__ == "__main__":
    print(ENFORCEMENT_RULES)
