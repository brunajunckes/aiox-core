#!/usr/bin/env python3
"""
Output Quality Test Suite — Test 10 workflows of each type
Tests: SEO, Research, Video workflows
Validates: Output structure, length requirements, content presence
Reports: Pass rate, failures, average quality scores
"""
import json
import logging
import time
from typing import Dict, List
from dataclasses import dataclass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
log = logging.getLogger("output-quality-test")

# Import validators
from autoflow.core.validator_enhanced import (
    validate_output,
    ValidationResult
)

# Import workflows
from autoflow.workflows.seo import run_seo
from autoflow.workflows.research import run_research
from autoflow.workflows.video import run_video


@dataclass
class TestResult:
    """Single test result"""
    workflow_type: str
    test_num: int
    topic: str
    valid: bool
    score: float
    feedback: str = ""
    duration: float = 0.0
    error: str = ""


class OutputQualityTester:
    """Test runner for workflow output quality"""

    def __init__(self):
        self.results: List[TestResult] = []
        self.start_time = None

    def test_seo_workflows(self, count: int = 10) -> List[TestResult]:
        """Test SEO workflow outputs"""
        topics = [
            "Python programming tutorials",
            "Machine learning basics",
            "Web development best practices",
            "Cloud computing introduction",
            "Database optimization",
            "API design patterns",
            "DevOps tools and practices",
            "Cybersecurity fundamentals",
            "Mobile app development",
            "Artificial intelligence trends",
        ]

        results = []
        for i, topic in enumerate(topics[:count]):
            log.info(f"[SEO {i+1}/{count}] Testing: {topic}")
            result = self._run_test(
                workflow_type="seo",
                test_num=i+1,
                topic=topic,
                run_fn=lambda: run_seo(topic),
                output_type="seo"
            )
            results.append(result)
            self.results.append(result)

        return results

    def test_research_workflows(self, count: int = 10) -> List[TestResult]:
        """Test Research workflow outputs"""
        topics = [
            "AI trends in 2026",
            "Quantum computing breakthroughs",
            "Renewable energy advances",
            "Blockchain technology adoption",
            "Edge computing applications",
            "5G network deployment",
            "IoT security challenges",
            "Serverless computing patterns",
            "Data privacy regulations",
            "Green technology innovations",
        ]

        results = []
        for i, topic in enumerate(topics[:count]):
            log.info(f"[RESEARCH {i+1}/{count}] Testing: {topic}")
            result = self._run_test(
                workflow_type="research",
                test_num=i+1,
                topic=topic,
                run_fn=lambda t=topic: run_research(t),
                output_type="research"
            )
            results.append(result)
            self.results.append(result)

        return results

    def test_video_workflows(self, count: int = 10) -> List[TestResult]:
        """Test Video workflow outputs"""
        topics = [
            "How to learn Python",
            "Introduction to machine learning",
            "Web development for beginners",
            "Cloud computing explained",
            "Docker containerization guide",
            "Kubernetes orchestration basics",
            "React.js tutorial series",
            "TypeScript advanced patterns",
            "GraphQL API design",
            "Microservices architecture",
        ]

        results = []
        for i, topic in enumerate(topics[:count]):
            log.info(f"[VIDEO {i+1}/{count}] Testing: {topic}")
            result = self._run_test(
                workflow_type="video",
                test_num=i+1,
                topic=topic,
                run_fn=lambda t=topic: run_video(t),
                output_type="video"
            )
            results.append(result)
            self.results.append(result)

        return results

    def _run_test(self, workflow_type: str, test_num: int, topic: str,
                  run_fn, output_type: str) -> TestResult:
        """Run a single workflow test"""
        start = time.time()
        result = TestResult(
            workflow_type=workflow_type,
            test_num=test_num,
            topic=topic,
            valid=False,
            score=0.0
        )

        try:
            # Run workflow
            output = run_fn()
            duration = time.time() - start

            # Parse output
            if isinstance(output, str):
                # Try to parse as JSON
                try:
                    parsed = json.loads(output)
                except json.JSONDecodeError:
                    # If string, wrap in dict
                    parsed = {"raw_output": output}
            else:
                parsed = output

            # Validate
            validation = validate_output(parsed, output_type)

            result.valid = validation.valid
            result.score = validation.score
            result.feedback = validation.feedback
            result.duration = duration

            status = "✓ PASS" if validation.valid else "✗ FAIL"
            log.info(f"  {status} | Score: {validation.score:.1f}/10 | Duration: {duration:.2f}s")
            if validation.feedback:
                log.info(f"  Feedback: {validation.feedback}")

        except Exception as e:
            result.error = str(e)
            result.duration = time.time() - start
            log.error(f"  ✗ ERROR | {e}")

        return result

    def report(self) -> Dict:
        """Generate quality report"""
        if not self.results:
            return {"error": "No test results"}

        # Group by workflow type
        by_type = {}
        for result in self.results:
            if result.workflow_type not in by_type:
                by_type[result.workflow_type] = []
            by_type[result.workflow_type].append(result)

        # Calculate metrics per type
        report = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "total_tests": len(self.results),
            "by_workflow_type": {}
        }

        for workflow_type, results in by_type.items():
            passed = sum(1 for r in results if r.valid and not r.error)
            failed = sum(1 for r in results if not r.valid and not r.error)
            errors = sum(1 for r in results if r.error)
            pass_rate = (passed / len(results) * 100) if results else 0

            avg_score = sum(r.score for r in results) / len(results) if results else 0
            avg_duration = sum(r.duration for r in results) / len(results) if results else 0

            failures = [r for r in results if not r.valid and not r.error]
            failure_details = [
                {
                    "test": f"{r.workflow_type}_{r.test_num}",
                    "topic": r.topic,
                    "score": r.score,
                    "feedback": r.feedback
                }
                for r in failures
            ]

            report["by_workflow_type"][workflow_type] = {
                "total": len(results),
                "passed": passed,
                "failed": failed,
                "errors": errors,
                "pass_rate_percent": round(pass_rate, 1),
                "avg_quality_score": round(avg_score, 2),
                "avg_duration_seconds": round(avg_duration, 2),
                "failures": failure_details
            }

        # Summary
        total_passed = sum(r["passed"] for r in report["by_workflow_type"].values())
        total_tests = report["total_tests"]
        overall_pass_rate = (total_passed / total_tests * 100) if total_tests else 0

        report["summary"] = {
            "total_passed": total_passed,
            "total_failed": total_tests - total_passed,
            "overall_pass_rate_percent": round(overall_pass_rate, 1)
        }

        return report

    def print_report(self, report: Dict):
        """Print formatted report"""
        print("\n" + "="*70)
        print("OUTPUT QUALITY TEST REPORT")
        print("="*70)
        print(f"Timestamp: {report['timestamp']}")
        print(f"Total Tests: {report['total_tests']}")
        print()

        # Per-workflow breakdown
        for workflow_type, metrics in report["by_workflow_type"].items():
            print(f"\n{workflow_type.upper()} WORKFLOW")
            print("-" * 70)
            print(f"  Total:              {metrics['total']}")
            print(f"  Passed:             {metrics['passed']}")
            print(f"  Failed:             {metrics['failed']}")
            print(f"  Errors:             {metrics['errors']}")
            print(f"  Pass Rate:          {metrics['pass_rate_percent']}%")
            print(f"  Avg Quality Score:  {metrics['avg_quality_score']}/10")
            print(f"  Avg Duration:       {metrics['avg_duration_seconds']}s")

            if metrics["failures"]:
                print(f"\n  Failures ({len(metrics['failures'])}):")
                for failure in metrics["failures"]:
                    print(f"    • {failure['test']}: {failure['topic']}")
                    print(f"      Score: {failure['score']}/10")
                    print(f"      Issue: {failure['feedback']}")

        # Summary
        summary = report["summary"]
        print("\n" + "="*70)
        print("SUMMARY")
        print("="*70)
        print(f"Total Passed:        {summary['total_passed']}/{report['total_tests']}")
        print(f"Overall Pass Rate:   {summary['overall_pass_rate_percent']}%")
        print("="*70 + "\n")

    def save_report(self, report: Dict, filename: str = "output_quality_report.json"):
        """Save report to file"""
        filepath = f"/root/autoflow/{filename}"
        with open(filepath, "w") as f:
            json.dump(report, f, indent=2)
        log.info(f"Report saved to {filepath}")


def main():
    """Run complete test suite"""
    tester = OutputQualityTester()

    print("\n🚀 Starting Output Quality Test Suite\n")

    # Test each workflow type
    print("📊 Running SEO workflow tests...")
    tester.test_seo_workflows(count=10)

    print("\n📊 Running Research workflow tests...")
    tester.test_research_workflows(count=10)

    print("\n📊 Running Video workflow tests...")
    tester.test_video_workflows(count=10)

    # Generate and print report
    report = tester.report()
    tester.print_report(report)
    tester.save_report(report)

    # Exit with appropriate code
    if report["summary"]["overall_pass_rate_percent"] >= 80:
        print("✅ QUALITY GATE PASSED (≥80% pass rate)")
        return 0
    else:
        print("⚠️  QUALITY GATE FAILED (<80% pass rate)")
        return 1


if __name__ == "__main__":
    exit(main())
