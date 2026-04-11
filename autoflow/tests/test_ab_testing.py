"""Comprehensive tests for A/B testing framework.

Test coverage:
- Variant assignment with deterministic hashing
- Statistical significance tests (Chi-square, t-test)
- Sample size calculations
- Confidence intervals
- Edge cases and boundary conditions
"""

import pytest
import math
from datetime import datetime, timedelta
from autoflow.features.ab_testing import (
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
from autoflow.features.variants import (
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


class TestVariantAssignment:
    """Test deterministic variant assignment."""

    def test_consistent_assignment(self):
        """Same user should get same variant for same experiment."""
        variants = [
            Variant(id="control", name="Control", percentage=50),
            Variant(id="treatment", name="Treatment", percentage=50),
        ]

        variant1 = VariantAssigner.get_variant("user_123", variants, "exp_001")
        variant2 = VariantAssigner.get_variant("user_123", variants, "exp_001")

        assert variant1.id == variant2.id

    def test_variant_distribution(self):
        """Variants should be distributed according to percentages."""
        variants = [
            Variant(id="control", name="Control", percentage=60),
            Variant(id="treatment", name="Treatment", percentage=40),
        ]

        assignments = {}
        for i in range(10000):
            variant = VariantAssigner.get_variant(f"user_{i}", variants, "exp_001")
            if variant.id not in assignments:
                assignments[variant.id] = 0
            assignments[variant.id] += 1

        control_pct = assignments["control"] / 10000 * 100
        treatment_pct = assignments["treatment"] / 10000 * 100

        # Allow 2% deviation due to randomness
        assert 58 < control_pct < 62, f"Control: {control_pct}%"
        assert 38 < treatment_pct < 42, f"Treatment: {treatment_pct}%"

    def test_no_data_leakage_between_experiments(self):
        """User's variant in one experiment should not affect another."""
        variants = [
            Variant(id="v1", name="Variant 1", percentage=50),
            Variant(id="v2", name="Variant 2", percentage=50),
        ]

        variant_exp1 = VariantAssigner.get_variant("user_123", variants, "exp_001")
        variant_exp2 = VariantAssigner.get_variant("user_123", variants, "exp_002")

        # Different experiments may assign different variants
        # But the assignment must be deterministic per experiment
        assert VariantAssigner.get_variant("user_123", variants, "exp_001") == variant_exp1
        assert VariantAssigner.get_variant("user_123", variants, "exp_002") == variant_exp2

    def test_empty_variants_error(self):
        """Should raise error if no variants provided."""
        with pytest.raises(ValueError):
            VariantAssigner.get_variant("user_123", [], "exp_001")

    def test_invalid_percentages(self):
        """Should raise error if percentages don't sum to 100."""
        variants = [
            Variant(id="v1", name="Variant 1", percentage=50),
            Variant(id="v2", name="Variant 2", percentage=40),  # Total = 90%
        ]

        with pytest.raises(ValueError):
            VariantAssigner.get_variant("user_123", variants, "exp_001")

    def test_single_variant_assignment(self):
        """Single variant should be assigned 100% of the time."""
        variants = [
            Variant(id="only_variant", name="Only", percentage=100),
        ]

        for i in range(100):
            variant = VariantAssigner.get_variant(f"user_{i}", variants, "exp_001")
            assert variant.id == "only_variant"

    def test_bucket_consistency(self):
        """Bucket assignment should be consistent."""
        bucket1 = VariantAssigner.get_bucket("user_123")
        bucket2 = VariantAssigner.get_bucket("user_123")

        assert bucket1 == bucket2


class TestSampleSizeCalculation:
    """Test required sample size calculations."""

    def test_basic_sample_size(self):
        """Calculate sample size for 10% effect with 95% confidence."""
        sample_size = SampleSizeCalculator.calculate_required_sample_size(
            baseline_conversion_rate=0.20,
            minimum_detectable_effect=0.10,
            confidence_level=0.95,
            power=0.80
        )

        # Should be reasonable sample size (typically 500-5000 per variant)
        assert sample_size > 100
        assert sample_size < 50000

    def test_smaller_effect_larger_sample(self):
        """Detecting smaller effects should require larger sample sizes."""
        sample_size_1pct = SampleSizeCalculator.calculate_required_sample_size(
            baseline_conversion_rate=0.20,
            minimum_detectable_effect=0.01,
            confidence_level=0.95,
            power=0.80
        )

        sample_size_10pct = SampleSizeCalculator.calculate_required_sample_size(
            baseline_conversion_rate=0.20,
            minimum_detectable_effect=0.10,
            confidence_level=0.95,
            power=0.80
        )

        assert sample_size_1pct > sample_size_10pct

    def test_higher_confidence_larger_sample(self):
        """Higher confidence level should require larger sample."""
        sample_size_90 = SampleSizeCalculator.calculate_required_sample_size(
            baseline_conversion_rate=0.20,
            minimum_detectable_effect=0.10,
            confidence_level=0.90,
            power=0.80
        )

        sample_size_99 = SampleSizeCalculator.calculate_required_sample_size(
            baseline_conversion_rate=0.20,
            minimum_detectable_effect=0.10,
            confidence_level=0.99,
            power=0.80
        )

        assert sample_size_99 > sample_size_90

    def test_duration_calculation(self):
        """Estimate experiment duration."""
        duration = SampleSizeCalculator.calculate_duration(
            daily_traffic=1000,
            required_samples=4000,
            variants=2
        )

        # Should be approximately 2 days (4000 / 2 variants / 1000 daily)
        assert duration.days == 2

    def test_zero_denominator_handling(self):
        """Should handle edge case of zero difference."""
        sample_size = SampleSizeCalculator.calculate_required_sample_size(
            baseline_conversion_rate=0.20,
            minimum_detectable_effect=0.0,
            confidence_level=0.95,
            power=0.80
        )

        # Should return minimum sample size
        assert sample_size == 10000


class TestStatisticalAnalysis:
    """Test statistical analysis functions."""

    def test_chi_square_test_significant(self):
        """Chi-square test should detect significant difference."""
        # Control: 100/1000 = 10% conversion
        # Treatment: 150/1000 = 15% conversion (50% relative improvement)
        result = StatisticalAnalyzer.chi_square_test(
            control_conversions=100,
            control_total=1000,
            treatment_conversions=150,
            treatment_total=1000
        )

        assert result["chi_square_stat"] > 0
        assert result["p_value"] < 0.05  # Significant at 95% confidence

    def test_chi_square_test_not_significant(self):
        """Chi-square test with identical conversion rates."""
        # Identical conversion rates (10% in both)
        result = StatisticalAnalyzer.chi_square_test(
            control_conversions=100,
            control_total=1000,
            treatment_conversions=100,
            treatment_total=1000
        )

        # With identical rates, chi-square should be zero
        assert result["chi_square_stat"] < 0.01

    def test_chi_square_small_sample(self):
        """Chi-square test with small samples."""
        result = StatisticalAnalyzer.chi_square_test(
            control_conversions=1,
            control_total=10,
            treatment_conversions=2,
            treatment_total=10
        )

        # Small sample test may detect a difference, but that's expected
        # Just verify we get a result without crashing
        assert "chi_square_stat" in result
        assert "p_value" in result

    def test_t_test_independent(self):
        """T-test should detect significant difference in continuous metrics."""
        control_values = [100, 102, 101, 103, 102] * 100  # ~101 mean
        treatment_values = [110, 112, 111, 113, 112] * 100  # ~111.6 mean

        result = StatisticalAnalyzer.t_test_independent(
            control_values,
            treatment_values
        )

        assert result["p_value"] < 0.05  # Significant difference

    def test_t_test_no_difference(self):
        """T-test should not detect difference when means are similar."""
        control_values = [100, 101, 102, 99, 100] * 100
        treatment_values = [100, 101, 102, 99, 100] * 100

        result = StatisticalAnalyzer.t_test_independent(
            control_values,
            treatment_values
        )

        assert result["p_value"] > 0.05

    def test_t_test_empty_samples(self):
        """T-test should handle empty samples gracefully."""
        result = StatisticalAnalyzer.t_test_independent([], [])

        assert result["p_value"] == 1.0
        assert result["t_stat"] == 0.0

    def test_confidence_interval_proportion(self):
        """Confidence interval for proportion (Wilson score)."""
        lower, upper = StatisticalAnalyzer.confidence_interval_proportion(
            successes=50,
            total=100,
            confidence_level=0.95
        )

        assert 0 <= lower <= upper <= 1
        assert 0.40 < lower < 0.50
        assert 0.50 < upper < 0.60

    def test_confidence_interval_extreme_proportions(self):
        """Confidence interval should handle extreme values."""
        # All successes
        lower, upper = StatisticalAnalyzer.confidence_interval_proportion(
            successes=100,
            total=100,
            confidence_level=0.95
        )

        assert 0.95 <= lower <= 1.0
        assert 0.95 <= upper <= 1.0  # Allow slight floating point deviation

        # No successes
        lower, upper = StatisticalAnalyzer.confidence_interval_proportion(
            successes=0,
            total=100,
            confidence_level=0.95
        )

        assert lower == 0.0
        assert 0 <= upper <= 0.05

    def test_confidence_interval_mean(self):
        """Confidence interval for mean."""
        values = [100, 102, 101, 103, 102, 98, 99, 101]

        lower, upper = StatisticalAnalyzer.confidence_interval_mean(
            values,
            confidence_level=0.95
        )

        mean = sum(values) / len(values)
        assert lower < mean < upper
        assert upper - lower > 0

    def test_confidence_interval_empty(self):
        """Confidence interval should handle empty list."""
        lower, upper = StatisticalAnalyzer.confidence_interval_mean([], 0.95)

        assert lower == 0.0
        assert upper == 0.0


class TestExperimentLifecycle:
    """Test experiment creation and management."""

    def test_create_experiment(self):
        """Create and initialize experiment."""
        config = ExperimentConfig(
            name="Test Experiment",
            description="A simple test",
            start_date=datetime.now(),
            variants=[
                Variant(id="control", name="Control", percentage=50),
                Variant(id="treatment", name="Treatment", percentage=50),
            ]
        )

        experiment = Experiment(config, "exp_001")

        assert experiment.id == "exp_001"
        assert experiment.config.name == "Test Experiment"
        assert len(experiment.config.variants) == 2
        assert experiment.status == ExperimentStatus.DRAFT

    def test_assign_variant_to_user(self):
        """Assign variant to user in experiment."""
        config = ExperimentConfig(
            name="Test",
            description="Test",
            start_date=datetime.now(),
            variants=[
                Variant(id="control", name="Control", percentage=50),
                Variant(id="treatment", name="Treatment", percentage=50),
            ]
        )

        experiment = Experiment(config, "exp_001")
        variant = experiment.assign_variant("user_123")

        assert variant.id in ["control", "treatment"]
        assert variant == experiment.assign_variant("user_123")  # Consistent

    def test_record_metrics(self):
        """Record metrics in experiment."""
        config = ExperimentConfig(
            name="Test",
            description="Test",
            start_date=datetime.now(),
            variants=[
                Variant(id="control", name="Control", percentage=50),
                Variant(id="treatment", name="Treatment", percentage=50),
            ]
        )

        experiment = Experiment(config, "exp_001")
        experiment.status = ExperimentStatus.RUNNING

        metric = Metric(
            user_id="user_123",
            variant_id="control",
            metric_type=MetricType.CONVERSION,
            metric_name="signup",
            value=1.0
        )

        experiment.record_metric(metric)

        assert len(experiment.results) == 1
        assert experiment.results[0].metric_name == "signup"

    def test_get_variant_results(self):
        """Get aggregated results for variant."""
        config = ExperimentConfig(
            name="Test",
            description="Test",
            start_date=datetime.now(),
            variants=[
                Variant(id="control", name="Control", percentage=50),
                Variant(id="treatment", name="Treatment", percentage=50),
            ]
        )

        experiment = Experiment(config, "exp_001")
        experiment.status = ExperimentStatus.RUNNING

        # Add metrics
        for i in range(100):
            metric = Metric(
                user_id=f"user_{i}",
                variant_id="control",
                metric_type=MetricType.CONVERSION,
                metric_name="signup",
                value=1.0 if i < 20 else 0.0
            )
            experiment.record_metric(metric)

        results = experiment.get_variant_results("control")

        assert results["sample_size"] == 100
        assert results["metrics"]["signup"]["conversions"] == 20
        assert results["metrics"]["signup"]["total"] == 100
        assert results["metrics"]["signup"]["rate"] == 0.20

    def test_run_full_analysis(self):
        """Run full statistical analysis."""
        config = ExperimentConfig(
            name="Test",
            description="Test",
            start_date=datetime.now(),
            variants=[
                Variant(id="control", name="Control", percentage=50),
                Variant(id="treatment", name="Treatment", percentage=50),
            ]
        )

        experiment = Experiment(config, "exp_001")
        experiment.status = ExperimentStatus.RUNNING

        # Add metrics for control (10% conversion)
        for i in range(1000):
            metric = Metric(
                user_id=f"control_{i}",
                variant_id="control",
                metric_type=MetricType.CONVERSION,
                metric_name="purchase",
                value=1.0 if i < 100 else 0.0
            )
            experiment.record_metric(metric)

        # Add metrics for treatment (15% conversion)
        for i in range(1000):
            metric = Metric(
                user_id=f"treatment_{i}",
                variant_id="treatment",
                metric_type=MetricType.CONVERSION,
                metric_name="purchase",
                value=1.0 if i < 150 else 0.0
            )
            experiment.record_metric(metric)

        analysis = experiment.run_analysis()

        assert analysis["experiment_id"] == "exp_001"
        assert analysis["total_samples"] == 2000
        assert len(analysis["comparisons"]) == 1

        comparison = analysis["comparisons"][0]
        assert comparison["control_variant"] == "control"
        assert comparison["treatment_variant"] == "treatment"
        assert "purchase" in comparison["metric_tests"]


class TestFeatureFlags:
    """Test feature flag system."""

    def test_create_flag(self):
        """Create feature flag."""
        flag = FeatureFlag("flag_001", "New Feature", "Test feature", enabled=False)

        assert flag.flag_id == "flag_001"
        assert flag.name == "New Feature"
        assert not flag.enabled

    def test_enable_disable_flag(self):
        """Enable and disable flags."""
        flag = FeatureFlag("flag_001", "Test", enabled=False)

        assert not flag.enabled

        flag.enable()
        assert flag.enabled

        flag.disable()
        assert not flag.enabled

    def test_feature_flag_manager(self):
        """Manage multiple flags."""
        manager = FeatureFlagManager()

        flag1 = manager.create_flag("flag_001", "Feature 1")
        flag2 = manager.create_flag("flag_002", "Feature 2")

        assert len(manager.list_flags()) == 2
        assert manager.get_flag("flag_001") == flag1

    def test_rollout_strategy(self):
        """Test rollout percentage strategy."""
        strategy = RolloutStrategy("test_rollout")
        strategy.add_allocation("variant_a", 50.0)
        strategy.add_allocation("variant_b", 50.0)

        # Check distribution
        users_a = 0
        for i in range(1000):
            variant = strategy.get_allocation(f"user_{i}")
            if variant == "variant_a":
                users_a += 1

        assert 450 < users_a < 550  # Roughly 50%

    def test_targeting_rules(self):
        """Test targeting rule evaluation."""
        rule = TargetingRule(
            attribute="region",
            operator=TargetingOperator.EQUALS,
            value="US"
        )

        assert rule.evaluate({"region": "US"})
        assert not rule.evaluate({"region": "EU"})
        assert not rule.evaluate({})  # Missing attribute

    def test_targeting_rule_set_and(self):
        """Test AND logic in rule sets."""
        rule_set = TargetingRuleSet(operator="AND")
        rule_set.rules.append(
            TargetingRule("region", TargetingOperator.EQUALS, "US")
        )
        rule_set.rules.append(
            TargetingRule("age", TargetingOperator.GREATER_THAN, 18)
        )

        assert rule_set.evaluate({"region": "US", "age": 25})
        assert not rule_set.evaluate({"region": "US", "age": 15})
        assert not rule_set.evaluate({"region": "EU", "age": 25})

    def test_targeting_rule_set_or(self):
        """Test OR logic in rule sets."""
        rule_set = TargetingRuleSet(operator="OR")
        rule_set.rules.append(
            TargetingRule("region", TargetingOperator.EQUALS, "US")
        )
        rule_set.rules.append(
            TargetingRule("region", TargetingOperator.EQUALS, "CA")
        )

        assert rule_set.evaluate({"region": "US"})
        assert rule_set.evaluate({"region": "CA"})
        assert not rule_set.evaluate({"region": "EU"})

    def test_user_segment(self):
        """Test user segmentation."""
        segment = UserSegment("seg_001", "Premium Users")
        segment.add_rule("plan", TargetingOperator.EQUALS, "premium")

        assert segment.matches("user_1", {"plan": "premium"})
        assert not segment.matches("user_2", {"plan": "free"})

        # Manual membership
        segment.add_user("special_user")
        assert segment.matches("special_user", {})

    def test_gradual_rollout(self):
        """Test gradual rollout of feature."""
        rollout = GradualRollout("new_feature")

        # No users included initially
        assert not rollout.is_user_included("user_1")

        # 50% rollout
        rollout.set_percentage(50.0)
        included = sum(1 for i in range(1000) if rollout.is_user_included(f"user_{i}"))

        assert 450 < included < 550  # Roughly 50%

        # 100% rollout
        rollout.set_percentage(100.0)
        assert rollout.is_user_included("user_1")
        assert rollout.is_user_included("user_2")


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_variant_percentage_validation(self):
        """Variant percentages must be 0-100."""
        with pytest.raises(ValueError):
            Variant(id="v1", name="V1", percentage=150)

        with pytest.raises(ValueError):
            Variant(id="v1", name="V1", percentage=-10)

    def test_experiment_with_single_variant(self):
        """Experiment must have at least one variant."""
        config = ExperimentConfig(
            name="Test",
            description="Test",
            start_date=datetime.now(),
            variants=[
                Variant(id="only", name="Only", percentage=100)
            ]
        )

        experiment = Experiment(config, "exp_001")
        variant = experiment.assign_variant("user_123")

        assert variant.id == "only"

    def test_metric_with_metadata(self):
        """Metrics can include metadata."""
        metric = Metric(
            user_id="user_1",
            variant_id="control",
            metric_type=MetricType.CONVERSION,
            metric_name="purchase",
            value=99.99,
            metadata={"currency": "USD", "product_id": "prod_123"}
        )

        assert metric.metadata["currency"] == "USD"

    def test_segment_without_rules(self):
        """Segment with no rules should accept all if empty."""
        segment = UserSegment("seg_1", "All Users")

        # Empty rule set should match all
        assert segment.matches("user_1", {})
        assert segment.matches("user_2", {"any": "context"})

    def test_rollout_strategy_invalid_percentage(self):
        """Rollout strategy should validate percentages."""
        strategy = RolloutStrategy("test")

        with pytest.raises(ValueError):
            strategy.add_allocation("v1", 150.0)

    def test_multiple_metrics_same_variant(self):
        """Can record multiple metric types for same variant."""
        config = ExperimentConfig(
            name="Test",
            description="Test",
            start_date=datetime.now(),
            variants=[
                Variant(id="control", name="Control", percentage=100)
            ]
        )

        experiment = Experiment(config, "exp_001")

        # Record multiple metrics
        experiment.record_metric(Metric(
            user_id="user_1",
            variant_id="control",
            metric_type=MetricType.CONVERSION,
            metric_name="signup",
            value=1.0
        ))

        experiment.record_metric(Metric(
            user_id="user_1",
            variant_id="control",
            metric_type=MetricType.CONTINUOUS,
            metric_name="session_duration",
            value=600.5
        ))

        results = experiment.get_variant_results("control")
        assert len(results["metrics"]) == 2
        assert "signup" in results["metrics"]
        assert "session_duration" in results["metrics"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
