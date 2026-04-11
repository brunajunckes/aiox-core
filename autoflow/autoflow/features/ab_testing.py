"""A/B Testing Framework for AutoFlow.

Provides:
- Feature flags system
- Experiment tracking
- Variant assignment with deterministic hashing
- Statistical analysis (Chi-square, t-test)
- Confidence interval calculations
"""

import hashlib
import json
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from abc import ABC, abstractmethod


class ExperimentStatus(Enum):
    """Experiment lifecycle status."""
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class MetricType(Enum):
    """Supported metric types for analysis."""
    CONVERSION = "conversion"  # Binary outcome
    CONTINUOUS = "continuous"  # Numeric value
    COUNT = "count"  # Integer count


@dataclass
class Variant:
    """Represents a single variant in an experiment."""
    id: str
    name: str
    percentage: float  # Allocation percentage (0-100)
    description: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not 0 <= self.percentage <= 100:
            raise ValueError(f"Variant percentage must be 0-100, got {self.percentage}")


@dataclass
class Metric:
    """Metric data point for an experiment."""
    user_id: str
    variant_id: str
    metric_type: MetricType
    metric_name: str
    value: float
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ExperimentConfig:
    """Configuration for an experiment."""
    name: str
    description: str
    start_date: datetime
    end_date: Optional[datetime] = None
    variants: List[Variant] = field(default_factory=list)
    target_sample_size: Optional[int] = None
    confidence_level: float = 0.95  # 95% confidence
    minimum_detectable_effect: float = 0.10  # 10% effect size
    control_variant_id: Optional[str] = None
    tags: Dict[str, str] = field(default_factory=dict)
    targeting_rules: Dict[str, Any] = field(default_factory=dict)


class VariantAssigner:
    """Deterministic variant assignment using consistent hashing."""

    @staticmethod
    def get_variant(
        user_id: str,
        variants: List[Variant],
        experiment_id: str,
        seed: Optional[str] = None
    ) -> Variant:
        """
        Assign a variant to a user deterministically.

        Uses MD5 hash of (user_id, experiment_id, seed) to ensure:
        - Same user always gets same variant for same experiment
        - Even distribution across variants based on percentages
        - No data leakage between experiments

        Args:
            user_id: Unique user identifier
            variants: List of variants with allocation percentages
            experiment_id: Unique experiment identifier
            seed: Optional seed for reproducibility

        Returns:
            Assigned variant

        Raises:
            ValueError: If variants don't add up to 100% or list is empty
        """
        if not variants:
            raise ValueError("Must provide at least one variant")

        # Validate percentages sum to 100
        total_percentage = sum(v.percentage for v in variants)
        if not (99.9 <= total_percentage <= 100.1):  # Allow small float rounding
            raise ValueError(f"Variant percentages must sum to 100, got {total_percentage}")

        # Sort variants by ID for consistent ordering
        sorted_variants = sorted(variants, key=lambda v: v.id)

        # Create deterministic hash
        hash_input = f"{user_id}:{experiment_id}:{seed or 'default'}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)

        # Normalize hash to 0-100 range
        normalized_hash = (hash_value % 10000) / 100.0

        # Find variant based on cumulative percentages
        cumulative = 0.0
        for variant in sorted_variants:
            cumulative += variant.percentage
            if normalized_hash < cumulative:
                return variant

        # Fallback to last variant (shouldn't reach here)
        return sorted_variants[-1]

    @staticmethod
    def get_bucket(
        user_id: str,
        num_buckets: int = 10000,
        seed: Optional[str] = None
    ) -> int:
        """Get user bucket number for consistent assignment."""
        hash_input = f"{user_id}:{seed or 'default'}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
        return hash_value % num_buckets


