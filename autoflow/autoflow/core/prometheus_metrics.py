"""
Prometheus Metrics for AutoFlow
================================

Exports metrics in Prometheus format for Grafana/Prometheus scraping.
Tracks: workflows, models, costs, performance, errors.
"""
import json
import os
from datetime import datetime
from typing import Dict


class PrometheusMetrics:
    """Prometheus metrics collector for AutoFlow."""

    def __init__(self):
        self.task_log = "/var/log/autoflow-tasks.jsonl"
        self.routing_log = "/var/log/autoflow-routing.jsonl"

    def read_task_logs(self) -> list:
        """Read all task logs."""
        logs = []
        if os.path.exists(self.task_log):
            try:
                with open(self.task_log, "r") as f:
                    for line in f:
                        try:
                            logs.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass
            except Exception as e:
                print(f"Error reading task logs: {e}")
        return logs

    def read_routing_logs(self) -> list:
        """Read all routing logs."""
        logs = []
        if os.path.exists(self.routing_log):
            try:
                with open(self.routing_log, "r") as f:
                    for line in f:
                        try:
                            logs.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass
            except Exception as e:
                print(f"Error reading routing logs: {e}")
        return logs

    def generate_prometheus_output(self) -> str:
        """Generate Prometheus-format metrics output."""
        task_logs = self.read_task_logs()
        routing_logs = self.read_routing_logs()

        lines = []
        lines.append("# HELP autoflow_workflows_total Total number of workflows executed")
        lines.append("# TYPE autoflow_workflows_total counter")
        lines.append(f"autoflow_workflows_total {len(task_logs)}")

        lines.append("\n# HELP autoflow_cost_usd_total Cumulative cost in USD (always 0 for Ollama)")
        lines.append("# TYPE autoflow_cost_usd_total gauge")
        total_cost = sum(log.get("cost_usd", 0) for log in task_logs)
        lines.append(f"autoflow_cost_usd_total {total_cost}")

        lines.append("\n# HELP autoflow_ollama_calls_total Number of Ollama calls")
        lines.append("# TYPE autoflow_ollama_calls_total counter")
        ollama_calls = sum(1 for log in task_logs if log.get("model") == "qwen2_5_fast")
        lines.append(f"autoflow_ollama_calls_total {ollama_calls}")

        lines.append("\n# HELP autoflow_average_response_length_chars Average response length")
        lines.append("# TYPE autoflow_average_response_length_chars gauge")
        if task_logs:
            avg_response = sum(log.get("response_chars", 0) for log in task_logs) / len(task_logs)
            lines.append(f"autoflow_average_response_length_chars {avg_response:.0f}")

        # Model breakdown
        models_used: Dict[str, int] = {}
        for log in task_logs:
            model = log.get("model", "unknown")
            models_used[model] = models_used.get(model, 0) + 1

        lines.append("\n# HELP autoflow_model_calls_total Calls per model")
        lines.append("# TYPE autoflow_model_calls_total counter")
        for model, count in sorted(models_used.items()):
            lines.append(f'autoflow_model_calls_total{{model="{model}"}} {count}')

        # Routing decisions
        if routing_logs:
            simple_tasks = sum(1 for log in routing_logs if log.get("complexity") == "SIMPLE")
            standard_tasks = sum(1 for log in routing_logs if log.get("complexity") == "STANDARD")
            complex_tasks = sum(1 for log in routing_logs if log.get("complexity") == "COMPLEX")

            lines.append("\n# HELP autoflow_task_complexity Task complexity distribution")
            lines.append("# TYPE autoflow_task_complexity gauge")
            lines.append(f'autoflow_task_complexity{{complexity="SIMPLE"}} {simple_tasks}')
            lines.append(f'autoflow_task_complexity{{complexity="STANDARD"}} {standard_tasks}')
            lines.append(f'autoflow_task_complexity{{complexity="COMPLEX"}} {complex_tasks}')

        return "\n".join(lines)

    def get_metrics_dict(self) -> Dict:
        """Get metrics as structured dict."""
        task_logs = self.read_task_logs()
        routing_logs = self.read_routing_logs()

        metrics = {
            "timestamp": datetime.utcnow().isoformat(),
            "workflows_executed": len(task_logs),
            "total_cost_usd": sum(log.get("cost_usd", 0) for log in task_logs),
            "ollama_calls": sum(1 for log in task_logs if log.get("model") == "qwen2_5_fast"),
            "average_response_length": 0,
            "models": {},
            "complexity_breakdown": {
                "SIMPLE": 0,
                "STANDARD": 0,
                "COMPLEX": 0,
            }
        }

        if task_logs:
            metrics["average_response_length"] = (
                sum(log.get("response_chars", 0) for log in task_logs) / len(task_logs)
            )
            for log in task_logs:
                model = log.get("model", "unknown")
                metrics["models"][model] = metrics["models"].get(model, 0) + 1

        if routing_logs:
            for log in routing_logs:
                complexity = log.get("complexity", "STANDARD")
                if complexity in metrics["complexity_breakdown"]:
                    metrics["complexity_breakdown"][complexity] += 1

        return metrics


def get_metrics_handler() -> PrometheusMetrics:
    """Get or create global metrics handler."""
    global _metrics
    if "_metrics" not in globals():
        _metrics = PrometheusMetrics()
    return _metrics
