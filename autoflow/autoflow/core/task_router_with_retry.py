"""
Task Router v2 — with automatic retry logic
Retries with exponential backoff + temperature increase on failure
"""
import os
import json
import logging
import asyncio
from typing import Optional
import httpx

from .ollama_enforce import route_task, log_routing_decision, MODELS, TaskComplexity
from .router import call_llm_sync
from .validator_enhanced import validate_output

log = logging.getLogger("task-router-v2")

class TaskRouterV2:
    """Enhanced router with retry logic and validation."""

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
        Route task and execute with retry logic.

        Retries on:
        - Network errors
        - Invalid output format
        - Validation failure

        Temperature increases on retry: 0.7 → 0.85 → 1.0
        """
        decision = await route_task(prompt, category_hint, user_preference)
        log_routing_decision(decision)

        # Retry loop
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
        """Call model via Ollama."""
        model_config = MODELS[model_key]

        if model_key == "qwen2_5_fast":
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
            raise ValueError(f"Unknown model: {model_key}")

    def _log_call(self, model_key: str, response_chars: int, cost: Optional[float] = None):
        """Log call to tracking file."""
        self.call_count += 1
        if cost:
            self.total_cost += cost

        log_entry = {
            "call_number": self.call_count,
            "model": model_key,
            "response_chars": response_chars,
            "cost_usd": cost or 0.0,
            "cumulative_cost": self.total_cost,
        }

        try:
            with open(self.cost_log, "a") as f:
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            log.warning(f"Failed to log call: {e}")


# Global instance
_router_v2 = None

def get_router_v2() -> TaskRouterV2:
    """Get or create global TaskRouterV2 instance."""
    global _router_v2
    if _router_v2 is None:
        _router_v2 = TaskRouterV2()
    return _router_v2

async def route_and_call_v2(
    prompt: str,
    system: str = "",
    category_hint: Optional[str] = None,
    output_type: Optional[str] = None,
    **kwargs,
) -> str:
    """Convenience function with retry logic."""
    router = get_router_v2()
    return await router.route_and_call(
        prompt,
        system=system,
        category_hint=category_hint,
        output_type=output_type,
        **kwargs
    )
