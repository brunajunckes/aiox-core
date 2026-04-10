"""
Alerting System for AutoFlow
=============================

Sends alerts when workflows fail or have issues.
Tracks failure patterns and escalates if needed.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List

log = logging.getLogger("autoflow-alerting")


class FailureTracker:
    """Track workflow failures and escalate alerts."""

    def __init__(self, alert_log: str = "/var/log/autoflow-alerts.jsonl"):
        self.alert_log = alert_log
        self.failure_window = 5  # minutes
        self.failure_threshold = 3  # 3 failures in window = alert

    def record_failure(
        self,
        job_id: str,
        workflow_type: str,
        topic: str,
        error: str,
        severity: str = "WARN"
    ) -> bool:
        """
        Record a workflow failure.

        Returns True if alert threshold exceeded.
        """
        alert = {
            "timestamp": datetime.utcnow().isoformat(),
            "job_id": job_id,
            "workflow_type": workflow_type,
            "topic": topic,
            "error": error,
            "severity": severity,
        }

        try:
            with open(self.alert_log, "a") as f:
                f.write(json.dumps(alert) + "\n")
        except Exception as e:
            log.warning(f"Failed to write alert: {e}")

        # Check if we've exceeded failure threshold
        return self._check_threshold()

    def _check_threshold(self) -> bool:
        """Check if failure threshold exceeded in time window."""
        try:
            cutoff = datetime.utcnow() - timedelta(minutes=self.failure_window)
            failures = 0

            with open(self.alert_log, "r") as f:
                for line in f:
                    try:
                        alert = json.loads(line)
                        timestamp = datetime.fromisoformat(alert["timestamp"])
                        if timestamp > cutoff:
                            failures += 1
                    except (json.JSONDecodeError, ValueError):
                        pass

            return failures >= self.failure_threshold

        except FileNotFoundError:
            return False

    def get_recent_failures(self, minutes: int = 60) -> List[Dict]:
        """Get failures from last N minutes."""
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        failures = []

        try:
            with open(self.alert_log, "r") as f:
                for line in f:
                    try:
                        alert = json.loads(line)
                        timestamp = datetime.fromisoformat(alert["timestamp"])
                        if timestamp > cutoff:
                            failures.append(alert)
                    except (json.JSONDecodeError, ValueError):
                        pass
        except FileNotFoundError:
            pass

        return sorted(failures, key=lambda x: x["timestamp"], reverse=True)

    def get_failure_summary(self) -> Dict:
        """Get summary of recent failures."""
        failures = self.get_recent_failures(minutes=60)

        summary = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_failures_1h": len(failures),
            "by_workflow_type": {},
            "by_severity": {},
            "recent_errors": [],
        }

        for failure in failures:
            wf_type = failure.get("workflow_type", "unknown")
            severity = failure.get("severity", "WARN")

            summary["by_workflow_type"][wf_type] = summary["by_workflow_type"].get(wf_type, 0) + 1
            summary["by_severity"][severity] = summary["by_severity"].get(severity, 0) + 1

        # Get top errors
        error_counts: Dict[str, int] = {}
        for failure in failures:
            error = failure.get("error", "unknown")[:100]  # Truncate for summary
            error_counts[error] = error_counts.get(error, 0) + 1

        summary["recent_errors"] = sorted(
            [{"error": e, "count": c} for e, c in error_counts.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:5]

        return summary


# Global instance
_failure_tracker: Optional[FailureTracker] = None


def get_failure_tracker() -> FailureTracker:
    """Get or create global failure tracker."""
    global _failure_tracker
    if _failure_tracker is None:
        _failure_tracker = FailureTracker()
    return _failure_tracker


def should_alert_on_failure(error: str) -> bool:
    """Determine if an error should trigger an alert."""
    critical_keywords = [
        "timeout",
        "connection error",
        "validation failed",
        "invalid json",
        "out of memory",
        "disk full",
    ]

    error_lower = error.lower()
    for keyword in critical_keywords:
        if keyword in error_lower:
            return True

    return False


def format_alert_message(job_id: str, workflow_type: str, topic: str, error: str) -> str:
    """Format alert message for notifications."""
    return f"""
🚨 AutoFlow Workflow Failed

Job ID: {job_id}
Type: {workflow_type}
Topic: {topic}
Error: {error}
Time: {datetime.utcnow().isoformat()}

This may require manual investigation.
"""
