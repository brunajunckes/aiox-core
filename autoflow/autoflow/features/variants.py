"""Variant allocation and user bucketing for A/B testing.

Provides:
- Variant allocation with rollout percentage support
- User bucketing with consistent hashing
- Targeting rules engine
- Feature flag evaluation
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
from .ab_testing import VariantAssigner


class TargetingOperator(Enum):
    """Operators for targeting rule evaluation."""
    EQUALS = "eq"
    NOT_EQUALS = "neq"
    GREATER_THAN = "gt"
    LESS_THAN = "lt"
    IN = "in"
    NOT_IN = "nin"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    REGEX_MATCH = "regex"


@dataclass
class TargetingRule:
    """Single condition in a targeting rules set."""
    attribute: str
    operator: TargetingOperator
    value: Any

    def evaluate(self, context: Dict[str, Any]) -> bool:
        """Evaluate rule against context."""
        if self.attribute not in context:
            return False

        context_value = context[self.attribute]

        if self.operator == TargetingOperator.EQUALS:
            return context_value == self.value
        elif self.operator == TargetingOperator.NOT_EQUALS:
            return context_value != self.value
        elif self.operator == TargetingOperator.GREATER_THAN:
            return context_value > self.value
        elif self.operator == TargetingOperator.LESS_THAN:
            return context_value < self.value
        elif self.operator == TargetingOperator.IN:
            return context_value in self.value
        elif self.operator == TargetingOperator.NOT_IN:
            return context_value not in self.value
        elif self.operator == TargetingOperator.CONTAINS:
            return self.value in str(context_value)
        elif self.operator == TargetingOperator.NOT_CONTAINS:
            return self.value not in str(context_value)
        elif self.operator == TargetingOperator.REGEX_MATCH:
            import re
            return bool(re.search(self.value, str(context_value)))

        return False


@dataclass
class TargetingRuleSet:
    """Set of targeting rules with AND/OR logic."""
    rules: List[TargetingRule] = field(default_factory=list)
    operator: str = "AND"  # AND or OR

    def evaluate(self, context: Dict[str, Any]) -> bool:
        """Evaluate rule set against context."""
        if not self.rules:
            return True

        if self.operator == "AND":
            return all(rule.evaluate(context) for rule in self.rules)
        else:  # OR
            return any(rule.evaluate(context) for rule in self.rules)


@dataclass
class AllocationRule:
    """Rule for variant allocation with conditions."""
    variant_id: str
    percentage: float
    targeting_rules: Optional[TargetingRuleSet] = None
    priority: int = 0  # Higher priority evaluated first


class RolloutStrategy:
    """Manages percentage-based rollout of variants."""

    def __init__(self, name: str):
        self.name = name
        self.allocation_rules: List[AllocationRule] = []

    def add_allocation(
        self,
        variant_id: str,
        percentage: float,
        targeting_rules: Optional[TargetingRuleSet] = None,
        priority: int = 0
    ) -> None:
        """Add an allocation rule."""
        if not 0 <= percentage <= 100:
            raise ValueError(f"Percentage must be 0-100, got {percentage}")

        rule = AllocationRule(
            variant_id=variant_id,
            percentage=percentage,
            targeting_rules=targeting_rules,
            priority=priority
        )
        self.allocation_rules.append(rule)

    def get_allocation(
        self,
        user_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """Get variant allocation for user based on rules."""
        context = context or {}

        # Sort by priority (descending)
        sorted_rules = sorted(self.allocation_rules, key=lambda r: r.priority, reverse=True)

        for rule in sorted_rules:
            # Check targeting rules
            if rule.targeting_rules and not rule.targeting_rules.evaluate(context):
                continue

            # Check percentage allocation
            bucket = VariantAssigner.get_bucket(user_id, num_buckets=10000)
            percentage_bucket = (bucket / 10000.0) * 100.0

            if percentage_bucket < rule.percentage:
                return rule.variant_id

        return None


class FeatureFlag:
    """Represents a feature flag with rollout strategy."""

    def __init__(
        self,
        flag_id: str,
        name: str,
        description: str = "",
        enabled: bool = False
    ):
        self.flag_id = flag_id
        self.name = name
        self.description = description
        self.enabled = enabled
        self.rollout_strategy = RolloutStrategy(name)
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.metadata: Dict[str, Any] = {}

    def enable(self) -> None:
        """Enable the feature flag."""
        self.enabled = True
        self.updated_at = datetime.now()

    def disable(self) -> None:
        """Disable the feature flag."""
        self.enabled = False
        self.updated_at = datetime.now()

    def is_enabled_for_user(
        self,
        user_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Check if feature is enabled for user."""
        if not self.enabled:
            return False

        # Check rollout strategy
        variant = self.rollout_strategy.get_allocation(user_id, context)
        return variant is not None

    def get_variant(
        self,
        user_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """Get variant for user if flag is enabled."""
        if not self.is_enabled_for_user(user_id, context):
            return None

        return self.rollout_strategy.get_allocation(user_id, context)


class FeatureFlagManager:
    """Manages multiple feature flags."""

    def __init__(self):
        self.flags: Dict[str, FeatureFlag] = {}
        self.metadata: Dict[str, Any] = {}

    def create_flag(
        self,
        flag_id: str,
        name: str,
        description: str = "",
        enabled: bool = False
    ) -> FeatureFlag:
        """Create a new feature flag."""
        if flag_id in self.flags:
            raise ValueError(f"Flag {flag_id} already exists")

        flag = FeatureFlag(flag_id, name, description, enabled)
        self.flags[flag_id] = flag
        return flag

    def get_flag(self, flag_id: str) -> Optional[FeatureFlag]:
        """Get a feature flag by ID."""
        return self.flags.get(flag_id)

    def delete_flag(self, flag_id: str) -> None:
        """Delete a feature flag."""
        if flag_id in self.flags:
            del self.flags[flag_id]

    def list_flags(self) -> List[FeatureFlag]:
        """List all feature flags."""
        return list(self.flags.values())

    def get_user_flags(
        self,
        user_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Optional[str]]:
        """Get all flags and their variants for a user."""
        result = {}
        for flag_id, flag in self.flags.items():
            if flag.is_enabled_for_user(user_id, context):
                result[flag_id] = flag.get_variant(user_id, context)
            else:
                result[flag_id] = None
        return result

    def is_flag_enabled(
        self,
        flag_id: str,
        user_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Check if flag is enabled for user."""
        flag = self.get_flag(flag_id)
        if not flag:
            return False
        return flag.is_enabled_for_user(user_id, context)


class UserSegment:
    """Represents a user segment for targeting."""

    def __init__(self, segment_id: str, name: str):
        self.segment_id = segment_id
        self.name = name
        self.targeting_rules = TargetingRuleSet()
        self.users: Set[str] = set()
        self.created_at = datetime.now()

    def add_rule(
        self,
        attribute: str,
        operator: TargetingOperator,
        value: Any
    ) -> None:
        """Add targeting rule to segment."""
        rule = TargetingRule(attribute, operator, value)
        self.targeting_rules.rules.append(rule)

    def add_user(self, user_id: str) -> None:
        """Manually add user to segment."""
        self.users.add(user_id)

    def remove_user(self, user_id: str) -> None:
        """Manually remove user from segment."""
        self.users.discard(user_id)

    def matches(self, user_id: str, context: Dict[str, Any]) -> bool:
        """Check if user matches segment."""
        # Check manual membership
        if user_id in self.users:
            return True

        # Check targeting rules
        return self.targeting_rules.evaluate(context)


class SegmentedRollout:
    """Rollout strategy targeting specific user segments."""

    def __init__(self):
        self.segments: Dict[str, UserSegment] = {}
        self.segment_variants: Dict[str, Dict[str, float]] = {}  # segment_id -> variant_id -> percentage

    def create_segment(self, segment_id: str, name: str) -> UserSegment:
        """Create a user segment."""
        segment = UserSegment(segment_id, name)
        self.segments[segment_id] = segment
        self.segment_variants[segment_id] = {}
        return segment

    def allocate_variant_to_segment(
        self,
        segment_id: str,
        variant_id: str,
        percentage: float
    ) -> None:
        """Allocate variant to segment with specific percentage."""
        if segment_id not in self.segments:
            raise ValueError(f"Segment {segment_id} not found")

        self.segment_variants[segment_id][variant_id] = percentage

    def get_variant_for_user(
        self,
        user_id: str,
        context: Dict[str, Any]
    ) -> Optional[str]:
        """Get variant for user based on segment membership."""
        # Find matching segment
        for segment_id, segment in self.segments.items():
            if segment.matches(user_id, context):
                # User is in this segment, get variant allocation
                variants = self.segment_variants.get(segment_id, {})
                total_percentage = sum(variants.values())

                if total_percentage == 0:
                    return None

                bucket = VariantAssigner.get_bucket(user_id, num_buckets=10000)
                percentage_bucket = (bucket / 10000.0) * 100.0

                cumulative = 0.0
                for variant_id, percentage in sorted(variants.items()):
                    cumulative += percentage
                    if percentage_bucket < cumulative:
                        return variant_id

        return None


class GradualRollout:
    """Gradually roll out feature to percentage of users."""

    def __init__(self, variant_id: str):
        self.variant_id = variant_id
        self.rollout_percentage = 0.0
        self.created_at = datetime.now()

    def set_percentage(self, percentage: float) -> None:
        """Set rollout percentage (0-100)."""
        if not 0 <= percentage <= 100:
            raise ValueError(f"Percentage must be 0-100, got {percentage}")
        self.rollout_percentage = percentage

    def is_user_included(self, user_id: str) -> bool:
        """Check if user is included in rollout."""
        bucket = VariantAssigner.get_bucket(user_id, num_buckets=10000)
        percentage_bucket = (bucket / 10000.0) * 100.0
        return percentage_bucket < self.rollout_percentage

    def get_rollout_status(self) -> Dict[str, Any]:
        """Get current rollout status."""
        return {
            "variant_id": self.variant_id,
            "percentage": self.rollout_percentage,
            "estimated_users_impacted": f"{self.rollout_percentage}%",
            "created_at": self.created_at.isoformat()
        }
