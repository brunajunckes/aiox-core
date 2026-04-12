#!/usr/bin/env python3
"""
IDS Decision Engine — Pre-check registry for REUSE/ADAPT/CREATE

Queries consolidated registries to find existing artifacts before creating new ones.
Returns: (decision, candidate_id, rationale)
"""

import json
import sys
from pathlib import Path
from difflib import SequenceMatcher

class IDSDecisionEngine:
    def __init__(self, registry_path="/root/.aiox-core/data/registries"):
        self.registry_path = Path(registry_path)
        self.entities = self._load_registries()

    def _load_registries(self):
        """Load all consolidated registries into single searchable index."""
        entities = {
            "agents": [],
            "tasks": [],
            "workflows": [],
            "templates": [],
            "components": [],
            "squads": []
        }

        try:
            # Load agent registry
            agents_file = self.registry_path / "agents-master-registry.json"
            if agents_file.exists():
                with open(agents_file) as f:
                    data = json.load(f)
                    entities["agents"] = data if isinstance(data, list) else data.get("agents", [])

            # Load squad registry
            squads_file = self.registry_path / "squads-master-registry.json"
            if squads_file.exists():
                with open(squads_file) as f:
                    data = json.load(f)
                    entities["squads"] = data if isinstance(data, list) else data.get("squads", [])

            # Load workflows registry
            workflows_file = self.registry_path / "workflows-master-registry.json"
            if workflows_file.exists():
                with open(workflows_file) as f:
                    data = json.load(f)
                    entities["workflows"] = data if isinstance(data, list) else data.get("workflows", [])

        except Exception as e:
            print(f"⚠️  Registry load warning: {e}", file=sys.stderr)

        return entities

    def _similarity(self, text1, text2):
        """Calculate text similarity score 0-1.0."""
        if not text1 or not text2:
            return 0.0
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()

    def _search_entity(self, intent, entity_list, threshold):
        """Search entity list for matches above threshold."""
        matches = []

        for entity in entity_list:
            name = entity.get("name") or entity.get("id") or ""
            description = entity.get("description") or ""
            keywords = " ".join([name, description])

            score = self._similarity(intent, keywords)

            if score >= threshold:
                matches.append({
                    "entity": entity,
                    "score": score,
                    "id": entity.get("id") or name
                })

        return sorted(matches, key=lambda x: x["score"], reverse=True)

    def decide(self, intent, entity_type="agent"):
        """
        Decide: REUSE (100% match) > ADAPT (80%+) > CREATE (no match)

        Args:
            intent: What you want to create/modify
            entity_type: "agent", "task", "workflow", "squad", etc.

        Returns:
            {
                "decision": "REUSE" | "ADAPT" | "CREATE",
                "candidate": entity_dict or None,
                "candidate_id": str or None,
                "rationale": str,
                "alternatives": [...]
            }
        """

        # Normalize entity type
        entity_type = entity_type.lower()
        if entity_type not in self.entities:
            entity_type = "agents"  # default

        entity_list = self.entities[entity_type]

        # Search exact match (100%)
        exact = self._search_entity(intent, entity_list, 1.0)
        if exact:
            return {
                "decision": "REUSE",
                "candidate": exact[0]["entity"],
                "candidate_id": exact[0]["id"],
                "rationale": f"Exact match found: {exact[0]['id']} (similarity: {exact[0]['score']:.1%})",
                "alternatives": []
            }

        # Search partial match (80%+)
        partial = self._search_entity(intent, entity_list, 0.80)
        if partial:
            top = partial[0]
            alternatives = partial[1:3]  # Top 2 alternatives
            return {
                "decision": "ADAPT",
                "candidate": top["entity"],
                "candidate_id": top["id"],
                "rationale": f"Can adapt existing: {top['id']} (similarity: {top['score']:.1%})",
                "alternatives": [
                    {"id": alt["id"], "score": alt["score"]}
                    for alt in alternatives
                ]
            }

        # No match - create new
        return {
            "decision": "CREATE",
            "candidate": None,
            "candidate_id": None,
            "rationale": f"No suitable match found for '{intent}' in {entity_type} registry. Proceed with creation.",
            "alternatives": []
        }

def main():
    if len(sys.argv) < 2:
        print("Usage: ids-decision-engine.py '<intent>' [entity_type]")
        print("Example: ids-decision-engine.py 'Create a story validator' task")
        sys.exit(1)

    intent = sys.argv[1]
    entity_type = sys.argv[2] if len(sys.argv) > 2 else "agent"

    engine = IDSDecisionEngine()
    result = engine.decide(intent, entity_type)

    # Output as JSON for integration
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
