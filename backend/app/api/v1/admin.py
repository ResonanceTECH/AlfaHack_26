from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException, Query, Response, status

from app.core.enums import Permission, PolicyStatus, ProductStatus, ProductType, UserRole, UserStatus
from app.deps import CorrelationId, CurrentUser, DbDep
from app.schemas.admin import (
    AdminCompanyBrief,
    AdminCompanyListOut,
    AdminCreditProductCreate,
    AdminCreditProductListOut,
    AdminCreditProductOut,
    AdminCreditProductPatch,
    AdminCreditProductPublishIn,
    AdminCreditProductVersionOut,
    AdminDisableOut,
    AdminMemberOut,
    AdminMemberPut,
    AdminModelActivateIn,
    AdminModelActivateOut,
    AdminModelActiveOut,
    AdminModelEvaluationOut,
    AdminModelOut,
    AdminModelValidateOut,
    AdminPermissionOut,
    AdminPolicyCreate,
    AdminPolicyDiffOut,
    AdminPolicyListOut,
    AdminPolicyOut,
    AdminPolicyPatch,
    AdminPolicyPublishIn,
    AdminPolicySimulateAccepted,
    AdminPolicySimulateIn,
    AdminPolicySimulationOut,
    AdminPolicyValidateOut,
    AdminPolicyVersionOut,
    AdminResetCredentialsIn,
    AdminResetCredentialsOut,
    AdminRoleOut,
    AdminRuntimeConfigOut,
    AdminRuntimeConfigPatch,
    AdminUserCreate,
    AdminUserListOut,
    AdminUserOut,
    AdminUserPatch,
)
from app.services.access import require_permission, require_roles
from app.services.admin_models import (
    activate_model,
    get_model,
    get_runtime_config,
    list_active as list_active_models,
    list_evaluations,
    list_models,
    patch_runtime_config,
    serialize_model,
    validate_model,
)
from app.services.admin_policies import (
    create_policy,
    diff_versions as diff_policy_versions,
    get_policy,
    get_simulation,
    list_policies,
    list_versions as list_policy_versions,
    patch_policy,
    publish_policy,
    serialize_policy,
    start_simulation,
    validate_rules,
)
from app.services.admin_products import (
    archive_product,
    create_product,
    get_product,
    list_products,
    list_versions,
    patch_product,
    publish_product,
    serialize_product,
)
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


def _require_catalog_manage(user: CurrentUser) -> None:
    _require_admin(user)
    require_permission(user, Permission.CATALOG_MANAGE)


def _require_policy_edit(user: CurrentUser) -> None:
    _require_admin(user)
    require_permission(user, Permission.POLICY_EDIT)


def _require_policy_publish(user: CurrentUser) -> None:
    _require_admin(user)
    require_permission(user, Permission.POLICY_PUBLISH)


def _require_models_manage(user: CurrentUser) -> None:
    _require_admin(user)
    require_permission(user, Permission.MODELS_MANAGE)


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


