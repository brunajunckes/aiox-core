"""
Billing API Endpoints
====================

FastAPI endpoints for cost tracking, billing, and optimization:
  GET  /billing/costs       — Retrieve current costs
  GET  /billing/forecast    — Predict future costs
  PUT  /billing/budget      — Set budget limits
  GET  /billing/reports     — Generate cost reports
  POST /billing/optimize    — Get optimization suggestions
  GET  /billing/trends      — Analyze cost trends
"""

import logging
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..cost.tracking import get_tracker, BudgetLimit
from ..cost.analytics import CostAnalytics

log = logging.getLogger("billing-api")

router = APIRouter(prefix="/billing", tags=["billing"])


# ── Request/Response Models ──


class CostSummaryResponse(BaseModel):
    """Cost summary for a period."""
    total_cost_usd: float
    request_count: int
    average_cost_per_request: float
    by_model: dict = Field(default_factory=dict)
    by_workflow: dict = Field(default_factory=dict)
    period_days: int


class BudgetRequest(BaseModel):
    """Budget limit request."""
    monthly_budget_usd: float
    alert_threshold_percent: float = 80.0
    hard_limit: bool = False


class BudgetResponse(BaseModel):
    """Budget status response."""
    has_budget: bool
    monthly_budget: Optional[float] = None
    spent: Optional[float] = None
    remaining: Optional[float] = None
    percent_used: Optional[float] = None
    should_alert: Optional[bool] = None
    over_budget: Optional[bool] = None


class CostItem(BaseModel):
    """Individual cost item."""
    request_id: str
    timestamp: str
    cost_usd: float
    model: str
    workflow_type: str
    input_tokens: int
    output_tokens: int
    status: str


class ForecastResponse(BaseModel):
    """Cost forecast prediction."""
    period_days: int
    predicted_cost: float
    confidence_level: float
    lower_bound: float
    upper_bound: float


class TrendData(BaseModel):
    """Trend data point."""
    date: str
    cost: float


class TrendResponse(BaseModel):
    """Trend analysis response."""
    period: str
    trend: str
    growth_rate_percent: float
    average_cost: float
    max_cost: float
    min_cost: float
    std_dev: float
    data: list[TrendData] = Field(default_factory=list)


class OptimizationItem(BaseModel):
    """Optimization recommendation."""
    title: str
    description: str
    potential_savings_usd: float
    potential_savings_percent: float
    priority: str
    implementation_difficulty: str
    estimated_implementation_hours: float


class OptimizationResponse(BaseModel):
    """Optimization recommendations response."""
    total_potential_savings_usd: float
    recommendations: list[OptimizationItem] = Field(
        default_factory=list
    )


class EfficiencyMetricsResponse(BaseModel):
    """Efficiency metrics response."""
    total_cost: float
    total_requests: int
    total_tokens: int
    successful_requests: int
    failed_requests: int
    success_rate: float
    cost_per_request: float
    cost_per_token: float
    tokens_per_request: float


class DailyCostResponse(BaseModel):
    """Daily cost breakdown."""
    date: str
    cost: float


class CostBreakdownResponse(BaseModel):
    """Detailed cost breakdown."""
    total_cost_usd: float
    period_days: int
    daily_costs: list[DailyCostResponse] = Field(default_factory=list)
    anomalies: list[dict] = Field(default_factory=list)


# ── Endpoint Implementations ──


