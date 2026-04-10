"""
Task Router — Unified entry point for all LLM calls
====================================================

Integrates:
1. Ollama Enforcement (ALWAYS prefer Ollama for simple tasks)
2. Complexity-based routing (via LLM-Router or estimation)
3. Automatic retry with validation
4. Cost tracking & logging
"""

import os
import json
import logging
import asyncio
from typing import Optional
import httpx

from .ollama_enforce import (
    route_task,
    log_routing_decision,
    MODELS,
    TaskComplexity,
)
from .router import call_llm_sync
from .validator_enhanced import validate_output

log = logging.getLogger("task-router")


class TaskRouter:
    """
    High-level router that combines:
    - Ollama enforcement (routing decisions)
    - LLM provider calls (actual execution)
    - Output validation & automatic retry
    - Cost tracking & logging
    """

    def __init__(self):
        self.call_count = 0
        self.total_cost = 0.0
        self.cost_log = "/var/log/autoflow-tasks.jsonl"
        self.max_retries = 2  # Max 2 retries (3 attempts total)

    async def route_and_call(
        self,
        prompt: str,
        system: str = "",
        category_hint: Optional[str] = None,
        user_preference: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        output_type: Optional[str] = None,  # For validation: "seo", "research", "video"
    ) -> str:
        """
        Main entry point: route task and execute on optimal provider.

        Automatically retries on network errors or validation failures.
        Temperature increases on retry: 0.7 → 0.85 → 1.0

        Args:
            prompt: User/system prompt
            system: System context
            category_hint: Task category hint (e.g., "json-formatting")
            user_preference: Force model ("opus", "local", "haiku")
            temperature: Temperature for generation
            max_tokens: Max output tokens
            output_type: Validation type ("seo", "research", "video")

        Returns:
            Generated response

        Raises:
            RuntimeError if all providers fail or validation fails after max retries
        """
        # Step 1: Get routing decision (async)
        decision = await route_task(prompt, category_hint, user_preference)

        # Step 2: Log routing decision
        log_routing_decision(decision)

        # Step 3: Retry loop
        for attempt in range(self.max_retries + 1):
            try:
                # Increase temperature on retries
                current_temp = min(1.0, temperature + (attempt * 0.15))

                log.info(f"[Attempt {attempt+1}/{self.max_retries+1}] "
                        f"Model: {decision.model_key}, Temp: {current_temp:.2f}")

                # Call model
                response = await self._call_model(
                    decision.model_key,
                    prompt,
                    system,
                    current_temp,
                    max_tokens,
                )

                # Validate output if type specified
                if output_type:
                    validation = validate_output(json.loads(response), output_type)
                    if not validation.valid:
                        log.warning(f"Validation failed: {validation.feedback}")
                        if attempt < self.max_retries:
                            # Add validation feedback to prompt and retry
                            prompt = (
                                prompt +
                                f"\n\nValidation feedback from previous attempt: "
                                f"{validation.retry_prompt}"
                            )
                            continue
                        else:
                            log.error(f"Max retries reached. Validation failed: {validation.feedback}")
                            raise ValueError(f"Output validation failed: {validation.feedback}")

                # Success!
                self._log_call(decision.model_key, len(response), cost=decision.estimated_cost)
                return response

            except (asyncio.TimeoutError, httpx.ConnectError, httpx.TimeoutException) as e:
                log.warning(f"Network error on attempt {attempt+1}: {e}")
                if attempt < self.max_retries:
                    # Wait before retry (exponential backoff)
                    wait_time = 2 ** attempt  # 1s, 2s, 4s
                    log.info(f"Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    raise RuntimeError(f"Failed after {self.max_retries + 1} attempts: {e}")

            except json.JSONDecodeError as e:
                log.warning(f"Invalid JSON on attempt {attempt+1}: {e}")
                if attempt < self.max_retries:
                    continue
                else:
                    raise RuntimeError(f"Invalid JSON after {self.max_retries + 1} attempts")

            except Exception as e:
                log.error(f"Unexpected error on attempt {attempt+1}: {e}")
                raise

    async def _call_model(
        self,
        model_key: str,
        prompt: str,
        system: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Call model via Ollama (no Claude API - using OAuth only)."""
        model_config = MODELS[model_key]

        if model_key == "qwen2_5_fast":
            # Ollama call (sync, but wrapped in async)
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                lambda: call_llm_sync(
                    prompt,
                    system=system,
                    model=model_config["name"],
                    temperature=temperature,
                    max_tokens=max_tokens,
                ),
            )
        else:
            raise ValueError(f"Unknown model: {model_key}. Only Ollama supported (no API key)")


    def _log_call(self, model_key: str, response_chars: int, cost: Optional[float] = None):
        """Log LLM call to tracking file."""
        self.call_count += 1
        if cost:
            self.total_cost += cost

        log_entry = {
            "call_number": self.call_count,
            "model": model_key,
            "response_chars": response_chars,
            "cost_usd": cost,
            "cumulative_cost": self.total_cost,
        }

        try:
            with open(self.cost_log, "a") as f:
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            log.warning(f"Failed to log call: {e}")


# Global instance
_router = None


def get_router() -> TaskRouter:
    """Get or create global TaskRouter instance."""
    global _router
    if _router is None:
        _router = TaskRouter()
    return _router


# Convenience function
async def route_and_call(
    prompt: str,
    system: str = "",
    category_hint: Optional[str] = None,
    output_type: Optional[str] = None,
    **kwargs,
) -> str:
    """
    Convenience: route and call in one function.

    Args:
        prompt: User/system prompt
        system: System context
        category_hint: Task category hint
        output_type: Validation type ("seo", "research", "video")
        **kwargs: Additional arguments (temperature, max_tokens, etc.)

    Returns:
        Generated response
    """
    router = get_router()
    return await router.route_and_call(
        prompt,
        system=system,
        category_hint=category_hint,
        output_type=output_type,
        **kwargs
    )
