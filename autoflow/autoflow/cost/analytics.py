"""
Cost Analytics System
====================

Advanced cost analysis, trend detection, and forecasting.

Features:
  - Cost aggregation and statistics
  - Trend analysis (daily, weekly, monthly)
  - Time series forecasting (linear regression)
  - Cost anomaly detection
  - Optimization recommendations
  - Cost comparison (before/after)
  - Efficiency metrics
"""

import logging
import math
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict
import statistics

log = logging.getLogger("cost-analytics")


@dataclass
class TrendAnalysis:
    """Trend analysis results."""
    period: str  # 'daily', 'weekly', 'monthly'
    data_points: List[Tuple[str, float]]  # (date, cost)
    trend: str  # 'increasing', 'decreasing', 'stable'
    growth_rate_percent: float
    average_cost: float
    max_cost: float
    min_cost: float
    std_dev: float


@dataclass
class Forecast:
    """Cost forecast prediction."""
    period_days: int
    predicted_cost: float
    confidence_level: float  # 0-100
    lower_bound: float
    upper_bound: float
    methodology: str = "linear_regression"


@dataclass
class OptimizationRecommendation:
    """Recommendation for cost optimization."""
    title: str
    description: str
    potential_savings_usd: float
    potential_savings_percent: float
    priority: str  # 'high', 'medium', 'low'
    implementation_difficulty: str  # 'easy', 'medium', 'hard'
    estimated_implementation_hours: float


