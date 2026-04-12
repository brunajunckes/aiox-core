#!/usr/bin/env python3
"""
Task Classifier — Auto-classify any task by domain, complexity, urgency, specialization

Extracts metadata from task description and recommends best agent/squad.
Returns: domain, complexity, specialist, recommended_squad, confidence_score
"""

import json
import sys
from pathlib import Path

class TaskClassifier:
    # Domain mapping: keywords → domain
    DOMAIN_KEYWORDS = {
        "frontend": ["ui", "component", "react", "css", "button", "form", "layout", "design", "page", "screen"],
        "backend": ["api", "endpoint", "route", "database", "server", "handler", "middleware", "auth", "logic"],
        "database": ["schema", "migration", "query", "table", "index", "rls", "constraint", "column", "row"],
        "devops": ["ci", "cd", "deploy", "pipeline", "docker", "kubernetes", "git", "push", "release", "build"],
        "testing": ["test", "unit", "integration", "coverage", "mock", "stub", "spy", "fixture", "assert"],
        "documentation": ["doc", "readme", "guide", "comment", "javadoc", "api-doc", "changelog"],
        "architecture": ["design", "pattern", "structure", "refactor", "modularity", "dependency", "layer"],
        "security": ["auth", "encryption", "password", "token", "permission", "access", "vulnerability", "owasp"],
        "performance": ["optimize", "cache", "speed", "memory", "latency", "throughput", "profiling"],
        "research": ["investigate", "research", "analysis", "understand", "explore", "learn", "spike"],
    }

    # Complexity factors (0-5 scale)
    COMPLEXITY_FACTORS = {
        "simple_keywords": ["simple", "easy", "basic", "trivial", "small", "quick", "typo", "fix"],
        "complex_keywords": ["complex", "integration", "cross-module", "multi-service", "distributed", "advanced"],
        "urgent_keywords": ["urgent", "critical", "emergency", "asap", "blocking", "downtime", "production-issue"],
    }

    # Specialist mapping: domain → agent
    SPECIALISTS = {
        "frontend": {"agent": "@ux-design-expert", "squad": "frontend-squad", "points": 8},
        "backend": {"agent": "@dev", "squad": "backend-squad", "points": 13},
        "database": {"agent": "@data-engineer", "squad": "database-squad", "points": 8},
        "devops": {"agent": "@devops", "squad": "devops-squad", "points": 5},
        "testing": {"agent": "@qa", "squad": "qa-squad", "points": 5},
        "documentation": {"agent": "@aiox-master", "squad": "docs-squad", "points": 3},
        "architecture": {"agent": "@architect", "squad": "architecture-squad", "points": 8},
        "security": {"agent": "@architect", "squad": "security-squad", "points": 13},
        "performance": {"agent": "@architect", "squad": "performance-squad", "points": 8},
        "research": {"agent": "@analyst", "squad": "research-squad", "points": 5},
    }

    def __init__(self):
        pass

    def _extract_domain(self, text):
        """Identify primary domain from task description."""
        text_lower = text.lower()
        domain_scores = {}

        for domain, keywords in self.DOMAIN_KEYWORDS.items():
            matches = sum(1 for kw in keywords if kw in text_lower)
            if matches > 0:
                domain_scores[domain] = matches

        # Return highest scoring domain
        if domain_scores:
            primary = max(domain_scores, key=domain_scores.get)
            return primary, domain_scores[primary]

        return "general", 0

    def _estimate_complexity(self, text):
        """Estimate complexity 1-5 from task description."""
        text_lower = text.lower()
        complexity = 2  # Default: medium

        # Check for simple indicators
        simple_matches = sum(1 for kw in self.COMPLEXITY_FACTORS["simple_keywords"] if kw in text_lower)
        if simple_matches > 0:
            complexity = 1

        # Check for complex indicators
        complex_matches = sum(1 for kw in self.COMPLEXITY_FACTORS["complex_keywords"] if kw in text_lower)
        if complex_matches > 0:
            complexity = 4

        # Rough heuristic: longer descriptions → more complex
        word_count = len(text.split())
        if word_count > 100:
            complexity = min(5, complexity + 1)
        elif word_count < 20:
            complexity = max(1, complexity - 1)

        return min(5, max(1, complexity))

    def _estimate_urgency(self, text):
        """Estimate urgency 1-5 from task description."""
        text_lower = text.lower()
        urgency = 2  # Default: normal

        urgent_matches = sum(1 for kw in self.COMPLEXITY_FACTORS["urgent_keywords"] if kw in text_lower)
        if urgent_matches > 0:
            urgency = 4

        return urgency

    def classify(self, task_description):
        """
        Classify task and recommend specialist.

        Returns:
            {
                "domain": "frontend|backend|database|...",
                "complexity": 1-5,
                "urgency": 1-5,
                "specialist_agent": "@agent-name",
                "recommended_squad": "squad-name",
                "estimated_points": 3-13,
                "confidence": 0.0-1.0,
                "rationale": "str"
            }
        """

        domain, domain_match = self._extract_domain(task_description)
        complexity = self._estimate_complexity(task_description)
        urgency = self._estimate_urgency(task_description)

        # Confidence based on domain match strength
        confidence = min(1.0, max(0.5, domain_match / 3.0))

        specialist = self.SPECIALISTS.get(domain, self.SPECIALISTS["general"] if "general" in self.SPECIALISTS else self.SPECIALISTS["backend"])

        return {
            "domain": domain,
            "complexity": complexity,
            "urgency": urgency,
            "specialist_agent": specialist.get("agent"),
            "recommended_squad": specialist.get("squad"),
            "estimated_points": specialist.get("points"),
            "confidence": confidence,
            "rationale": f"Task classified as {domain} (complexity {complexity}/5, urgency {urgency}/5). Recommending {specialist.get('agent')} from {specialist.get('squad')}."
        }

def main():
    if len(sys.argv) < 2:
        print("Usage: task-classifier.py '<task_description>'")
        print("Example: task-classifier.py 'Implement JWT authentication for API endpoints'")
        sys.exit(1)

    task_desc = sys.argv[1]

    classifier = TaskClassifier()
    result = classifier.classify(task_desc)

    # Output as JSON
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
