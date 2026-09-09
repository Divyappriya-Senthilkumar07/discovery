import pytest
from app.db.session import engine, Base


@pytest.fixture(autouse=True)
async def cleanup_db():
    """
    Ensure every test runs against a clean database without residue from previous tests.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