class SampleSizeCalculator:
    """Calculate required sample sizes for statistical tests."""

    @staticmethod
    def calculate_required_sample_size(
        baseline_conversion_rate: float,
        minimum_detectable_effect: float,
        confidence_level: float = 0.95,
        power: float = 0.80,
        two_tailed: bool = True
    ) -> int:
        """
        Calculate sample size needed for conversion rate test.

        Uses Neyman allocation for two-sample proportions test.

        Args:
            baseline_conversion_rate: Baseline conversion rate (0-1)
            minimum_detectable_effect: Minimum effect to detect (0-1)
            confidence_level: Statistical confidence (0.90, 0.95, 0.99)
            power: Statistical power (typically 0.80)
            two_tailed: Whether test is two-tailed

        Returns:
            Required sample size per variant
        """
        # Z-scores for common confidence levels
        z_scores = {
            0.90: 1.645,
            0.95: 1.96,
            0.99: 2.576,
        }
        z_alpha = z_scores.get(confidence_level, 1.96)
        if two_tailed:
            z_alpha = z_scores[confidence_level]
        else:
            z_alpha = z_scores[confidence_level] * 0.5

        # Z-score for power (Type II error)
        z_beta = 0.84  # 80% power

        # Effect size
        p1 = baseline_conversion_rate
        p2 = baseline_conversion_rate + (baseline_conversion_rate * minimum_detectable_effect)

        # Pooled proportion
        p_pool = (p1 + p2) / 2

        # Sample size formula
        numerator = (z_alpha + z_beta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))
        denominator = (p2 - p1) ** 2

        if denominator == 0:
            return 10000  # Minimum sample size

        return math.ceil(numerator / denominator)

    @staticmethod
    def calculate_duration(
        daily_traffic: int,
        required_samples: int,
        variants: int = 2
    ) -> timedelta:
        """Estimate experiment duration based on traffic."""
        samples_per_variant = required_samples / variants
        days_needed = samples_per_variant / daily_traffic
        return timedelta(days=max(1, math.ceil(days_needed)))


