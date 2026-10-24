from __future__ import annotations

from app.core.enums import Permission, UserRole

ROLE_PERMISSIONS: dict[UserRole, frozenset[Permission]] = {
    UserRole.ENTREPRENEUR: frozenset(),
    UserRole.ANALYST: frozenset(
        {
            Permission.APPLICATIONS_REVIEW,
            Permission.APPLICATIONS_DECIDE,
            Permission.COMPANIES_READ_CLIENT,
        }
    ),
    UserRole.ADMIN: frozenset(
        {
            Permission.USERS_MANAGE,
            Permission.CATALOG_MANAGE,
            Permission.POLICY_EDIT,
            Permission.POLICY_PUBLISH,
            Permission.MODELS_MANAGE,
            Permission.DEMO_RESET,
            Permission.ANALYTICS_READ,
            Permission.AUDIT_READ,
        }
    ),
}


def permissions_for_role(role: UserRole) -> frozenset[Permission]:
    return ROLE_PERMISSIONS.get(role, frozenset())


def has_permission(role: UserRole, permission: Permission) -> bool:
    return permission in permissions_for_role(role)


def permission_codes(role: UserRole) -> list[str]:
    return sorted(p.value for p in permissions_for_role(role))