@router.get("/costs", response_model=CostBreakdownResponse)
async def get_costs(
    tenant_id: str = Query(..., description="Tenant ID"),
    days: int = Query(30, ge=1, le=365, description="Days to retrieve"),
    include_anomalies: bool = Query(
        True, description="Include anomaly detection"
    ),
) -> CostBreakdownResponse:
    """
    Retrieve cost data for a tenant.

    Args:
        tenant_id: Tenant identifier
        days: Number of days to retrieve (1-365)
        include_anomalies: Whether to detect anomalies

    Returns:
        Cost breakdown with daily details and anomalies
    """
    try:
        tracker = get_tracker()
        analytics = CostAnalytics(tracker)

        daily_costs = tracker.get_daily_costs(tenant_id, days)

        daily_items = [
            DailyCostResponse(date=date, cost=cost)
            for date, cost in sorted(daily_costs.items())
        ]

        anomalies = []
        if include_anomalies:
            anomaly_list = analytics.detect_anomalies(
                tenant_id, days=days
            )
            anomalies = [
                {
                    "date": date,
                    "cost": cost,
                    "severity": severity,
                }
                for date, cost, severity in anomaly_list
            ]

        total_cost = sum(cost for _, cost in daily_costs.items())

        return CostBreakdownResponse(
            total_cost_usd=total_cost,
            period_days=days,
            daily_costs=daily_items,
            anomalies=anomalies,
        )

    except Exception as e:
        log.error(f"Error retrieving costs: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve costs"
        )


@router.get("/forecast", response_model=ForecastResponse)
async def forecast_costs(
    tenant_id: str = Query(..., description="Tenant ID"),
    forecast_days: int = Query(30, ge=1, le=365),
    historical_days: int = Query(90, ge=7, le=365),
) -> ForecastResponse:
    """
    Forecast future costs using linear regression.

    Args:
        tenant_id: Tenant identifier
        forecast_days: Days to forecast
        historical_days: Historical data to use

    Returns:
        Cost forecast with confidence intervals
    """
    try:
        tracker = get_tracker()
        analytics = CostAnalytics(tracker)

        forecast = analytics.forecast_cost(
            tenant_id,
            forecast_days=forecast_days,
            historical_days=historical_days,
        )

        if not forecast:
            raise HTTPException(
                status_code=400,
                detail="Insufficient data for forecasting",
            )

        return ForecastResponse(
            period_days=forecast.period_days,
            predicted_cost=forecast.predicted_cost,
            confidence_level=forecast.confidence_level,
            lower_bound=forecast.lower_bound,
            upper_bound=forecast.upper_bound,
        )

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error forecasting costs: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to forecast costs"
        )


@router.get("/budget", response_model=BudgetResponse)
async def get_budget(
    tenant_id: str = Query(..., description="Tenant ID"),
) -> BudgetResponse:
    """
    Get current budget status for a tenant.

    Args:
        tenant_id: Tenant identifier

    Returns:
        Current budget status and spending
    """
    try:
        tracker = get_tracker()
        status = tracker.check_budget_status(tenant_id)

        return BudgetResponse(**status)

    except Exception as e:
        log.error(f"Error retrieving budget: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve budget"
        )


@router.put("/budget", response_model=BudgetResponse)
async def set_budget(
    tenant_id: str = Query(..., description="Tenant ID"),
    request: BudgetRequest = None,
) -> BudgetResponse:
    """
    Set budget limit for a tenant.

    Args:
        tenant_id: Tenant identifier
        request: Budget configuration

    Returns:
        Updated budget status
    """
    if not request:
        raise HTTPException(status_code=400, detail="Request body required")

    try:
        tracker = get_tracker()

        tracker.set_budget(
            tenant_id,
            monthly_budget_usd=request.monthly_budget_usd,
            alert_threshold_percent=request.alert_threshold_percent,
            hard_limit=request.hard_limit,
        )

        status = tracker.check_budget_status(tenant_id)

        return BudgetResponse(**status)

    except Exception as e:
        log.error(f"Error setting budget: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to set budget"
        )


