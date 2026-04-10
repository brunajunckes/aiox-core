#!/usr/bin/env python3
"""
E2E Test: Run all 4 workflows and validate outputs
"""
import sys
sys.path.insert(0, '/root/autoflow')

from autoflow.workflows.research import run_research
from autoflow.workflows.seo import run_seo
from autoflow.workflows.video import run_video
import json
import time

print("\n" + "="*80)
print("AUTOFLOW E2E TEST — All Workflows")
print("="*80 + "\n")

tests = [
    ("research", "AI trends 2026", lambda: run_research("AI trends 2026")),
    ("seo", "Python programming", lambda: run_seo("Python programming")),
    ("video", "Learn Python", lambda: run_video("Learn Python", duration=30, style="educational")),
]

results = []

for name, topic, runner in tests:
    print(f"Testing {name.upper()} workflow...")
    print("-" * 80)
    start = time.time()
    try:
        result = runner()
        elapsed = time.time() - start
        
        # Validate result structure
        status = result.get("status")
        has_output = bool(result.get("output"))
        has_errors = bool(result.get("errors"))
        
        test_pass = status == "completed" and has_output and not has_errors
        
        results.append({
            "workflow": name,
            "status": "✓ PASS" if test_pass else "✗ FAIL",
            "execution_status": status,
            "has_output": has_output,
            "has_errors": has_errors,
            "elapsed_seconds": round(elapsed, 2),
        })
        
        print(f"✓ Status: {status}")
        print(f"✓ Output keys: {list(result.get('output', {}).keys())}")
        print(f"✓ Time: {elapsed:.2f}s")
        if has_errors:
            print(f"✗ Errors: {result['errors']}")
        print()
        
    except Exception as e:
        elapsed = time.time() - start
        results.append({
            "workflow": name,
            "status": "✗ FAIL",
            "error": str(e),
            "elapsed_seconds": round(elapsed, 2),
        })
        print(f"✗ ERROR: {e}\n")

print("="*80)
print("SUMMARY")
print("="*80)
for r in results:
    print(f"{r['workflow']:15} {r['status']:15} {r['elapsed_seconds']}s")

passed = sum(1 for r in results if "PASS" in r.get("status", ""))
print(f"\nTotal: {passed}/{len(results)} workflows passed")
print("="*80 + "\n")

sys.exit(0 if passed == len(results) else 1)
