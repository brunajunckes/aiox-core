#!/usr/bin/env python3
"""
Quick test of workflows with task_router
Tests that task_router integration works without actually running full workflows
"""

import sys
sys.path.insert(0, '/root/autoflow')

from autoflow.workflows.seo import run_seo
from autoflow.workflows.research import run_research
from autoflow.workflows.video import run_video

print("\n" + "="*80)
print("AUTOFLOW WORKFLOWS — TASK_ROUTER INTEGRATION TEST")
print("="*80 + "\n")

# Test 1: SEO Workflow (basic)
print("Test 1: SEO Workflow")
print("-" * 80)
try:
    result = run_seo("Python programming")
    print(f"✓ SEO workflow ran successfully")
    print(f"  Thread ID: {result['thread_id'][:8]}...")
    print(f"  Status: {result['status']}")
    print(f"  Keywords: {result.get('keywords', [])[:3]}...")
except Exception as e:
    print(f"✗ SEO workflow failed: {e}")

print()

# Test 2: Research Workflow
print("Test 2: Research Workflow")
print("-" * 80)
try:
    result = run_research("Machine Learning trends 2026")
    print(f"✓ Research workflow ran successfully")
    print(f"  Thread ID: {result['thread_id'][:8]}...")
    print(f"  Status: {result['status']}")
    if result.get('output'):
        print(f"  Output keys: {list(result['output'].keys())}")
except Exception as e:
    print(f"✗ Research workflow failed: {e}")

print()

# Test 3: Video Workflow
print("Test 3: Video Workflow")
print("-" * 80)
try:
    result = run_video("How to learn Python", duration=60, style="educational")
    print(f"✓ Video workflow ran successfully")
    print(f"  Thread ID: {result['thread_id'][:8]}...")
    print(f"  Status: {result['status']}")
    if result.get('output'):
        print(f"  Output keys: {list(result['output'].keys())}")
except Exception as e:
    print(f"✗ Video workflow failed: {e}")

print()
print("="*80)
print("TEST COMPLETE")
print("="*80 + "\n")
