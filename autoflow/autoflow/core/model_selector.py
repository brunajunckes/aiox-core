"""
Intelligent Model Selection Engine
===================================

Routes tasks to optimal Ollama models based on:
1. Task complexity (SIMPLE, STANDARD, COMPLEX)
2. Task category (research, code-generation, content-creation, etc.)
3. Model availability and performance metrics
4. Load balancing across multiple instances

Strategy:
- SIMPLE tasks → qwen2.5:3b (fast, cheap, 80% accuracy)
- STANDARD tasks → qwen2.5:7b (balanced, 85% accuracy)
- COMPLEX tasks → gemma2:9b or mistral:7b (better reasoning, 90%+ accuracy)
"""
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Dict, List
import logging

log = logging.getLogger("model-selector")


class TaskComplexity(Enum):
    """Task complexity levels for routing."""
    SIMPLE = "SIMPLE"           # 0-3 points
    STANDARD = "STANDARD"       # 4-8 points
    COMPLEX = "COMPLEX"         # 9-15 points


class ModelSize(Enum):
    """Model size/capability tiers."""
    TINY = "tiny"               # qwen2.5:3b
    SMALL = "small"             # qwen2.5:7b
    MEDIUM = "medium"           # gemma2:7b
    LARGE = "large"             # gemma2:9b, mistral:7b
    XLARGE = "xlarge"           # Future: larger models


@dataclass
class ModelProfile:
    """Model capabilities and metadata."""
    name: str                    # e.g., "qwen2.5:7b"
    size: ModelSize
    speed_score: float           # 1-10 (higher = faster)
    quality_score: float         # 1-10 (higher = better output)
    reasoning_score: float       # 1-10 (ability to reason through complex tasks)
    cost_per_1k_tokens: float    # USD (always 0 for Ollama)
    max_tokens: int              # Maximum context
    supports_system_prompt: bool
    available: bool = True
    current_load: float = 0.0    # 0.0-1.0 (load percentage)


# Model Registry - Ollama models
MODELS: Dict[str, ModelProfile] = {
    "qwen2.5:3b": ModelProfile(
        name="qwen2.5:3b",
        size=ModelSize.TINY,
        speed_score=9.5,
        quality_score=7.0,
        reasoning_score=5.0,
        cost_per_1k_tokens=0.0,
        max_tokens=2048,
        supports_system_prompt=True,
    ),
    "qwen2.5:7b": ModelProfile(
        name="qwen2.5:7b",
        size=ModelSize.SMALL,
        speed_score=8.0,
        quality_score=7.5,
        reasoning_score=6.0,
        cost_per_1k_tokens=0.0,
        max_tokens=4096,
        supports_system_prompt=True,
    ),
    "gemma2:7b": ModelProfile(
        name="gemma2:7b",
        size=ModelSize.MEDIUM,
        speed_score=7.5,
        quality_score=8.0,
        reasoning_score=7.5,
        cost_per_1k_tokens=0.0,
        max_tokens=8192,
        supports_system_prompt=True,
    ),
    "gemma2:9b": ModelProfile(
        name="gemma2:9b",
        size=ModelSize.LARGE,
        speed_score=6.5,
        quality_score=9.0,
        reasoning_score=9.0,
        cost_per_1k_tokens=0.0,
        max_tokens=8192,
        supports_system_prompt=True,
    ),
    "mistral:7b": ModelProfile(
        name="mistral:7b",
        size=ModelSize.LARGE,
        speed_score=7.0,
        quality_score=8.5,
        reasoning_score=8.5,
        cost_per_1k_tokens=0.0,
        max_tokens=4096,
        supports_system_prompt=True,
    ),
}


