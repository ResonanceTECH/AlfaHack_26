"""BUG-004: AuthSessionOut.redirectTo matches FE routes."""

from app.core.enums import UserRole
from app.services.auth_flow import redirect_for_role


def test_redirect_for_role_matches_frontend_routes() -> None:
    assert redirect_for_role(UserRole.ANALYST) == "/app/analyst"
    assert redirect_for_role(UserRole.ADMIN) == "/app/admin"
    assert redirect_for_role(UserRole.ENTREPRENEUR) == "/select-company"