class StatisticalAnalyzer:
    """Statistical analysis for A/B test results."""

    @staticmethod
    def chi_square_test(
        control_conversions: int,
        control_total: int,
        treatment_conversions: int,
        treatment_total: int
    ) -> Dict[str, float]:
        """
        Chi-square test for independence (binary outcomes).

        Uses 2x2 contingency table:
        |           | Conversion | No Conversion |
        |-----------|------------|---------------|
        | Control   | a          | b             |
        | Treatment | c          | d             |

        Returns:
            Dict with chi_square_stat, p_value, degrees_of_freedom
        """
        # 2x2 contingency table
        a = control_conversions
        b = control_total - control_conversions
        c = treatment_conversions
        d = treatment_total - treatment_conversions

        n = control_total + treatment_total

        # Chi-square formula for 2x2 table: χ² = n(ad-bc)²/((a+b)(c+d)(a+c)(b+d))
        numerator = n * ((a * d - b * c) ** 2)
        denominator = (a + b) * (c + d) * (a + c) * (b + d)

        if denominator == 0:
            return {
                "chi_square_stat": 0.0,
                "p_value": 1.0,
                "degrees_of_freedom": 1,
                "warning": "Zero denominator (empty cells)"
            }

        chi_square = numerator / denominator

        # Approximate p-value using normal approximation for chi-square
        # For chi-square with df=1, use sqrt(chi_square) as z-score
        z = math.sqrt(chi_square)
        p_value = 2 * (1 - StatisticalAnalyzer._normal_cdf(z))

        return {
            "chi_square_stat": chi_square,
            "p_value": min(p_value, 1.0),
            "degrees_of_freedom": 1
        }

    @staticmethod
    def t_test_independent(
        control_values: List[float],
        treatment_values: List[float],
        equal_var: bool = True
    ) -> Dict[str, float]:
        """
        Independent samples t-test (continuous metrics).

        Returns:
            Dict with t_stat, p_value, degrees_of_freedom
        """
        if not control_values or not treatment_values:
            return {"t_stat": 0.0, "p_value": 1.0, "degrees_of_freedom": 0}

        n1, n2 = len(control_values), len(treatment_values)
        mean1 = sum(control_values) / n1
        mean2 = sum(treatment_values) / n2

        # Variance calculation
        var1 = sum((x - mean1) ** 2 for x in control_values) / (n1 - 1) if n1 > 1 else 0
        var2 = sum((x - mean2) ** 2 for x in treatment_values) / (n2 - 1) if n2 > 1 else 0

        if var1 == 0 and var2 == 0:
            return {"t_stat": 0.0, "p_value": 1.0, "degrees_of_freedom": n1 + n2 - 2}

        # Pooled standard error
        se = math.sqrt((var1 / n1) + (var2 / n2))
        if se == 0:
            return {"t_stat": 0.0, "p_value": 1.0, "degrees_of_freedom": n1 + n2 - 2}

        t_stat = (mean1 - mean2) / se
        df = n1 + n2 - 2

        # Approximate p-value using t-distribution (two-tailed)
        # For large df, use normal approximation
        if df > 30:
            p_value = 2 * (1 - StatisticalAnalyzer._normal_cdf(abs(t_stat)))
        else:
            # Conservative approximation for small df
            p_value = 2 * (1 - StatisticalAnalyzer._t_distribution_cdf(abs(t_stat), df))

        return {
            "t_stat": t_stat,
            "p_value": min(p_value, 1.0),
            "degrees_of_freedom": df
        }

    @staticmethod
    def confidence_interval_proportion(
        successes: int,
        total: int,
        confidence_level: float = 0.95
    ) -> Tuple[float, float]:
        """
        Calculate Wilson score confidence interval for proportion.

        More accurate than normal approximation, especially for extreme values.

        Args:
            successes: Number of successes
            total: Total samples
            confidence_level: Confidence level (0.90, 0.95, 0.99)

        Returns:
            Tuple of (lower_bound, upper_bound)
        """
        if total == 0:
            return (0.0, 1.0)

        z_scores = {
            0.90: 1.645,
            0.95: 1.96,
            0.99: 2.576,
        }
        z = z_scores.get(confidence_level, 1.96)

        p_hat = successes / total
        z_squared = z ** 2

        denominator = 1 + z_squared / total

        center = (p_hat + z_squared / (2 * total)) / denominator
        margin = (z * math.sqrt(p_hat * (1 - p_hat) / total + z_squared / (4 * total ** 2))) / denominator

        lower = max(0.0, center - margin)
        upper = min(1.0, center + margin)

        return (lower, upper)

    @staticmethod
    def confidence_interval_mean(
        values: List[float],
        confidence_level: float = 0.95
    ) -> Tuple[float, float]:
        """Calculate confidence interval for mean of continuous metric."""
        if not values:
            return (0.0, 0.0)

        n = len(values)
        mean = sum(values) / n
        std_dev = math.sqrt(sum((x - mean) ** 2 for x in values) / (n - 1)) if n > 1 else 0

        # Use normal approximation (t-distribution would be more accurate)
        z_scores = {
            0.90: 1.645,
            0.95: 1.96,
            0.99: 2.576,
        }
        z = z_scores.get(confidence_level, 1.96)

        margin = z * (std_dev / math.sqrt(n)) if n > 0 else 0

        return (mean - margin, mean + margin)

    @staticmethod
    def _chi_square_cdf(x: float, df: int = 1) -> float:
        """Approximate chi-square CDF using normal approximation."""
        if x < 0:
            return 0.0
        # Using normal approximation for chi-square
        z = (x ** 0.5 - df ** 0.5) / (2 ** 0.5)
        return StatisticalAnalyzer._normal_cdf(z)

    @staticmethod
    def _t_distribution_cdf(t: float, df: int) -> float:
        """Approximate t-distribution CDF using normal approximation."""
        # For large df, t-distribution approaches normal distribution
        if df > 30:
            return StatisticalAnalyzer._normal_cdf(t)
        # For smaller df, apply Student's t correction via normal approximation
        # This is conservative and slightly less accurate, but avoids scipy dependency
        z_adjusted = t * math.sqrt(1.0 - 2.0 / (9.0 * df))
        return StatisticalAnalyzer._normal_cdf(z_adjusted)

    @staticmethod
    def _normal_cdf(z: float) -> float:
        """Approximate standard normal CDF using error function."""
        return (1.0 + math.erf(z / math.sqrt(2))) / 2.0


