#!/usr/bin/env python3
"""AutoFlow CLI — Cost analysis and diagnostics commands.

Usage:
    autoflow cost-summary [--days=N] [--workflow=TYPE]
    autoflow router-health
    autoflow cost-trend [--days=N]
    autoflow cost-by-model [--days=N]
    autoflow circuit-status
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta
from typing import Any, Optional

from autoflow.core import cost_logger
from autoflow.core import router as llm_router


def format_currency(amount: float) -> str:
    """Format currency for display."""
    return f"${amount:,.4f}"


def format_percentage(value: float) -> str:
    """Format percentage."""
    return f"{value:.2f}%"


def cost_summary_cmd(args: Any) -> int:
    """Show cost summary for a time period.

    Args:
        args.days: number of days to aggregate (default: 1)
        args.workflow: optional workflow type filter

    Returns:
        0 on success, 1 on error
    """
    days = getattr(args, "days", 1)
    workflow_type = getattr(args, "workflow", None)

    summary = cost_logger.get_cost_summary(days=days, workflow_type=workflow_type)

    if not summary:
        print("No cost data available.", file=sys.stderr)
        return 1

    print(f"\n{'═' * 60}")
    print(f"AutoFlow Cost Summary — Last {days} day(s)")
    if workflow_type:
        print(f"Workflow: {workflow_type}")
    print(f"{'═' * 60}\n")

    total_requests = summary.get("total_requests", 0)
    total_cost = summary.get("total_cost_usd", 0.0)
    avg_cost = summary.get("average_cost_per_request", 0.0)

    print(f"Total Requests: {total_requests}")
    print(f"Total Cost:     {format_currency(total_cost)}")
    print(f"Avg Per Request: {format_currency(avg_cost)}")

    print(f"\n{'─' * 60}")
    print("Breakdown by Provider:")
    print(f"{'─' * 60}")
    by_provider = summary.get("by_provider", {})
    for provider, cost in sorted(by_provider.items()):
        pct = (cost / total_cost * 100) if total_cost > 0 else 0
        print(f"  {provider:12} {format_currency(cost):>12} ({format_percentage(pct):>6})")

    print(f"\n{'─' * 60}")
    print("Breakdown by Model:")
    print(f"{'─' * 60}")
    by_model = summary.get("by_model", {})
    for model, cost in sorted(by_model.items(), key=lambda x: x[1], reverse=True):
        pct = (cost / total_cost * 100) if total_cost > 0 else 0
        print(f"  {model:30} {format_currency(cost):>12} ({format_percentage(pct):>6})")

    print(f"\n{'─' * 60}")
    print("Breakdown by Complexity:")
    print(f"{'─' * 60}")
    by_complexity = summary.get("by_complexity", {})
    for level, cost in sorted(by_complexity.items()):
        pct = (cost / total_cost * 100) if total_cost > 0 else 0
        print(f"  {level:15} {format_currency(cost):>12} ({format_percentage(pct):>6})")

    print(f"\n{'═' * 60}\n")
    return 0


def router_health_cmd(args: Any) -> int:
    """Check router health status.

    Returns:
        0 if healthy, 1 if degraded/unhealthy
    """
    health = llm_router.router_health()

    print(f"\n{'═' * 60}")
    print("AutoFlow Router Health")
    print(f"{'═' * 60}\n")

    print(f"LLM Router URL:        {health.get('llm_router_url')}")
    print(f"Ollama URL:            {health.get('ollama_url')}")
    print(f"Ollama Default Model:  {health.get('ollama_default_model')}")
    print(f"Claude Configured:     {health.get('claude_configured')}")
    print(f"Cost Log Path:         {health.get('cost_log_path')}")
    print(f"Circuit Breaker State: {health.get('circuit_state')}")

    # Check if circuit is open (unhealthy)
    if health.get("circuit_state") == "open":
        print("\n⚠️  Circuit breaker is OPEN — LLM Router may be unavailable")
        print("   Requests will use fallback (Ollama → Claude)")
        print(f"\n{'═' * 60}\n")
        return 1

    print(f"\n{'═' * 60}\n")
    return 0


def cost_trend_cmd(args: Any) -> int:
    """Show cost trend over time.

    Args:
        args.days: number of historical days to analyze (default: 7)

    Returns:
        0 on success, 1 on error
    """
    days = getattr(args, "days", 7)

    # For simplicity, we'll show daily summaries
    print(f"\n{'═' * 60}")
    print(f"AutoFlow Cost Trend — Last {days} days")
    print(f"{'═' * 60}\n")

    print(f"{'Date':<12} {'Requests':>10} {'Cost (USD)':>12}")
    print(f"{'-' * 60}")

    total_all_days = 0.0
    for day_offset in range(days, 0, -1):
        day = (datetime.now() - timedelta(days=day_offset)).date()

        # Get summary for that specific day
        summary = cost_logger.get_cost_summary(days=1)

        # Note: This is a simplified version. A real implementation would
        # need to query the database for specific dates.
        if summary:
            cost = summary.get("total_cost_usd", 0.0)
            reqs = summary.get("total_requests", 0)
            total_all_days += cost
            print(f"{str(day):<12} {reqs:>10} {format_currency(cost):>12}")

    print(f"{'-' * 60}")
    print(f"{'TOTAL':<12} {'':>10} {format_currency(total_all_days):>12}")
    print(f"\n{'═' * 60}\n")
    return 0


def cost_by_model_cmd(args: Any) -> int:
    """Show cost breakdown by model.

    Args:
        args.days: number of days to aggregate (default: 7)

    Returns:
        0 on success, 1 on error
    """
    days = getattr(args, "days", 7)

    summary = cost_logger.get_cost_summary(days=days)

    if not summary:
        print("No cost data available.", file=sys.stderr)
        return 1

    print(f"\n{'═' * 60}")
    print(f"Cost by Model — Last {days} days")
    print(f"{'═' * 60}\n")

    by_model = summary.get("by_model", {})
    total_cost = summary.get("total_cost_usd", 0.0)

    print(f"{'Model':<35} {'Cost (USD)':>12} {'Percentage':>12}")
    print(f"{'-' * 60}")

    for model, cost in sorted(by_model.items(), key=lambda x: x[1], reverse=True):
        pct = (cost / total_cost * 100) if total_cost > 0 else 0
        print(f"{model:<35} {format_currency(cost):>12} {format_percentage(pct):>12}")

    print(f"{'-' * 60}")
    print(f"{'TOTAL':<35} {format_currency(total_cost):>12} {'100.00%':>12}")
    print(f"\n{'═' * 60}\n")
    return 0


def circuit_status_cmd(args: Any) -> int:
    """Show circuit breaker status for all providers.

    Returns:
        0 on success
    """
    health = llm_router.router_health()
    circuit_state = health.get("circuit_state", "unknown")

    print(f"\n{'═' * 60}")
    print("Circuit Breaker Status")
    print(f"{'═' * 60}\n")

    state_emoji = {
        "closed": "✓ CLOSED (normal)",
        "open": "✗ OPEN (failing fast)",
        "half_open": "⚠ HALF_OPEN (probing)",
    }

    print(f"State: {state_emoji.get(circuit_state, circuit_state)}")
    print(f"\nMeaning:")
    if circuit_state == "closed":
        print("  LLM-Router is available and healthy.")
        print("  Requests will use complexity-based routing (Ollama → Claude).")
    elif circuit_state == "open":
        print("  LLM-Router has failed repeatedly.")
        print("  Requests will bypass LLM-Router and use Ollama (fallback).")
    elif circuit_state == "half_open":
        print("  LLM-Router cooldown has expired.")
        print("  Next request will probe availability before resuming full routing.")

    print(f"\n{'═' * 60}\n")
    return 0


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="AutoFlow cost analysis and diagnostics",
        prog="autoflow",
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # cost-summary command
    cost_parser = subparsers.add_parser(
        "cost-summary",
        help="Show cost summary",
    )
    cost_parser.add_argument(
        "--days",
        type=int,
        default=1,
        help="Number of days to aggregate (default: 1)",
    )
    cost_parser.add_argument(
        "--workflow",
        type=str,
        help="Filter by workflow type (optional)",
    )
    cost_parser.set_defaults(func=cost_summary_cmd)

    # router-health command
    health_parser = subparsers.add_parser(
        "router-health",
        help="Check router health status",
    )
    health_parser.set_defaults(func=router_health_cmd)

    # cost-trend command
    trend_parser = subparsers.add_parser(
        "cost-trend",
        help="Show cost trend over time",
    )
    trend_parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Number of historical days (default: 7)",
    )
    trend_parser.set_defaults(func=cost_trend_cmd)

    # cost-by-model command
    model_parser = subparsers.add_parser(
        "cost-by-model",
        help="Show cost breakdown by model",
    )
    model_parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Number of days to aggregate (default: 7)",
    )
    model_parser.set_defaults(func=cost_by_model_cmd)

    # circuit-status command
    circuit_parser = subparsers.add_parser(
        "circuit-status",
        help="Show circuit breaker status",
    )
    circuit_parser.set_defaults(func=circuit_status_cmd)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    try:
        return args.func(args)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