class CostAnalytics:
    """Analyze costs and provide insights."""

    def __init__(self, tracker):
        """Initialize analytics engine.

        Args:
            tracker: CostTracker instance
        """
        self.tracker = tracker

    # ── Trend Analysis ──

    def analyze_trend(
        self, tenant_id: str, period: str = "daily", days: int = 30
    ) -> Optional[TrendAnalysis]:
        """
        Analyze cost trends over time.

        Args:
            tenant_id: Tenant identifier
            period: 'daily', 'weekly', or 'monthly'
            days: Number of days to analyze

        Returns:
            TrendAnalysis object or None
        """
        daily_costs = self.tracker.get_daily_costs(tenant_id, days)

        if not daily_costs:
            return None

        # Aggregate by period
        aggregated = self._aggregate_by_period(daily_costs, period)

        if len(aggregated) < 2:
            return None

        costs = [cost for _, cost in aggregated]

        # Calculate statistics
        avg_cost = statistics.mean(costs)
        max_cost = max(costs)
        min_cost = min(costs)
        std_dev = (
            statistics.stdev(costs)
            if len(costs) > 1
            else 0.0
        )

        # Calculate trend
        if len(costs) >= 2:
            recent_avg = statistics.mean(costs[-len(costs)//2:])
            older_avg = statistics.mean(costs[:len(costs)//2])
            growth_rate = (
                ((recent_avg - older_avg) / older_avg * 100)
                if older_avg > 0
                else 0
            )

            if growth_rate > 5:
                trend = "increasing"
            elif growth_rate < -5:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            growth_rate = 0
            trend = "stable"

        return TrendAnalysis(
            period=period,
            data_points=aggregated,
            trend=trend,
            growth_rate_percent=growth_rate,
            average_cost=avg_cost,
            max_cost=max_cost,
            min_cost=min_cost,
            std_dev=std_dev,
        )

    def _aggregate_by_period(
        self, daily_costs: Dict[str, float], period: str
    ) -> List[Tuple[str, float]]:
        """Aggregate daily costs by period."""
        if period == "daily":
            return sorted(daily_costs.items())

        aggregated = defaultdict(float)

        for date_str, cost in daily_costs.items():
            try:
                date = datetime.strptime(date_str, "%Y-%m-%d")

                if period == "weekly":
                    week_start = date - timedelta(
                        days=date.weekday()
                    )
                    key = week_start.strftime("%Y-W%U")
                elif period == "monthly":
                    key = date.strftime("%Y-%m")
                else:
                    key = date_str

                aggregated[key] += cost
            except ValueError:
                continue

        return sorted(aggregated.items())

    # ── Forecasting ──

    def forecast_cost(
        self,
        tenant_id: str,
        forecast_days: int = 30,
        historical_days: int = 90,
    ) -> Optional[Forecast]:
        """
        Forecast future costs using linear regression.

        Args:
            tenant_id: Tenant identifier
            forecast_days: Days to forecast
            historical_days: Historical data to use

        Returns:
            Forecast object or None
        """
        daily_costs = self.tracker.get_daily_costs(
            tenant_id, historical_days
        )

        if not daily_costs or len(daily_costs) < 2:
            return None

        # Prepare data
        x_values = list(range(len(daily_costs)))
        y_values = list(daily_costs.values())

        # Linear regression
        slope, intercept = self._linear_regression(x_values, y_values)

        # Forecast
        future_x = len(x_values) + forecast_days
        predicted_value = slope * future_x + intercept
        predicted_value = max(0, predicted_value)  # No negative costs

        # Calculate confidence (R-squared)
        y_mean = sum(y_values) / len(y_values)
        ss_tot = sum((y - y_mean) ** 2 for y in y_values)
        y_pred = [slope * x + intercept for x in x_values]
        ss_res = sum(
            (y_values[i] - y_pred[i]) ** 2
            for i in range(len(y_values))
        )

        r_squared = (
            1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
        )
        confidence = max(0, min(100, r_squared * 100))

        # Calculate bounds (±20% for low confidence)
        margin = predicted_value * (0.2 if confidence < 70 else 0.1)
        lower_bound = max(0, predicted_value - margin)
        upper_bound = predicted_value + margin

        return Forecast(
            period_days=forecast_days,
            predicted_cost=predicted_value,
            confidence_level=confidence,
            lower_bound=lower_bound,
            upper_bound=upper_bound,
        )

    def _linear_regression(
        self, x: List[float], y: List[float]
    ) -> Tuple[float, float]:
        """Simple linear regression. Returns (slope, intercept)."""
        n = len(x)
        if n < 2:
            return 0.0, 0.0

        x_mean = sum(x) / n
        y_mean = sum(y) / n

        numerator = sum(
            (x[i] - x_mean) * (y[i] - y_mean) for i in range(n)
        )
        denominator = sum(
            (x[i] - x_mean) ** 2 for i in range(n)
        )

        if denominator == 0:
            return 0.0, y_mean

        slope = numerator / denominator
        intercept = y_mean - slope * x_mean

        return slope, intercept

    # ── Anomaly Detection ──

    def detect_anomalies(
        self,
        tenant_id: str,
        threshold_std_dev: float = 2.0,
        days: int = 30,
    ) -> List[Tuple[str, float, str]]:
        """
        Detect cost anomalies using statistical analysis.

        Args:
            tenant_id: Tenant identifier
            threshold_std_dev: Number of std deviations to flag
            days: Historical days to analyze

        Returns:
            List of (date, cost, severity) tuples
        """
        daily_costs = self.tracker.get_daily_costs(tenant_id, days)

        if not daily_costs or len(daily_costs) < 3:
            return []

        costs = list(daily_costs.values())
        dates = list(daily_costs.keys())

        avg_cost = statistics.mean(costs)
        std_dev = (
            statistics.stdev(costs) if len(costs) > 1 else 0.0
        )

        anomalies = []

        for date, cost in zip(dates, costs):
            if std_dev > 0:
                z_score = abs((cost - avg_cost) / std_dev)

                if z_score >= threshold_std_dev:
                    if z_score >= 3.0:
                        severity = "critical"
                    else:
                        severity = "warning"

                    anomalies.append((date, cost, severity))

        return anomalies

    # ── Optimization Recommendations ──

    def get_optimization_recommendations(
        self, tenant_id: str, days: int = 30
    ) -> List[OptimizationRecommendation]:
        """
        Generate cost optimization recommendations.

        Args:
            tenant_id: Tenant identifier
            days: Days of data to analyze

        Returns:
            List of OptimizationRecommendation objects
        """
        recommendations = []

        # Analyze by model
        model_costs = self._get_costs_by_model(tenant_id, days)
        for model, cost in sorted(
            model_costs.items(), key=lambda x: x[1], reverse=True
        ):
            if "gpt-4" in model.lower():
                potential_savings = cost * 0.6  # Can save 60%

                recommendations.append(
                    OptimizationRecommendation(
                        title=f"Reduce {model} usage",
                        description=(
                            f"Consider using gpt-3.5-turbo or "
                            f"claude-3-haiku for simpler tasks"
                        ),
                        potential_savings_usd=potential_savings,
                        potential_savings_percent=60,
                        priority="high",
                        implementation_difficulty="medium",
                        estimated_implementation_hours=4,
                    )
                )

        # Analyze by workflow
        workflow_costs = self._get_costs_by_workflow(
            tenant_id, days
        )
        total_cost = sum(workflow_costs.values())

        for workflow, cost in sorted(
            workflow_costs.items(), key=lambda x: x[1], reverse=True
        ):
            percent = (cost / total_cost * 100) if total_cost > 0 else 0

            if percent > 40:
                recommendations.append(
                    OptimizationRecommendation(
                        title=f"Optimize {workflow} workflow",
                        description=(
                            f"This workflow accounts for {percent:.1f}% "
                            f"of costs. Consider caching or batching."
                        ),
                        potential_savings_usd=cost * 0.2,
                        potential_savings_percent=20,
                        priority="medium",
                        implementation_difficulty="hard",
                        estimated_implementation_hours=16,
                    )
                )

        # Check for unused workflows
        request_counts = self._get_request_counts_by_workflow(
            tenant_id, days
        )
        for workflow, requests in request_counts.items():
            if requests < 5:  # Very low usage
                cost = workflow_costs.get(workflow, 0)
                recommendations.append(
                    OptimizationRecommendation(
                        title=f"Consider discontinuing {workflow}",
                        description=(
                            f"Only {requests} requests in {days} days. "
                            f"Consider consolidating with other workflows."
                        ),
                        potential_savings_usd=cost,
                        potential_savings_percent=100,
                        priority="low",
                        implementation_difficulty="easy",
                        estimated_implementation_hours=2,
                    )
                )

        return sorted(
            recommendations,
            key=lambda x: x.potential_savings_usd,
            reverse=True,
        )

    def _get_costs_by_model(
        self, tenant_id: str, days: int
    ) -> Dict[str, float]:
        """Get costs breakdown by model."""
        result = defaultdict(float)
        cutoff = datetime.utcnow() - timedelta(days=days)

        for cost in self.tracker.requests.values():
            if (
                cost.tenant_id == tenant_id
                and cost.timestamp >= cutoff
            ):
                result[cost.model] += cost.cost_usd

        return dict(result)

    def _get_costs_by_workflow(
        self, tenant_id: str, days: int
    ) -> Dict[str, float]:
        """Get costs breakdown by workflow."""
        result = defaultdict(float)
        cutoff = datetime.utcnow() - timedelta(days=days)

        for cost in self.tracker.requests.values():
            if (
                cost.tenant_id == tenant_id
                and cost.timestamp >= cutoff
            ):
                result[cost.workflow_type] += cost.cost_usd

        return dict(result)

    def _get_request_counts_by_workflow(
        self, tenant_id: str, days: int
    ) -> Dict[str, int]:
        """Get request counts by workflow."""
        result = defaultdict(int)
        cutoff = datetime.utcnow() - timedelta(days=days)

        for cost in self.tracker.requests.values():
            if (
                cost.tenant_id == tenant_id
                and cost.timestamp >= cutoff
            ):
                result[cost.workflow_type] += 1

        return dict(result)

    # ── Comparison Analysis ──

    def compare_periods(
        self,
        tenant_id: str,
        period1_start: datetime,
        period1_end: datetime,
        period2_start: datetime,
        period2_end: datetime,
    ) -> Dict:
        """
        Compare costs between two periods.

        Args:
            tenant_id: Tenant identifier
            period1_start: Period 1 start date
            period1_end: Period 1 end date
            period2_start: Period 2 start date
            period2_end: Period 2 end date

        Returns:
            Comparison dictionary
        """
        period1_cost = 0.0
        period2_cost = 0.0
        period1_requests = 0
        period2_requests = 0

        for cost in self.tracker.requests.values():
            if cost.tenant_id != tenant_id:
                continue

            if period1_start <= cost.timestamp <= period1_end:
                period1_cost += cost.cost_usd
                period1_requests += 1
            elif period2_start <= cost.timestamp <= period2_end:
                period2_cost += cost.cost_usd
                period2_requests += 1

        change = period2_cost - period1_cost
        change_percent = (
            (change / period1_cost * 100)
            if period1_cost > 0
            else 0
        )

        return {
            "period1": {
                "cost": period1_cost,
                "requests": period1_requests,
                "avg_per_request": (
                    period1_cost / period1_requests
                    if period1_requests > 0
                    else 0
                ),
            },
            "period2": {
                "cost": period2_cost,
                "requests": period2_requests,
                "avg_per_request": (
                    period2_cost / period2_requests
                    if period2_requests > 0
                    else 0
                ),
            },
            "change": {
                "absolute": change,
                "percent": change_percent,
                "direction": (
                    "increase"
                    if change > 0
                    else ("decrease" if change < 0 else "stable")
                ),
            },
        }

    # ── Efficiency Metrics ──

    def get_efficiency_metrics(
        self, tenant_id: str, days: int = 30
    ) -> Dict:
        """
        Calculate efficiency metrics.

        Args:
            tenant_id: Tenant identifier
            days: Days to analyze

        Returns:
            Dictionary with efficiency metrics
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        total_cost = 0.0
        total_input_tokens = 0
        total_output_tokens = 0
        total_requests = 0
        successful_requests = 0
        failed_requests = 0

        for cost in self.tracker.requests.values():
            if (
                cost.tenant_id == tenant_id
                and cost.timestamp >= cutoff
            ):
                total_cost += cost.cost_usd
                total_input_tokens += cost.input_tokens
                total_output_tokens += cost.output_tokens
                total_requests += 1

                if cost.status == "completed":
                    successful_requests += 1
                else:
                    failed_requests += 1

        total_tokens = total_input_tokens + total_output_tokens

        return {
            "total_cost": total_cost,
            "total_requests": total_requests,
            "total_tokens": total_tokens,
            "successful_requests": successful_requests,
            "failed_requests": failed_requests,
            "success_rate": (
                (successful_requests / total_requests * 100)
                if total_requests > 0
                else 0
            ),
            "cost_per_request": (
                total_cost / total_requests
                if total_requests > 0
                else 0
            ),
            "cost_per_token": (
                total_cost / total_tokens
                if total_tokens > 0
                else 0
            ),
            "tokens_per_request": (
                total_tokens / total_requests
                if total_requests > 0
                else 0
            ),
        }
