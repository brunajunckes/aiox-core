#!/usr/bin/env python3
"""
Feedback Loop — Record task outcomes and update agent confidence scores

Tracks: success/failure, quality rating (1-10), actual vs estimated time
Updates: agent_scores per domain with exponential moving average

Usage after task completion:
  feedback-loop.py task-123 @agent success 8 240 'backend'
  feedback-loop.py task-456 @devops failure 3 120 'devops'
"""

import json
import sys
from pathlib import Path
from datetime import datetime

class FeedbackLoop:
    def __init__(self, feedback_file="/root/.aiox-core/data/feedback-loop.json"):
        self.feedback_file = Path(feedback_file)
        self.data = self._load_feedback()

    def _load_feedback(self):
        """Load existing feedback data or create new."""
        if self.feedback_file.exists():
            try:
                with open(self.feedback_file) as f:
                    return json.load(f)
            except:
                pass

        # Default structure
        return {
            "version": "1.0",
            "last_updated": None,
            "agent_scores": {},  # {agent_id: {domain: {success_rate, quality_avg, speed_factor}}}
            "decisions": []      # [{task_id, agent, domain, verdict, quality, time_actual, time_estimated, timestamp}]
        }

    def _save_feedback(self):
        """Save feedback data to file."""
        self.feedback_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.feedback_file, 'w') as f:
            json.dump(self.data, f, indent=2)

    def record(self, task_id, agent_id, verdict, quality_rating, time_actual_min, domain="general"):
        """
        Record task outcome and update agent confidence.

        Args:
            task_id: Task identifier
            agent_id: Agent identifier (e.g., @dev)
            verdict: "success" or "failure"
            quality_rating: 1-10 score
            time_actual_min: Actual time spent (minutes)
            domain: Domain of work (backend, frontend, etc.)

        Returns:
            updated scores for agent in domain
        """

        # Normalize agent_id (remove @ if present)
        agent_id = agent_id.lstrip("@")

        # Add to decisions history
        decision = {
            "task_id": task_id,
            "agent": agent_id,
            "domain": domain,
            "verdict": verdict,
            "quality_rating": quality_rating,
            "time_actual_minutes": time_actual_min,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.data["decisions"].append(decision)

        # Initialize agent scores if needed
        if agent_id not in self.data["agent_scores"]:
            self.data["agent_scores"][agent_id] = {}

        if domain not in self.data["agent_scores"][agent_id]:
            self.data["agent_scores"][agent_id][domain] = {
                "success_rate": 0.5,
                "quality_avg": 5.0,
                "speed_factor": 1.0,
                "task_count": 0
            }

        scores = self.data["agent_scores"][agent_id][domain]

        # Update metrics using exponential moving average (EMA)
        # EMA = old_value × (1 - alpha) + new_value × alpha
        # alpha = 0.2 for relatively quick adaptation

        alpha = 0.2

        # Success rate: +0.5 for success, -0.1 for failure
        success_delta = 0.5 if verdict == "success" else -0.1
        scores["success_rate"] = scores["success_rate"] * (1 - alpha) + (scores["success_rate"] + success_delta) * alpha
        scores["success_rate"] = max(0.0, min(1.0, scores["success_rate"]))

        # Quality average: simple moving average of quality ratings
        if scores["task_count"] > 0:
            scores["quality_avg"] = (scores["quality_avg"] * scores["task_count"] + quality_rating) / (scores["task_count"] + 1)
        else:
            scores["quality_avg"] = quality_rating

        # Speed factor: ratio of actual to baseline (baseline = 120 min)
        baseline_min = 120
        speed_ratio = time_actual_min / baseline_min if baseline_min > 0 else 1.0
        scores["speed_factor"] = scores["speed_factor"] * (1 - alpha) + speed_ratio * alpha

        scores["task_count"] += 1
        scores["last_updated"] = datetime.utcnow().isoformat()

        self.data["last_updated"] = datetime.utcnow().isoformat()

        return scores

    def get_agent_stats(self, agent_id, domain=None):
        """Get stats for agent in domain or overall."""
        agent_id = agent_id.lstrip("@")

        if agent_id not in self.data["agent_scores"]:
            return None

        if domain:
            return self.data["agent_scores"][agent_id].get(domain)

        # Return all domains
        return self.data["agent_scores"][agent_id]

    def get_leaderboard(self, domain=None, top_n=10):
        """Get top N agents by success rate in domain."""
        agents_with_stats = []

        for agent_id, domains in self.data["agent_scores"].items():
            if domain and domain in domains:
                stats = domains[domain]
                agents_with_stats.append({
                    "agent_id": agent_id,
                    "domain": domain,
                    "success_rate": stats.get("success_rate"),
                    "quality_avg": stats.get("quality_avg"),
                    "task_count": stats.get("task_count")
                })
            elif not domain:
                # Overall score across all domains
                success_rates = [s.get("success_rate", 0.5) for s in domains.values()]
                avg_success = sum(success_rates) / len(success_rates) if success_rates else 0.5
                agents_with_stats.append({
                    "agent_id": agent_id,
                    "domain": "overall",
                    "success_rate": avg_success,
                    "quality_avg": sum(s.get("quality_avg", 5) for s in domains.values()) / len(domains),
                    "task_count": sum(s.get("task_count", 0) for s in domains.values())
                })

        # Sort by success rate
        agents_with_stats.sort(key=lambda x: x["success_rate"], reverse=True)
        return agents_with_stats[:top_n]

def main():
    if len(sys.argv) < 5:
        print("Usage: feedback-loop.py <task_id> <agent_id> <success|failure> <quality_1_10> <time_minutes> [domain]")
        print("Example: feedback-loop.py story-45.1 @dev success 9 240 backend")
        print("")
        print("Commands:")
        print("  record     - Record outcome (default)")
        print("  stats      - Get agent stats: feedback-loop.py stats @dev [domain]")
        print("  leaderboard - Get top agents: feedback-loop.py leaderboard [domain]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "stats":
        agent_id = sys.argv[2] if len(sys.argv) > 2 else None
        domain = sys.argv[3] if len(sys.argv) > 3 else None
        if not agent_id:
            print("Usage: feedback-loop.py stats <agent_id> [domain]")
            sys.exit(1)

        loop = FeedbackLoop()
        stats = loop.get_agent_stats(agent_id, domain)
        print(json.dumps(stats, indent=2))
        return

    if command == "leaderboard":
        domain = sys.argv[2] if len(sys.argv) > 2 else None
        loop = FeedbackLoop()
        board = loop.get_leaderboard(domain)
        print(json.dumps(board, indent=2))
        return

    # Default: record
    task_id = command  # First arg is task_id if command wasn't recognized
    agent_id = sys.argv[2]
    verdict = sys.argv[3]
    quality = int(sys.argv[4])
    time_min = int(sys.argv[5])
    domain = sys.argv[6] if len(sys.argv) > 6 else "general"

    loop = FeedbackLoop()
    result = loop.record(task_id, agent_id, verdict, quality, time_min, domain)
    loop._save_feedback()

    print(json.dumps({
        "task_id": task_id,
        "agent_id": agent_id,
        "updated_scores": result,
        "timestamp": datetime.utcnow().isoformat()
    }, indent=2))

if __name__ == "__main__":
    main()
