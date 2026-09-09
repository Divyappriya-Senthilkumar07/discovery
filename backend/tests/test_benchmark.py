import pytest
import pytest_asyncio
from app.benchmark.benchmark_runner import BenchmarkRunner


@pytest.mark.asyncio
async def test_full_validation_benchmark_suite():
    result = await BenchmarkRunner.run_full_benchmark()

    # Success criteria 1: Reduce missed coverage by >= 60% vs naive keyword baseline
    assert result.missed_coverage_reduction_pct >= 60.0, (
        f"Missed coverage reduction was {result.missed_coverage_reduction_pct}%, target is >= 60%"
    )

    # Success criteria 2: Reduce false positives by >= 85% vs naive keyword baseline
    assert result.false_positive_reduction_pct >= 85.0, (
        f"False positive reduction was {result.false_positive_reduction_pct}%, target is >= 85%"
    )

    # Success criteria 3: Cut analyst filtering time to < 30 minutes/day
    ce_minutes = result.analyst_time_details["context_engine_minutes"]
    assert ce_minutes <= 30.0, (
        f"Analyst triage time was {ce_minutes} minutes, target is <= 30 minutes"
    )

    # Combined criteria
    assert result.success_criteria_met is True
