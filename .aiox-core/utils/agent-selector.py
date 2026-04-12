#!/usr/bin/env python3
"""
Agent Selector — Score and rank 300+ agents for task recommendation

Scoring formula: (SpecialtyMatch × 0.5) + (1 - CurrentLoad × 0.3) + (SuccessRate × 0.2)

Returns top 3 agents ranked by score.
"""

import json
import sys
from pathlib import Path

class AgentSelector:
    def __init__(self, registry_path="/root/.aiox-core/data/registries", feedback_file="/root/.aiox-core/data/feedback-loop.json"):
        self.registry_path = Path(registry_path)
        self.feedback_file = Path(feedback_file)
        self.agents = self._load_agents()
        self.feedback_data = self._load_feedback()

    def _load_agents(self):
        """Load agent registry."""
        agents = []
        try:
            agents_file = self.registry_path / "agents-master-registry.json"
            if agents_file.exists():
                with open(agents_file) as f:
                    data = json.load(f)
                    agents = data if isinstance(data, list) else data.get("agents", [])
        except Exception as e:
            print(f"⚠️  Warning loading agents: {e}", file=sys.stderr)

        return agents

    def _load_feedback(self):
        """Load feedback/success history data."""
        if not self.feedback_file.exists():
            return {"agent_scores": {}, "decisions": []}

        try:
            with open(self.feedback_file) as f:
                return json.load(f)
        except:
            return {"agent_scores": {}, "decisions": []}

    def _get_success_rate(self, agent_id, domain=None):
        """Get success rate for agent in domain (0.0-1.0)."""
        agent_scores = self.feedback_data.get("agent_scores", {})

        if agent_id not in agent_scores:
            return 0.6  # Default: neutral confidence

        scores = agent_scores[agent_id]

        if domain and domain in scores:
            return scores[domain].get("success_rate", 0.6)

        # Overall success rate
        all_rates = [s.get("success_rate", 0.6) for s in scores.values() if isinstance(s, dict)]
        return sum(all_rates) / len(all_rates) if all_rates else 0.6

    def _get_current_load(self, agent_id):
        """Estimate current load for agent (0.0-1.0)."""
        # Simplified: check how many recent decisions assigned to this agent
        decisions = self.feedback_data.get("decisions", [])

        recent = [d for d in decisions[-100:] if d.get("assigned_agent") == agent_id]

        # Load = (recent decisions / max_per_agent)
        # Assuming max_per_agent = 20
        return min(1.0, len(recent) / 20.0)

    def _calculate_specialty_match(self, agent, domain):
        """Calculate how well agent matches domain (0.0-1.0)."""
        agent_domains = agent.get("specialties", [])
        agent_skills = agent.get("skills", [])

        # Check if domain is in specialties
        if domain in agent_domains:
            return 1.0

        # Partial match if similar skills
        domain_keywords = domain.lower().split()
        skill_matches = sum(1 for skill in agent_skills if any(kw in skill.lower() for kw in domain_keywords))

        return min(1.0, skill_matches / max(1, len(domain_keywords)))

    def select(self, domain, specialist_requirement=None, top_n=3):
        """
        Score all agents and return top N ranked by suitability.

        Args:
            domain: Primary domain (e.g., "backend", "frontend")
            specialist_requirement: Optional agent ID that MUST be included
            top_n: Return top N agents (default 3)

        Returns:
            {
                "primary_recommendation": {...},
                "top_choices": [{agent, score, rationale}, ...],
                "rationale": str
            }
        """

        if not self.agents:
            return {
                "error": "No agents loaded",
                "primary_recommendation": None,
                "top_choices": [],
                "rationale": "Agent registry empty"
            }

        scored_agents = []

        for agent in self.agents:
            agent_id = agent.get("id") or agent.get("name")

            # Calculate components
            specialty_match = self._calculate_specialty_match(agent, domain)
            current_load = self._get_current_load(agent_id)
            success_rate = self._get_success_rate(agent_id, domain)

            # Scoring formula: (SpecialtyMatch × 0.5) + (1 - Load × 0.3) + (SuccessRate × 0.2)
            score = (specialty_match * 0.5) + ((1 - current_load) * 0.3) + (success_rate * 0.2)

            scored_agents.append({
                "agent": agent,
                "agent_id": agent_id,
                "score": score,
                "specialty_match": specialty_match,
                "load": current_load,
                "success_rate": success_rate,
                "rationale": f"Specialty match {specialty_match:.0%}, load {current_load:.0%}, success {success_rate:.0%}"
            })

        # Sort by score descending
        scored_agents.sort(key=lambda x: x["score"], reverse=True)

        # If specialist requirement, ensure it's in top choices
        if specialist_requirement:
            for agent in scored_agents:
                if agent["agent_id"] == specialist_requirement:
                    # Move to front
                    scored_agents.remove(agent)
                    scored_agents.insert(0, agent)
                    break

        # Top N choices
        top_choices = scored_agents[:top_n]

        primary = top_choices[0] if top_choices else None

        return {
            "primary_recommendation": {
                "agent": primary["agent"] if primary else None,
                "agent_id": primary["agent_id"] if primary else None,
                "score": primary["score"] if primary else 0.0
            },
            "top_choices": [
                {
                    "agent_id": a["agent_id"],
                    "agent_name": a["agent"].get("name"),
                    "score": a["score"],
                    "specialty_match": a["specialty_match"],
                    "load": a["load"],
                    "success_rate": a["success_rate"],
                    "rationale": a["rationale"]
                }
                for a in top_choices
            ],
            "rationale": f"Top {len(top_choices)} agents for {domain} domain selected based on specialty match, current load, and success history."
        }

def main():
    if len(sys.argv) < 2:
        print("Usage: agent-selector.py '<domain>' [specialist_requirement]")
        print("Example: agent-selector.py 'backend' '@dev'")
        sys.exit(1)

    domain = sys.argv[1]
    specialist = sys.argv[2] if len(sys.argv) > 2 else None

    selector = AgentSelector()
    result = selector.select(domain, specialist)

    print(json.dumps(result, indent=2, default=str))

if __name__ == "__main__":
    main()