@router.get("/optimize", response_model=OptimizationResponse)
async def get_optimization_suggestions(
    tenant_id: str = Query(..., description="Tenant ID"),
    days: int = Query(30, ge=1, le=365),
) -> OptimizationResponse:
    """
    Get cost optimization recommendations.

    Args:
        tenant_id: Tenant identifier
        days: Days of data to analyze

    Returns:
        List of optimization recommendations ranked by savings
    """
    try:
        tracker = get_tracker()
        analytics = CostAnalytics(tracker)

        recommendations = (
            analytics.get_optimization_recommendations(
                tenant_id, days=days
            )
        )

        items = [
            OptimizationItem(
                title=rec.title,
                description=rec.description,
                potential_savings_usd=rec.potential_savings_usd,
                potential_savings_percent=rec.potential_savings_percent,
                priority=rec.priority,
                implementation_difficulty=rec.implementation_difficulty,
                estimated_implementation_hours=rec.estimated_implementation_hours,
            )
            for rec in recommendations
        ]

        total_savings = sum(
            item.potential_savings_usd for item in items
        )

        return OptimizationResponse(
            total_potential_savings_usd=total_savings,
            recommendations=items,
        )

    except Exception as e:
        log.error(f"Error generating optimization suggestions: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate suggestions",
        )


@router.get("/reports", response_model=CostSummaryResponse)
async def generate_report(
    tenant_id: str = Query(..., description="Tenant ID"),
    days: int = Query(30, ge=1, le=365),
) -> CostSummaryResponse:
    """
    Generate cost summary report.

    Args:
        tenant_id: Tenant identifier
        days: Number of days to include

    Returns:
        Cost summary report
    """
    try:
        tracker = get_tracker()
        summary = tracker.get_cost_summary(tenant_id, days)

        return CostSummaryResponse(**summary)

    except Exception as e:
        log.error(f"Error generating report: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to generate report"
        )


@router.get("/trends", response_model=TrendResponse)
async def analyze_trends(
    tenant_id: str = Query(..., description="Tenant ID"),
    period: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    days: int = Query(30, ge=1, le=365),
) -> TrendResponse:
    """
    Analyze cost trends over time.

    Args:
        tenant_id: Tenant identifier
        period: 'daily', 'weekly', or 'monthly'
        days: Number of days to analyze

    Returns:
        Trend analysis with data points
    """
    try:
        tracker = get_tracker()
        analytics = CostAnalytics(tracker)

        trend = analytics.analyze_trend(
            tenant_id, period=period, days=days
        )

        if not trend:
            raise HTTPException(
                status_code=400,
                detail="Insufficient data for trend analysis",
            )

        data_items = [
            TrendData(date=date, cost=cost)
            for date, cost in trend.data_points
        ]

        return TrendResponse(
            period=trend.period,
            trend=trend.trend,
            growth_rate_percent=trend.growth_rate_percent,
            average_cost=trend.average_cost,
            max_cost=trend.max_cost,
            min_cost=trend.min_cost,
            std_dev=trend.std_dev,
            data=data_items,
        )

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error analyzing trends: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to analyze trends"
        )


@router.get("/efficiency", response_model=EfficiencyMetricsResponse)
async def get_efficiency_metrics(
    tenant_id: str = Query(..., description="Tenant ID"),
    days: int = Query(30, ge=1, le=365),
) -> EfficiencyMetricsResponse:
    """
    Get efficiency metrics for a tenant.

    Args:
        tenant_id: Tenant identifier
        days: Number of days to analyze

    Returns:
        Efficiency metrics (cost per token, success rate, etc.)
    """
    try:
        tracker = get_tracker()
        analytics = CostAnalytics(tracker)

        metrics = analytics.get_efficiency_metrics(
            tenant_id, days=days
        )

        return EfficiencyMetricsResponse(**metrics)

    except Exception as e:
        log.error(f"Error calculating efficiency metrics: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to calculate efficiency metrics",
        )


@router.post("/check-budget")
async def check_request_allowed(
    tenant_id: str = Query(..., description="Tenant ID"),
):
    """
    Check if a request can proceed based on budget constraints.

    Args:
        tenant_id: Tenant identifier

    Returns:
        Dict with allowed flag and reason
    """
    try:
        tracker = get_tracker()
        allowed, reason = tracker.can_process_request(tenant_id)

        return {
            "allowed": allowed,
            "reason": reason,
        }

    except Exception as e:
        log.error(f"Error checking budget: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to check budget"
        )
