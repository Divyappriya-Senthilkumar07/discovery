import pytest
import pytest_asyncio
import httpx
from app.main import app
from app.db.session import init_db


@pytest.mark.asyncio
async def test_auth_workflow_and_role_gating():
    await init_db()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register an analyst
        analyst_payload = {
            "email": "test_analyst@example.com",
            "password": "Password123!",
            "role": "analyst"
        }
        res = await client.post("/api/v1/auth/register", json=analyst_payload)
        assert res.status_code in [201, 400], res.text
        if res.status_code == 400:
            # Already exists, log in
            login_res = await client.post("/api/v1/auth/login", json={"email": analyst_payload["email"], "password": analyst_payload["password"]})
            analyst_tokens = login_res.json()
        else:
            analyst_tokens = res.json()
        
        analyst_access_token = analyst_tokens["access_token"]
        assert analyst_tokens["role"] == "analyst"

        # 2. Register an admin
        admin_payload = {
            "email": "test_admin@example.com",
            "password": "AdminPassword123!",
            "role": "admin"
        }
        res_admin = await client.post("/api/v1/auth/register", json=admin_payload)
        assert res_admin.status_code in [201, 400], res_admin.text
        if res_admin.status_code == 400:
            login_res = await client.post("/api/v1/auth/login", json={"email": admin_payload["email"], "password": admin_payload["password"]})
            admin_tokens = login_res.json()
        else:
            admin_tokens = res_admin.json()
            
        admin_access_token = admin_tokens["access_token"]
        assert admin_tokens["role"] == "admin"

        # 3. Test unauthenticated request to protected endpoint (should return 401)
        unauth_res = await client.get("/api/v1/auth/me")
        assert unauth_res.status_code == 401, f"Expected 401, got {unauth_res.status_code}"

        # 4. Test authenticated request to /me
        me_res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {analyst_access_token}"}
        )
        assert me_res.status_code == 200
        assert me_res.json()["email"] == "test_analyst@example.com"
        assert me_res.json()["role"] == "analyst"

        # 5. Test Role Gating: Analyst hitting admin-only route (MUST return 403)
        gated_analyst_res = await client.get(
            "/api/v1/auth/admin-only",
            headers={"Authorization": f"Bearer {analyst_access_token}"}
        )
        assert gated_analyst_res.status_code == 403, f"Expected 403 for analyst, got {gated_analyst_res.status_code}"
        assert "Operation not permitted" in gated_analyst_res.json()["detail"]

        # 6. Test Role Gating: Admin hitting admin-only route (MUST return 200)
        gated_admin_res = await client.get(
            "/api/v1/auth/admin-only",
            headers={"Authorization": f"Bearer {admin_access_token}"}
        )
        assert gated_admin_res.status_code == 200, f"Expected 200 for admin, got {gated_admin_res.status_code}"

        # 7. Test token refresh
        refresh_res = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": analyst_tokens["refresh_token"]}
        )
        assert refresh_res.status_code == 200
        assert "access_token" in refresh_res.json()
