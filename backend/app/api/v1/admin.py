from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.enums import Permission, UserRole, UserStatus
from app.deps import CorrelationId, CurrentUser, DbDep
from app.schemas.admin import (
    AdminCompanyBrief,
    AdminCompanyListOut,
    AdminDisableOut,
    AdminMemberOut,
    AdminMemberPut,
    AdminPermissionOut,
    AdminResetCredentialsIn,
    AdminResetCredentialsOut,
    AdminRoleOut,
    AdminUserCreate,
    AdminUserListOut,
    AdminUserOut,
    AdminUserPatch,
)
from app.services.access import require_permission, require_roles
from app.services.admin_users import (
    create_user,
    delete_member,
    disable_user,
    get_user,
    list_admin_companies,
    list_members,
    list_permissions_catalog,
    list_roles,
    list_users,
    patch_user,
    reset_credentials,
    revoke_user_sessions,
    serialize_admin_user,
    upsert_member,
)
from app.services.audit import write_audit

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(user: CurrentUser) -> None:
    require_roles(user, UserRole.ADMIN)


def _require_users_manage(user: CurrentUser) -> None:
    _require_admin(user)
    require_permission(user, Permission.USERS_MANAGE)


@router.get("/roles", response_model=list[AdminRoleOut])
def admin_roles(user: CurrentUser) -> list[AdminRoleOut]:
    _require_admin(user)
    return [AdminRoleOut(**r) for r in list_roles()]


@router.get("/permissions", response_model=list[AdminPermissionOut])
def admin_permissions(user: CurrentUser) -> list[AdminPermissionOut]:
    _require_admin(user)
    return [AdminPermissionOut(**p) for p in list_permissions_catalog()]


@router.get("/users", response_model=AdminUserListOut)
def admin_list_users(
    db: DbDep,
    user: CurrentUser,
    role: UserRole | None = None,
    status_filter: UserStatus | None = Query(default=None, alias="status"),
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AdminUserListOut:
    _require_users_manage(user)
    items, total = list_users(
        db, role=role, status=status_filter, q=q, limit=limit, offset=offset
    )
    return AdminUserListOut(items=[AdminUserOut(**i) for i in items], total=total)


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def admin_create_user(
    body: AdminUserCreate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AdminUserOut:
    _require_users_manage(user)
    created = create_user(
        db,
        login=body.login,
        password=body.password,
        full_name=body.full_name,
        role=body.role,
        email=body.email,
        phone=body.phone,
        status=body.status,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=created.id,
        action="admin_create",
        details={"role": body.role.value, "login": body.login},
        correlation_id=cid,
    )
    db.commit()
    created = get_user(db, created.id) or created
    return AdminUserOut(**serialize_admin_user(created))


@router.get("/users/{user_id}", response_model=AdminUserOut)
def admin_get_user(user_id: str, db: DbDep, user: CurrentUser) -> AdminUserOut:
    _require_users_manage(user)
    target = get_user(db, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    return AdminUserOut(**serialize_admin_user(target))


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def admin_patch_user(
    user_id: str,
    body: AdminUserPatch,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AdminUserOut:
    _require_users_manage(user)
    target = get_user(db, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    patch = body.model_dump(exclude_unset=True)
    if user_id == user.id and patch.get("role") and patch["role"] != UserRole.ADMIN:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Нельзя снять с себя роль ADMIN")
    if user_id == user.id and patch.get("status") == UserStatus.DISABLED:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Нельзя отключить себя через PATCH")

    patch_user(db, target, patch)
    if patch.get("status") == UserStatus.DISABLED or patch.get("is_active") is False:
        revoke_user_sessions(db, target.id)

    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=target.id,
        action="admin_patch",
        details={k: str(v) for k, v in patch.items()},
        correlation_id=cid,
    )
    db.commit()
    target = get_user(db, user_id) or target
    return AdminUserOut(**serialize_admin_user(target))


@router.post("/users/{user_id}/disable", response_model=AdminDisableOut)
def admin_disable_user(
    user_id: str, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> AdminDisableOut:
    _require_users_manage(user)
    target = get_user(db, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    target, revoked = disable_user(db, target, actor_id=user.id)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=target.id,
        action="admin_disable",
        details={"sessions_revoked": revoked},
        correlation_id=cid,
    )
    db.commit()
    return AdminDisableOut(
        user_id=target.id,
        status=target.status,
        is_active=target.is_active,
        sessions_revoked=revoked,
    )


@router.post("/users/{user_id}/reset-credentials", response_model=AdminResetCredentialsOut)
def admin_reset_credentials(
    user_id: str,
    body: AdminResetCredentialsIn,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AdminResetCredentialsOut:
    _require_users_manage(user)
    target = get_user(db, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    reset_credentials(db, target, body.password)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="user",
        entity_id=target.id,
        action="admin_reset_credentials",
        correlation_id=cid,
    )
    db.commit()
    return AdminResetCredentialsOut(user_id=target.id)


@router.get("/companies", response_model=AdminCompanyListOut)
def admin_list_companies(
    db: DbDep,
    user: CurrentUser,
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AdminCompanyListOut:
    _require_users_manage(user)
    items, total = list_admin_companies(db, q=q, limit=limit, offset=offset)
    return AdminCompanyListOut(items=[AdminCompanyBrief(**i) for i in items], total=total)


@router.get("/companies/{company_id}/members", response_model=list[AdminMemberOut])
def admin_list_members(company_id: str, db: DbDep, user: CurrentUser) -> list[AdminMemberOut]:
    _require_users_manage(user)
    return [AdminMemberOut(**m) for m in list_members(db, company_id)]


@router.put("/companies/{company_id}/members/{user_id}", response_model=AdminMemberOut)
def admin_put_member(
    company_id: str,
    user_id: str,
    body: AdminMemberPut,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AdminMemberOut:
    _require_users_manage(user)
    membership = upsert_member(
        db,
        company_id=company_id,
        user_id=user_id,
        role=body.role,
        permissions=body.permissions,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_membership",
        entity_id=membership.id,
        action="admin_upsert_member",
        details={"company_id": company_id, "user_id": user_id, "role": body.role.value},
        correlation_id=cid,
    )
    db.commit()
    members = {m["user_id"]: m for m in list_members(db, company_id)}
    return AdminMemberOut(**members[user_id])


@router.delete(
    "/companies/{company_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def admin_delete_member(
    company_id: str,
    user_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> Response:
    _require_users_manage(user)
    delete_member(db, company_id=company_id, user_id=user_id)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_membership",
        entity_id=f"{company_id}:{user_id}",
        action="admin_delete_member",
        details={"company_id": company_id, "user_id": user_id},
        correlation_id=cid,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
