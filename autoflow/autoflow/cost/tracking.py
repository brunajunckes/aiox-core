"""
Cost Tracking System
====================

Real-time cost calculation and tracking for all AutoFlow requests.

Features:
  - Per-request cost calculation based on model, tokens, GPU usage
  - Cost aggregation by tenant, workflow, time period
  - Budget enforcement and alerts
  - Cost history and trends
  - Multi-currency support
"""

import logging
import time
from typing import Dict, Optional, List, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from collections import defaultdict
import json

log = logging.getLogger("cost-tracking")


@dataclass
class RequestCost:
    """Cost breakdown for a single request."""
    request_id: str
    tenant_id: str
    workflow_type: str
    model: str
    input_tokens: int
    output_tokens: int
    gpu_seconds: float
    duration_ms: int
    cost_usd: float
    timestamp: datetime = field(default_factory=datetime.utcnow)
    status: str = "completed"  # completed, failed, timeout
    metadata: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        """Convert to dictionary for storage."""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


@dataclass
class BudgetLimit:
    """Budget limit configuration for a tenant."""
    tenant_id: str
    monthly_budget_usd: float
    alert_threshold_percent: float = 80.0  # Alert at 80% of budget
    hard_limit: bool = False  # If True, reject requests exceeding budget
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def is_over_budget(self, spent_usd: float) -> bool:
        """Check if tenant has exceeded budget."""
        return spent_usd >= self.monthly_budget_usd if self.hard_limit else False

    def should_alert(self, spent_usd: float) -> bool:
        """Check if spending triggers alert threshold."""
        threshold = self.monthly_budget_usd * (self.alert_threshold_percent / 100)
        return spent_usd >= threshold


class CostCalculator:
    """Calculate cost for requests based on model and resource usage."""

    # Pricing per 1M tokens (approximate, can be configured)
    MODEL_PRICING = {
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        "gpt-4": {"input": 0.03, "output": 0.06},
        "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
        "claude-3-opus": {"input": 0.015, "output": 0.075},
        "claude-3-sonnet": {"input": 0.003, "output": 0.015},
        "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
        "ollama-qwen": {"input": 0.0, "output": 0.0},  # Local, free
    }

    # GPU pricing per second (approximate)
    GPU_PRICING = {
        "a100": 0.002,  # $0.002 per second (~$7.20/hour)
        "v100": 0.001,  # $0.001 per second (~$3.60/hour)
        "t4": 0.0003,   # $0.0003 per second (~$1.08/hour)
    }

    def __init__(self, currency: str = "USD"):
        """Initialize cost calculator."""
        self.currency = currency
        self.exchange_rates = {"USD": 1.0, "BRL": 5.0}  # Add more as needed

    def calculate_llm_cost(
        self, model: str, input_tokens: int, output_tokens: int
    ) -> float:
        """
        Calculate LLM API cost.

        Args:
            model: Model identifier (e.g., 'gpt-4-turbo')
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Cost in USD
        """
        pricing = self.MODEL_PRICING.get(model, {"input": 0.0, "output": 0.0})

        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]

        return input_cost + output_cost

    def calculate_gpu_cost(
        self, gpu_type: str, duration_seconds: float
    ) -> float:
        """
        Calculate GPU utilization cost.

        Args:
            gpu_type: GPU type (e.g., 'a100', 'v100')
            duration_seconds: Duration of GPU usage in seconds

        Returns:
            Cost in USD
        """
        rate = self.GPU_PRICING.get(gpu_type, 0.0)
        return rate * duration_seconds

    def calculate_request_cost(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        gpu_type: Optional[str] = None,
        gpu_seconds: float = 0.0,
    ) -> float:
        """
        Calculate total cost for a request.

        Args:
            model: Model used
            input_tokens: Input token count
            output_tokens: Output token count
            gpu_type: GPU type if any (optional)
            gpu_seconds: GPU usage duration

        Returns:
            Total cost in USD
        """
        llm_cost = self.calculate_llm_cost(model, input_tokens, output_tokens)
        gpu_cost = 0.0

        if gpu_type and gpu_seconds > 0:
            gpu_cost = self.calculate_gpu_cost(gpu_type, gpu_seconds)

        return llm_cost + gpu_cost