class Experiment:
    """Represents a single A/B test experiment."""

    def __init__(self, config: ExperimentConfig, experiment_id: str):
        self.config = config
        self.id = experiment_id
        self.status = ExperimentStatus.DRAFT
        self.created_at = datetime.now()
        self.results: List[Metric] = []

    def assign_variant(self, user_id: str) -> Variant:
        """Assign variant to user for this experiment."""
        return VariantAssigner.get_variant(
            user_id,
            self.config.variants,
            self.id
        )

    def record_metric(self, metric: Metric) -> None:
        """Record a metric data point."""
        metric.timestamp = datetime.now()
        self.results.append(metric)

    def get_variant_results(self, variant_id: str) -> Dict[str, Any]:
        """Get aggregated results for a specific variant."""
        variant_metrics = [m for m in self.results if m.variant_id == variant_id]

        if not variant_metrics:
            return {
                "variant_id": variant_id,
                "sample_size": 0,
                "metrics": {}
            }

        # Group by metric name
        by_metric = {}
        for metric in variant_metrics:
            if metric.metric_name not in by_metric:
                by_metric[metric.metric_name] = {
                    "type": metric.metric_type,
                    "values": [],
                    "count": 0
                }
            by_metric[metric.metric_name]["values"].append(metric.value)
            by_metric[metric.metric_name]["count"] += 1

        # Calculate stats per metric
        stats = {}
        for metric_name, data in by_metric.items():
            if data["type"] == MetricType.CONVERSION:
                conversions = sum(1 for v in data["values"] if v > 0)
                total = len(data["values"])
                stats[metric_name] = {
                    "conversions": conversions,
                    "total": total,
                    "rate": conversions / total if total > 0 else 0,
                    "ci": StatisticalAnalyzer.confidence_interval_proportion(conversions, total)
                }
            else:
                values = data["values"]
                stats[metric_name] = {
                    "mean": sum(values) / len(values),
                    "count": len(values),
                    "ci": StatisticalAnalyzer.confidence_interval_mean(values)
                }

        return {
            "variant_id": variant_id,
            "sample_size": len(variant_metrics),
            "metrics": stats
        }

    def run_analysis(self) -> Dict[str, Any]:
        """Run full statistical analysis on experiment results."""
        if len(self.config.variants) < 2:
            return {"error": "Need at least 2 variants for analysis"}

        control_variant = self.config.variants[0]
        if self.config.control_variant_id:
            control_variant = next(
                (v for v in self.config.variants if v.id == self.config.control_variant_id),
                self.config.variants[0]
            )

        analysis = {
            "experiment_id": self.id,
            "status": self.status.value,
            "total_samples": len(self.results),
            "variant_results": {},
            "comparisons": []
        }

        # Get results per variant
        for variant in self.config.variants:
            analysis["variant_results"][variant.id] = self.get_variant_results(variant.id)

        # Compare variants to control
        for variant in self.config.variants:
            if variant.id == control_variant.id:
                continue

            control_results = analysis["variant_results"][control_variant.id]
            treatment_results = analysis["variant_results"][variant.id]

            comparison = self._compare_variants(
                control_variant.id,
                variant.id,
                control_results,
                treatment_results
            )
            analysis["comparisons"].append(comparison)

        return analysis

    def _compare_variants(
        self,
        control_id: str,
        treatment_id: str,
        control_results: Dict[str, Any],
        treatment_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Compare two variants using appropriate statistical tests."""
        comparison = {
            "control_variant": control_id,
            "treatment_variant": treatment_id,
            "metric_tests": {}
        }

        # Compare each metric
        for metric_name, control_stat in control_results.get("metrics", {}).items():
            if metric_name not in treatment_results.get("metrics", {}):
                continue

            treatment_stat = treatment_results["metrics"][metric_name]

            # Determine test type based on metric
            if "conversions" in control_stat:
                # Chi-square test for binary outcomes
                test_result = StatisticalAnalyzer.chi_square_test(
                    control_stat["conversions"],
                    control_stat["total"],
                    treatment_stat["conversions"],
                    treatment_stat["total"]
                )
                test_result["test_type"] = "chi_square"
            else:
                # T-test for continuous metrics
                test_result = StatisticalAnalyzer.t_test_independent(
                    control_stat.get("values", []),
                    treatment_stat.get("values", [])
                )
                test_result["test_type"] = "t_test"

            # Add significance determination
            significance_threshold = 1 - self.config.confidence_level
            test_result["is_significant"] = test_result.get("p_value", 1.0) < significance_threshold

            comparison["metric_tests"][metric_name] = test_result

        return comparison
