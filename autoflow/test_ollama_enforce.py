#!/usr/bin/env python3
"""
Quick test of Ollama Enforcement — Verify routing decisions
"""

import asyncio
import sys
sys.path.insert(0, '/root/autoflow')

from autoflow.core.ollama_enforce import (
    classify_task,
    select_model,
    route_task,
    health_summary,
    MODELS,
)


async def test_routing():
    """Test routing decisions for different task types"""

    print("\n" + "="*80)
    print("OLLAMA ENFORCEMENT — ROUTING TEST")
    print("="*80 + "\n")

    # Health check
    health = await health_summary()
    print(f"✓ Ollama: {health['ollama']}")
    print(f"✓ LLM-Router: {health['llm_router']}")
    print(f"✓ Anthropic API: {health['anthropic_key']}\n")

    # Test cases
    test_cases = [
        {
            "prompt": "Generate a JSON config file with project settings",
            "category": "json-formatting",
            "expected": "qwen2_5_fast"
        },
        {
            "prompt": "Write a comprehensive research report on AI trends",
            "category": "research",
            "expected": "qwen2_5_fast"  # Ollama only (no API key)
        },
        {
            "prompt": "Design a secure authentication system with JWT tokens and password hashing",
            "category": "security-review",
            "expected": "qwen2_5_fast"  # Ollama only (no API key)
        },
        {
            "prompt": "Create a markdown README for the project",
            "category": "markdown",
            "expected": "qwen2_5_fast"
        },
        {
            "prompt": "Review this code for vulnerabilities and security issues",
            "category": "code-review",
            "expected": "qwen2_5_fast"  # Ollama only (no API key)
        }
    ]

    print("ROUTING DECISIONS:")
    print("-" * 80)

    for i, test in enumerate(test_cases, 1):
        profile = classify_task(test["prompt"], test["category"])
        decision = await route_task(test["prompt"], test["category"])

        status = "✓" if decision.model_key == test["expected"] else "✗"

        print(f"\n{i}. {test['category'].upper()}")
        print(f"   Task: {test['prompt'][:60]}...")
        print(f"   Complexity: {profile.complexity_tier} (score: {profile.complexity_score})")
        print(f"   Route: {decision.model_key}")
        print(f"   Model: {decision.model_name}")
        print(f"   Endpoint: {decision.endpoint}")
        print(f"   Cost: ${decision.estimated_cost:.4f}")
        print(f"   Reason: {decision.reason}")
        print(f"   Status: {status}")

    print("\n" + "="*80)
    print("MODELS AVAILABLE")
    print("="*80 + "\n")

    for key, config in MODELS.items():
        print(f"{key:20} | {config['name']:25} | Quality: {config['quality']}/10 | Cost: ${config['cost_per_1k']:.4f}/1K")

    print("\n" + "="*80)
    print("ENDPOINT CONFIGURATION")
    print("="*80)
    print(f"Ollama Online:  {MODELS['qwen2_5_fast']['endpoint']}")
    print(f"Status:         {'🟢 OK' if MODELS['qwen2_5_fast']['endpoint'].startswith('http://ollama.ampcast') else '🔴 WRONG'}")
    print("="*80 + "\n")


if __name__ == "__main__":
    asyncio.run(test_routing())