@router.get("/credit-products", response_model=AdminCreditProductListOut)
def admin_list_credit_products(
    db: DbDep,
    user: CurrentUser,
    status_filter: ProductStatus | None = Query(default=None, alias="status"),
    product_type: ProductType | None = Query(default=None, alias="type"),
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AdminCreditProductListOut:
    _require_catalog_manage(user)
    items, total = list_products(
        db, status=status_filter, product_type=product_type, q=q, limit=limit, offset=offset
    )
    return AdminCreditProductListOut(items=[AdminCreditProductOut(**i) for i in items], total=total)


@router.post(
    "/credit-products",
    response_model=AdminCreditProductOut,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_credit_product(
    body: AdminCreditProductCreate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AdminCreditProductOut:
    _require_catalog_manage(user)
    created = create_product(db, body.model_dump(exclude_none=True), actor_id=user.id)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="credit_product",
        entity_id=created.id,
        action="admin_create",
        details={"code": created.code, "status": created.status.value},
        correlation_id=cid,
    )
    db.commit()
    created = get_product(db, created.id) or created
    return AdminCreditProductOut(**serialize_product(created, include_versions=True))


@router.get("/credit-products/{product_id}", response_model=AdminCreditProductOut)
def admin_get_credit_product(
    product_id: str, db: DbDep, user: CurrentUser
) -> AdminCreditProductOut:
    _require_catalog_manage(user)
    product = get_product(db, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Продукт не найден")
    return AdminCreditProductOut(**serialize_product(product, include_versions=True))


@router.patch("/credit-products/{product_id}", response_model=AdminCreditProductOut)
def admin_patch_credit_product(
    product_id: str,
    body: AdminCreditProductPatch,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AdminCreditProductOut:
    _require_catalog_manage(user)
    product = get_product(db, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Продукт не найден")
    patch = body.model_dump(exclude_unset=True)
    patch_product(db, product, patch)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="credit_product",
        entity_id=product.id,
        action="admin_patch",
        details={"fields": list(patch.keys()), "status": product.status.value},
        correlation_id=cid,
    )
    db.commit()
    product = get_product(db, product_id) or product
    return AdminCreditProductOut(**serialize_product(product, include_versions=True))


@router.post("/credit-products/{product_id}/publish", response_model=AdminCreditProductOut)
def admin_publish_credit_product(
    product_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    body: AdminCreditProductPublishIn = Body(default_factory=AdminCreditProductPublishIn),
) -> AdminCreditProductOut:
    _require_catalog_manage(user)
    product = get_product(db, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Продукт не найден")
    publish_product(db, product, actor_id=user.id, changelog=body.changelog)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="credit_product",
        entity_id=product.id,
        action="admin_publish",
        details={"version": product.version},
        correlation_id=cid,
    )
    db.commit()
    product = get_product(db, product_id) or product
    return AdminCreditProductOut(**serialize_product(product, include_versions=True))


@router.post("/credit-products/{product_id}/archive", response_model=AdminCreditProductOut)
def admin_archive_credit_product(
    product_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AdminCreditProductOut:
    _require_catalog_manage(user)
    product = get_product(db, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Продукт не найден")
    archive_product(db, product)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="credit_product",
        entity_id=product.id,
        action="admin_archive",
        details={"version": product.version},
        correlation_id=cid,
    )
    db.commit()
    product = get_product(db, product_id) or product
    return AdminCreditProductOut(**serialize_product(product, include_versions=True))


@router.get(
    "/credit-products/{product_id}/versions",
    response_model=list[AdminCreditProductVersionOut],
)
def admin_credit_product_versions(
    product_id: str, db: DbDep, user: CurrentUser
) -> list[AdminCreditProductVersionOut]:
    _require_catalog_manage(user)
    return [AdminCreditProductVersionOut(**v) for v in list_versions(db, product_id)]


@router.get("/policies", response_model=AdminPolicyListOut)
def admin_list_policies(
    db: DbDep,
    user: CurrentUser,
    status_filter: PolicyStatus | None = Query(default=None, alias="status"),
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AdminPolicyListOut:
    _require_policy_edit(user)
    items, total = list_policies(db, status=status_filter, q=q, limit=limit, offset=offset)
    return AdminPolicyListOut(items=[AdminPolicyOut(**i) for i in items], total=total)


@router.post("/policies", response_model=AdminPolicyOut, status_code=status.HTTP_201_CREATED)
def admin_create_policy(
    body: AdminPolicyCreate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AdminPolicyOut:
    _require_policy_edit(user)
    created = create_policy(db, body.model_dump(), actor_id=user.id)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="credit_policy",
        entity_id=created.id,
        action="admin_create",
        details={"code": created.code},
        correlation_id=cid,
    )
    db.commit()
    created = get_policy(db, created.id) or created
    return AdminPolicyOut(**serialize_policy(created, include_versions=True))


@router.get("/policies/{policy_id}", response_model=AdminPolicyOut)
def admin_get_policy(policy_id: str, db: DbDep, user: CurrentUser) -> AdminPolicyOut:
    _require_policy_edit(user)
    policy = get_policy(db, policy_id)
    if policy is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Политика не найдена")
    return AdminPolicyOut(**serialize_policy(policy, include_versions=True))


@router.patch("/policies/{policy_id}", response_model=AdminPolicyOut)
def admin_patch_policy(
    policy_id: str,
    body: AdminPolicyPatch,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AdminPolicyOut:
    _require_policy_edit(user)
    policy = get_policy(db, policy_id)
    if policy is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Политика не найдена")
    patch = body.model_dump(exclude_unset=True)
    patch_policy(db, policy, patch)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="credit_policy",
        entity_id=policy.id,
        action="admin_patch",
        details={"fields": list(patch.keys()), "status": policy.status.value},
        correlation_id=cid,
    )
    db.commit()
    policy = get_policy(db, policy_id) or policy
    return AdminPolicyOut(**serialize_policy(policy, include_versions=True))


@router.get("/policies/{policy_id}/versions", response_model=list[AdminPolicyVersionOut])
def admin_policy_versions(
    policy_id: str, db: DbDep, user: CurrentUser
) -> list[AdminPolicyVersionOut]:
    _require_policy_edit(user)
    return [AdminPolicyVersionOut(**v) for v in list_policy_versions(db, policy_id)]


@router.post("/policies/{policy_id}/validate", response_model=AdminPolicyValidateOut)
def admin_validate_policy(policy_id: str, db: DbDep, user: CurrentUser) -> AdminPolicyValidateOut:
    _require_policy_edit(user)
    policy = get_policy(db, policy_id)
    if policy is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Политика не найдена")
    return AdminPolicyValidateOut(**validate_rules(policy.rules or {}))


@router.post(
    "/policies/{policy_id}/simulate",
    response_model=AdminPolicySimulateAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
def admin_simulate_policy(
    policy_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    body: AdminPolicySimulateIn = Body(default_factory=AdminPolicySimulateIn),
) -> AdminPolicySimulateAccepted:
    _require_policy_edit(user)
    policy = get_policy(db, policy_id)
    if policy is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Политика не найдена")
    sim = start_simulation(
        db,
        policy,
        actor_id=user.id,
        draft_version=body.draft_version,
        scenario_ids=body.scenario_ids,
        compare_with_published=body.compare_with_published,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="policy_simulation",
        entity_id=sim.id,
        action="admin_simulate",
        details={"policy_id": policy.id},
        correlation_id=cid,
    )
    db.commit()
    return AdminPolicySimulateAccepted(run_id=sim.id, status="QUEUED")


@router.get(
    "/policies/{policy_id}/simulations/{run_id}",
    response_model=AdminPolicySimulationOut,
)
def admin_get_policy_simulation(
    policy_id: str, run_id: str, db: DbDep, user: CurrentUser
) -> AdminPolicySimulationOut:
    _require_policy_edit(user)
    return AdminPolicySimulationOut(**get_simulation(db, policy_id, run_id))


@router.post("/policies/{policy_id}/publish", response_model=AdminPolicyOut)
def admin_publish_policy(
    policy_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    body: AdminPolicyPublishIn = Body(default_factory=AdminPolicyPublishIn),
) -> AdminPolicyOut:
    _require_policy_publish(user)
    policy = get_policy(db, policy_id)
    if policy is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Политика не найдена")
    publish_policy(db, policy, actor_id=user.id, changelog=body.changelog)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="credit_policy",
        entity_id=policy.id,
        action="admin_publish",
        details={"version": policy.version},
        correlation_id=cid,
    )
    db.commit()
    policy = get_policy(db, policy_id) or policy
    return AdminPolicyOut(**serialize_policy(policy, include_versions=True))


@router.get("/policies/{policy_id}/diff", response_model=AdminPolicyDiffOut)
def admin_policy_diff(
    policy_id: str,
    db: DbDep,
    user: CurrentUser,
    from_version: str = Query(alias="from"),
    to_version: str = Query(alias="to"),
) -> AdminPolicyDiffOut:
    _require_policy_edit(user)
    return AdminPolicyDiffOut(**diff_policy_versions(db, policy_id, from_version, to_version))


@router.get("/models", response_model=list[AdminModelOut])
def admin_list_models(
    db: DbDep,
    user: CurrentUser,
    task: str | None = None,
) -> list[AdminModelOut]:
    _require_models_manage(user)
    return [AdminModelOut(**m) for m in list_models(db, task=task)]


@router.get("/models/active", response_model=list[AdminModelActiveOut])
def admin_active_models(db: DbDep, user: CurrentUser) -> list[AdminModelActiveOut]:
    _require_models_manage(user)
    return [AdminModelActiveOut(**m) for m in list_active_models(db)]


@router.get("/models/evaluations", response_model=list[AdminModelEvaluationOut])
def admin_all_model_evaluations(db: DbDep, user: CurrentUser) -> list[AdminModelEvaluationOut]:
    _require_models_manage(user)
    return [AdminModelEvaluationOut(**e) for e in list_evaluations(db)]


@router.get("/models/{model_id}", response_model=AdminModelOut)
def admin_get_model(model_id: str, db: DbDep, user: CurrentUser) -> AdminModelOut:
    _require_models_manage(user)
    model = get_model(db, model_id)
    if model is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Модель не найдена")
    return AdminModelOut(**serialize_model(model, include_evals=True))


@router.post("/models/{model_id}/validate", response_model=AdminModelValidateOut)
def admin_validate_model(model_id: str, db: DbDep, user: CurrentUser) -> AdminModelValidateOut:
    _require_models_manage(user)
    model = get_model(db, model_id)
    if model is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Модель не найдена")
    return AdminModelValidateOut(**validate_model(db, model))


@router.post("/models/{model_id}/activate", response_model=AdminModelActivateOut)
def admin_activate_model(
    model_id: str,
    body: AdminModelActivateIn,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AdminModelActivateOut:
    _require_models_manage(user)
    model = get_model(db, model_id)
    if model is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Модель не найдена")
    result = activate_model(
        db,
        model,
        task=body.task,
        expected_model_version=body.expected_model_version,
        reason=body.reason,
        actor_id=user.id,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="ml_model",
        entity_id=model_id,
        action="admin_activate",
        details={
            "task": body.task,
            "status": result["status"],
            "reason": body.reason,
            "expected_model_version": body.expected_model_version,
        },
        correlation_id=cid,
    )
    db.commit()
    return AdminModelActivateOut(**result)


@router.get(
    "/models/{model_id}/evaluations",
    response_model=list[AdminModelEvaluationOut],
)
def admin_model_evaluations(
    model_id: str, db: DbDep, user: CurrentUser
) -> list[AdminModelEvaluationOut]:
    _require_models_manage(user)
    model = get_model(db, model_id)
    if model is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Модель не найдена")
    return [AdminModelEvaluationOut(**e) for e in list_evaluations(db, model_id=model_id)]


@router.get("/config/runtime", response_model=AdminRuntimeConfigOut)
def admin_get_runtime_config(user: CurrentUser) -> AdminRuntimeConfigOut:
    _require_models_manage(user)
    return AdminRuntimeConfigOut(**get_runtime_config())


@router.patch("/config/runtime", response_model=AdminRuntimeConfigOut)
def admin_patch_runtime_config(
    body: AdminRuntimeConfigPatch,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> AdminRuntimeConfigOut:
    _require_models_manage(user)
    result = patch_runtime_config(body.parameters)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="runtime_config",
        entity_id="runtime",
        action="admin_patch_runtime",
        details={"applied": result.get("applied"), "rejected": result.get("rejected")},
        correlation_id=cid,
    )
    db.commit()
    return AdminRuntimeConfigOut(**result)