class ModelSelector:
    """Intelligently select optimal model for task."""

    def __init__(self):
        self.models = MODELS
        self.selection_history: List[Dict] = []

    def select_model(
        self,
        complexity: TaskComplexity,
        category_hint: Optional[str] = None,
        prefer_speed: bool = False,
        prefer_quality: bool = False,
    ) -> str:
        """
        Select optimal model for task.

        Args:
            complexity: Task complexity level
            category_hint: Task category (research, code-generation, etc.)
            prefer_speed: Prioritize fast execution
            prefer_quality: Prioritize output quality

        Returns:
            Model name (e.g., "qwen2.5:7b")
        """
        # Default routing by complexity
        if complexity == TaskComplexity.SIMPLE:
            candidates = ["qwen2.5:3b"]
        elif complexity == TaskComplexity.STANDARD:
            candidates = ["qwen2.5:7b", "gemma2:7b"]
        else:  # COMPLEX
            candidates = ["gemma2:9b", "mistral:7b"]

        # Refine by category if provided
        if category_hint:
            candidates = self._filter_by_category(candidates, category_hint)

        # Score candidates
        scored = []
        for model_name in candidates:
            if model_name not in self.models:
                continue

            model = self.models[model_name]
            if not model.available:
                continue

            score = self._score_model(
                model,
                prefer_speed=prefer_speed,
                prefer_quality=prefer_quality,
                load=model.current_load,
            )
            scored.append((model_name, score))

        if not scored:
            # Fallback to qwen2.5:7b (always available)
            log.warning(f"No suitable model found for {complexity}. Falling back to qwen2.5:7b")
            return "qwen2.5:7b"

        # Sort by score (highest first) and load (lowest first)
        scored.sort(key=lambda x: (-x[1], self.models[x[0]].current_load))
        selected = scored[0][0]

        log.info(f"[MODEL SELECT] {complexity.value} task → {selected} (score: {scored[0][1]:.1f})")

        return selected

    def _filter_by_category(self, candidates: List[str], category: str) -> List[str]:
        """Filter models by task category."""
        if category == "code-generation":
            # Mistral is better for code
            if "mistral:7b" in candidates:
                return ["mistral:7b"] + [c for c in candidates if c != "mistral:7b"]
        elif category == "research":
            # Gemma is good for research
            if "gemma2:9b" in candidates:
                return ["gemma2:9b"] + [c for c in candidates if c != "gemma2:9b"]

        return candidates

    def _score_model(
        self,
        model: ModelProfile,
        prefer_speed: bool = False,
        prefer_quality: bool = False,
        load: float = 0.0,
    ) -> float:
        """Score a model for selection."""
        score = 0.0

        if prefer_speed:
            score += model.speed_score * 0.6
            score += model.quality_score * 0.4
        elif prefer_quality:
            score += model.quality_score * 0.6
            score += model.speed_score * 0.4
        else:
            # Balanced
            score += (model.quality_score + model.reasoning_score) / 2 * 0.5
            score += model.speed_score * 0.3
            score += (10 - load * 10) * 0.2  # Load penalty

        return score

    def update_load(self, model_name: str, load: float) -> None:
        """Update current load for a model."""
        if model_name in self.models:
            self.models[model_name].current_load = max(0.0, min(1.0, load))

    def get_models_by_complexity(self) -> Dict[TaskComplexity, List[str]]:
        """Get available models grouped by recommended complexity."""
        return {
            TaskComplexity.SIMPLE: [
                name for name, m in self.models.items()
                if m.available and m.size == ModelSize.TINY
            ],
            TaskComplexity.STANDARD: [
                name for name, m in self.models.items()
                if m.available and m.size in (ModelSize.SMALL, ModelSize.MEDIUM)
            ],
            TaskComplexity.COMPLEX: [
                name for name, m in self.models.items()
                if m.available and m.size in (ModelSize.LARGE, ModelSize.XLARGE)
            ],
        }


# Global instance
_selector: Optional[ModelSelector] = None


def get_model_selector() -> ModelSelector:
    """Get or create global model selector."""
    global _selector
    if _selector is None:
        _selector = ModelSelector()
    return _selector
