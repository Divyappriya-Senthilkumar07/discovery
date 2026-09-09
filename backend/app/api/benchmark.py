from fastapi import APIRouter, Depends
from app.benchmark.benchmark_runner import BenchmarkRunner, BenchmarkResult
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/benchmark", tags=["Validation Benchmark"])


@router.post("/run", response_model=BenchmarkResult)
async def run_benchmark(current_user: User = Depends(get_current_user)):
    return await BenchmarkRunner.run_full_benchmark()