class CostTracker:
    """Track costs for all requests with aggregation and analysis."""

    def __init__(self):
        """Initialize cost tracker."""
        self.requests: Dict[str, RequestCost] = {}  # request_id -> RequestCost
        self.budgets: Dict[str, BudgetLimit] = {}  # tenant_id -> BudgetLimit
        self.calculator = CostCalculator()
        self.tenant_costs: Dict[str, float] = defaultdict(float)  # tenant_id -> cost
        self.workflow_costs: Dict[Tuple[str, str], float] = defaultdict(
            float
        )  # (tenant_id, workflow) -> cost

    def track_request(
        self,
        request_id: str,
        tenant_id: str,
        workflow_type: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        duration_ms: int,
        gpu_type: Optional[str] = None,
        gpu_seconds: float = 0.0,
        status: str = "completed",
        metadata: Optional[Dict] = None,
    ) -> RequestCost:
        """
        Track a request and calculate its cost.

        Args:
            request_id: Unique request identifier
            tenant_id: Tenant identifier
            workflow_type: Type of workflow (e.g., 'research', 'seo')
            model: Model used
            input_tokens: Input token count
            output_tokens: Output token count
            duration_ms: Request duration in milliseconds
            gpu_type: GPU type if used
            gpu_seconds: GPU seconds used
            status: Request status
            metadata: Additional metadata

        Returns:
            RequestCost object
        """
        cost_usd = self.calculator.calculate_request_cost(
            model, input_tokens, output_tokens, gpu_type, gpu_seconds
        )

        request_cost = RequestCost(
            request_id=request_id,
            tenant_id=tenant_id,
            workflow_type=workflow_type,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            gpu_seconds=gpu_seconds,
            duration_ms=duration_ms,
            cost_usd=cost_usd,
            status=status,
            metadata=metadata or {},
        )

        self.requests[request_id] = request_cost
        self.tenant_costs[tenant_id] += cost_usd
        self.workflow_costs[(tenant_id, workflow_type)] += cost_usd

        log.info(
            f"Tracked request {request_id}: {cost_usd:.4f} USD "
            f"({input_tokens} + {output_tokens} tokens)"
        )

        return request_cost

    def get_request_cost(self, request_id: str) -> Optional[RequestCost]:
        """Get cost for a specific request."""
        return self.requests.get(request_id)

    def get_tenant_cost(
        self, tenant_id: str, days: int = 30
    ) -> float:
        """
        Get total cost for a tenant in the last N days.

        Args:
            tenant_id: Tenant identifier
            days: Number of days to look back

        Returns:
            Total cost in USD
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        total = 0.0

        for cost in self.requests.values():
            if (
                cost.tenant_id == tenant_id
                and cost.timestamp >= cutoff
            ):
                total += cost.cost_usd

        return total

    def get_workflow_cost(
        self, tenant_id: str, workflow_type: str, days: int = 30
    ) -> float:
        """
        Get total cost for a workflow type.

        Args:
            tenant_id: Tenant identifier
            workflow_type: Workflow type
            days: Number of days to look back

        Returns:
            Total cost in USD
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        total = 0.0

        for cost in self.requests.values():
            if (
                cost.tenant_id == tenant_id
                and cost.workflow_type == workflow_type
                and cost.timestamp >= cutoff
            ):
                total += cost.cost_usd

        return total

    def get_daily_costs(
        self, tenant_id: str, days: int = 30
    ) -> Dict[str, float]:
        """
        Get daily cost breakdown for a tenant.

        Args:
            tenant_id: Tenant identifier
            days: Number of days to return

        Returns:
            Dictionary with date string as key, cost as value
        """
        daily_costs: Dict[str, float] = defaultdict(float)
        cutoff = datetime.utcnow() - timedelta(days=days)

        for cost in self.requests.values():
            if (
                cost.tenant_id == tenant_id
                and cost.timestamp >= cutoff
            ):
                date_key = cost.timestamp.strftime("%Y-%m-%d")
                daily_costs[date_key] += cost.cost_usd

        return dict(sorted(daily_costs.items()))

    def set_budget(
        self,
        tenant_id: str,
        monthly_budget_usd: float,
        alert_threshold_percent: float = 80.0,
        hard_limit: bool = False,
    ) -> BudgetLimit:
        """
        Set budget limit for a tenant.

        Args:
            tenant_id: Tenant identifier
            monthly_budget_usd: Monthly budget in USD
            alert_threshold_percent: Alert threshold as percentage
            hard_limit: Whether to enforce hard limit

        Returns:
            BudgetLimit object
        """
        budget = BudgetLimit(
            tenant_id=tenant_id,
            monthly_budget_usd=monthly_budget_usd,
            alert_threshold_percent=alert_threshold_percent,
            hard_limit=hard_limit,
        )

        self.budgets[tenant_id] = budget
        log.info(
            f"Set budget for {tenant_id}: ${monthly_budget_usd} "
            f"(alert at {alert_threshold_percent}%)"
        )

        return budget

    def get_budget(self, tenant_id: str) -> Optional[BudgetLimit]:
        """Get budget limit for a tenant."""
        return self.budgets.get(tenant_id)

    def check_budget_status(self, tenant_id: str) -> Dict:
        """
        Check budget status for a tenant.

        Returns:
            Dictionary with budget info and status
        """
        budget = self.budgets.get(tenant_id)
        if not budget:
            return {"has_budget": False}

        # Get costs for current month
        now = datetime.utcnow()
        month_start = datetime(now.year, now.month, 1)
        spent = 0.0

        for cost in self.requests.values():
            if (
                cost.tenant_id == tenant_id
                and cost.timestamp >= month_start
            ):
                spent += cost.cost_usd

        return {
            "has_budget": True,
            "monthly_budget": budget.monthly_budget_usd,
            "spent": spent,
            "remaining": budget.monthly_budget_usd - spent,
            "percent_used": (spent / budget.monthly_budget_usd * 100)
            if budget.monthly_budget_usd > 0
            else 0,
            "should_alert": budget.should_alert(spent),
            "over_budget": budget.is_over_budget(spent),
        }

    def can_process_request(self, tenant_id: str) -> Tuple[bool, Optional[str]]:
        """
        Check if a request can be processed based on budget.

        Args:
            tenant_id: Tenant identifier

        Returns:
            Tuple of (allowed: bool, reason: Optional[str])
        """
        budget = self.budgets.get(tenant_id)
        if not budget:
            return True, None  # No budget limit

        status = self.check_budget_status(tenant_id)

        if budget.hard_limit and status["over_budget"]:
            return (
                False,
                f"Monthly budget exceeded: ${status['spent']:.2f} / "
                f"${status['monthly_budget']:.2f}",
            )

        return True, None

    def get_cost_summary(
        self, tenant_id: Optional[str] = None, days: int = 30
    ) -> Dict:
        """
        Get summary of costs.

        Args:
            tenant_id: Optional tenant filter
            days: Days to include

        Returns:
            Cost summary dictionary
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        requests = []
        total_cost = 0.0
        request_count = 0
        by_model = defaultdict(float)
        by_workflow = defaultdict(float)

        for cost in self.requests.values():
            if (
                cost.timestamp >= cutoff
                and (tenant_id is None or cost.tenant_id == tenant_id)
            ):
                requests.append(cost)
                total_cost += cost.cost_usd
                request_count += 1
                by_model[cost.model] += cost.cost_usd
                by_workflow[cost.workflow_type] += cost.cost_usd

        avg_cost = total_cost / request_count if request_count > 0 else 0.0

        return {
            "period_days": days,
            "total_requests": request_count,
            "total_cost_usd": total_cost,
            "average_cost_per_request": avg_cost,
            "by_model": dict(by_model),
            "by_workflow": dict(by_workflow),
        }


# Global tracker instance
_tracker: Optional[CostTracker] = None


def get_tracker() -> CostTracker:
    """Get or create global cost tracker."""
    global _tracker
    if _tracker is None:
        _tracker = CostTracker()
    return _tracker
