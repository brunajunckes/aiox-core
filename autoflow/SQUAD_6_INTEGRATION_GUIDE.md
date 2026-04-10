# Squad 6 Integration Guide

Quick steps to integrate cost tracking into AutoFlow.

## 1. Register Billing API (autoflow/api/server.py)

```python
# At the top with other imports
from autoflow.api.billing import router as billing_router

# In the main FastAPI app setup
app.include_router(billing_router)
```

## 2. Add Cost Tracking Middleware

In your request middleware, after a workflow completes:

```python
from autoflow.cost.tracking import get_tracker

# After request processing
tracker = get_tracker()
cost = tracker.track_request(
    request_id=request_id,
    tenant_id=tenant_id,  # Extract from request context
    workflow_type=workflow_type,  # e.g., "research", "seo"
    model=model_used,  # e.g., "gpt-4"
    input_tokens=input_token_count,
    output_tokens=output_token_count,
    duration_ms=elapsed_ms,
    gpu_type=gpu_type if gpu_used else None,  # Optional
    gpu_seconds=gpu_duration if gpu_used else 0,  # Optional
    status="completed" if success else "failed",
    metadata={"user_id": user_id, "custom": "data"},  # Optional
)

log.info(f"Request {request_id} cost: ${cost.cost_usd:.4f}")
```

## 3. Add Budget Check (Optional but Recommended)

Before processing expensive requests:

```python
from autoflow.cost.tracking import get_tracker

tracker = get_tracker()
allowed, reason = tracker.can_process_request(tenant_id)

if not allowed:
    raise HTTPException(
        status_code=429,
        detail=f"Budget limit exceeded: {reason}"
    )
```

## 4. Setup Database (Optional but Recommended)

For persistent storage:

```bash
# Run the migration
mysql -u root -p autoflow < database/migrations/add_cost_tracking.sql
```

Then modify `CostTracker` to use database persistence instead of in-memory storage (future enhancement).

## 5. Configure Budget Limits (Per Tenant)

```python
from autoflow.cost.tracking import get_tracker

tracker = get_tracker()

# Set budget for a tenant
tracker.set_budget(
    tenant_id="acme_corp",
    monthly_budget_usd=5000.0,
    alert_threshold_percent=80.0,
    hard_limit=True,  # Reject requests over budget
)
```

## 6. Monitor Costs

```python
# In admin dashboard or monitoring system
from autoflow.cost.tracking import get_tracker
from autoflow.cost.analytics import CostAnalytics

tracker = get_tracker()
analytics = CostAnalytics(tracker)

# Get summary
summary = tracker.get_cost_summary("acme_corp", days=30)
print(f"30-day cost: ${summary['total_cost_usd']:.2f}")

# Get trend
trend = analytics.analyze_trend("acme_corp", period="daily")
if trend:
    print(f"Trend: {trend.trend} ({trend.growth_rate_percent:.1f}%)")

# Get forecast
forecast = analytics.forecast_cost("acme_corp", forecast_days=30)
if forecast:
    print(f"Predicted 30-day cost: ${forecast.predicted_cost:.2f}")

# Get recommendations
recs = analytics.get_optimization_recommendations("acme_corp", days=30)
for rec in recs[:5]:
    print(f"{rec.title}: Save ${rec.potential_savings_usd:.2f}")
```

## 7. Expose Billing Endpoints

The API endpoints are automatically available after registering the router:

```bash
# User-facing endpoints
GET  /billing/costs          # View costs
GET  /billing/budget         # Check budget
GET  /billing/optimize       # Get recommendations
GET  /billing/trends         # View trends
GET  /billing/efficiency     # Efficiency metrics

# Admin endpoints
PUT  /billing/budget         # Set budget
GET  /billing/forecast       # Predict costs
GET  /billing/reports        # Generate reports
POST /billing/check-budget   # Check if request allowed
```

## Testing the Integration

```bash
# Test cost tracking
curl "http://localhost:8080/billing/costs?tenant_id=test_tenant&days=30"

# Test budget check
curl -X POST "http://localhost:8080/billing/check-budget?tenant_id=test_tenant"

# Test recommendations
curl "http://localhost:8080/billing/optimize?tenant_id=test_tenant&days=30"

# Test forecast
curl "http://localhost:8080/billing/forecast?tenant_id=test_tenant&forecast_days=30"
```

## Configuration (Optional)

Add to `core-config.yaml`:

```yaml
cost_tracking:
  enabled: true
  currency: USD
  
  # Pricing (can be overridden)
  model_pricing:
    gpt-4:
      input: 0.03    # per 1M tokens
      output: 0.06   # per 1M tokens
    gpt-3.5-turbo:
      input: 0.0005
      output: 0.0015
  
  # Budget defaults
  default_alert_threshold: 80.0
  
  # Tracking
  enable_persistent_storage: false  # Set true after DB setup
  cleanup_old_requests_days: 90
```

## Monitoring & Alerts

Set up alerts for:

```python
# Monitor budget warnings
if status["should_alert"]:
    send_alert(f"Tenant {tenant_id} at {status['percent_used']:.0f}% of budget")

# Monitor cost spikes
anomalies = analytics.detect_anomalies(tenant_id)
if anomalies:
    for date, cost, severity in anomalies:
        send_alert(f"Cost spike on {date}: ${cost:.2f} ({severity})")

# Monitor cost increase
trend = analytics.analyze_trend(tenant_id)
if trend and trend.growth_rate_percent > 20:
    send_alert(f"Costs increasing at {trend.growth_rate_percent:.1f}%/period")
```

## Troubleshooting

**Issue: Costs not being tracked**
- Verify middleware is calling `tracker.track_request()`
- Check that `request_id`, `tenant_id`, `model` are correct
- Enable debug logging: `logging.getLogger("cost-tracking").setLevel(logging.DEBUG)`

**Issue: Budget enforcement not working**
- Verify `hard_limit=True` is set
- Check `can_process_request()` is called before processing
- Ensure current month is being checked correctly

**Issue: Forecast returns None**
- Requires at least 2 days of historical data
- Try `historical_days=7` for more data
- Check for sufficient requests in the period

**Issue: No anomalies detected**
- Reduce `threshold_std_dev` from 2.0 to 1.5
- Requires variance in daily costs (same cost every day = no anomalies)
- Check actual cost values are correct

## Performance Tips

1. **Call `track_request()` asynchronously** if tracking adds latency
   ```python
   async def track_in_background():
       tracker.track_request(...)
   
   asyncio.create_task(track_in_background())
   ```

2. **Cache summaries** for frequently requested tenants
   ```python
   @cache.cached(timeout=3600)
   def get_cached_summary(tenant_id):
       return tracker.get_cost_summary(tenant_id)
   ```

3. **Batch analytics queries** when possible
   ```python
   summaries = {tid: tracker.get_cost_summary(tid) 
                for tid in tenant_list}
   ```

4. **Archive old requests** after persistence is implemented
   - Keep only 90 days in-memory
   - Archive older data to database

## Support

For questions or issues:
1. Check logs: `tail -f logs/autoflow.log | grep cost`
2. Review test cases: `tests/test_cost_tracking.py`
3. Check docstrings: `python -c "from autoflow.cost.tracking import CostTracker; help(CostTracker)"`

---

**Integration complete! Squad 6 is ready to track and optimize costs.**
