#!/usr/bin/env python3
"""
Test task_router routing logic
Verifies that tasks are routed to correct models based on category
"""

import sys
import asyncio
sys.path.insert(0, '/root/autoflow')

from autoflow.core.task_router import route_and_call
from autoflow.core.ollama_enforce import route_task

print("\n" + "="*80)
print("TASK ROUTER — ROUTING LOGIC TEST")
print("="*80 + "\n")

async def test_routing():
    """Test routing for different task categories"""

    test_cases = [
        {
            "prompt": "Generate JSON config for my app",
            "category": "json-formatting",
            "expected_model": "qwen2_5_fast",
            "expect_cost": 0,
        },
        {
            "prompt": "Research machine learning trends in 2026",
            "category": "research",
            "expected_model": "qwen2_5_fast",  # Ollama only (no API key)
            "expect_cost": 0,
        },
        {
            "prompt": "Design a secure authentication system",
            "category": "security-review",
            "expected_model": "qwen2_5_fast",  # Ollama only (no API key)
            "expect_cost": 0,
        },
        {
            "prompt": "Create markdown documentation",
            "category": "markdown",
            "expected_model": "qwen2_5_fast",
            "expect_cost": 0,
        },
    ]

    print("ROUTING DECISIONS:")
    print("-" * 80)

    passed = 0
    failed = 0

    for test in test_cases:
        try:
            decision = await route_task(test["prompt"], test["category"])

            status = "✓" if decision.model_key == test["expected_model"] else "✗"

            if decision.model_key == test["expected_model"]:
                passed += 1
            else:
                failed += 1

            print(f"\n{test['category'].upper()}")
            print(f"  Prompt: {test['prompt'][:50]}...")
            print(f"  Expected model: {test['expected_model']}")
            print(f"  Got model: {decision.model_key}")
            print(f"  Model name: {decision.model_name}")
            print(f"  Complexity: {decision.complexity_tier}")
            print(f"  Cost: ${decision.estimated_cost:.4f}")
            print(f"  Fallback: {decision.fallback_model_key}")
            print(f"  Status: {status}")

        except Exception as e:
            failed += 1
            print(f"\n{test['category'].upper()}")
            print(f"  ✗ Error: {e}")

    print("\n" + "="*80)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("="*80 + "\n")

    return passed, failed

if __name__ == "__main__":
    passed, failed = asyncio.run(test_routing())
    sys.exit(0 if failed == 0 else 1)
