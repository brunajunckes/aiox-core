"""AutoFlow Features Module

Provides:
- A/B Testing Framework (ab_testing.py)
- Variant Management (variants.py)
- Feature Flags
- Experiment Tracking
"""

from .ab_testing import (
    Experiment,
    ExperimentConfig,
    ExperimentStatus,
    Metric,
    MetricType,
    Variant,
    VariantAssigner,
    SampleSizeCalculator,
    StatisticalAnalyzer,
)

from .variants import (
    FeatureFlag,
    FeatureFlagManager,
    RolloutStrategy,
    TargetingOperator,
    TargetingRule,
    TargetingRuleSet,
    UserSegment,
    SegmentedRollout,
    GradualRollout,
)

__all__ = [
    # A/B Testing
    "Experiment",
    "ExperimentConfig",
    "ExperimentStatus",
    "Metric",
    "MetricType",
    "Variant",
    "VariantAssigner",
    "SampleSizeCalculator",
    "StatisticalAnalyzer",
    # Feature Flags
    "FeatureFlag",
    "FeatureFlagManager",
    "RolloutStrategy",
    # Targeting
    "TargetingOperator",
    "TargetingRule",
    "TargetingRuleSet",
    "UserSegment",
    "SegmentedRollout",
    "GradualRollout",
]
