from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.enums import LegalForm, MemberRole, UserRole
from app.deps import CorrelationId, CurrentUser, DbDep
from app.models.company import Company, CompanyMember, RegistrySnapshot
from app.models.finance import FinancialObligation, FinancialSnapshot
from app.models.funding import BusinessGoal
from app.schemas.company import (
    BusinessGoalCreate,
    BusinessGoalOut,
    CompanyCreate,
    CompanyListItem,
    CompanyOut,
    CompanyUpdate,
    FinancialSnapshotOut,
    FinancialSnapshotUpdate,
    ObligationCreate,
    ObligationOut,
    ObligationUpdate,
)
from app.schemas.dashboard import CompanyDashboardOut
from app.schemas.registry import (
    RegistryHistoryItem,
    RegistryLookupIn,
    RegistryLookupOut,
    RegistryVerifyOut,
)
from app.services.access import (
    get_membership,
    list_accessible_companies,
    require_company_access,
    require_roles,
    resolve_company_id,
)
from app.services.audit import write_audit
from app.services.dashboard import build_dashboard
from app.services.finance_engine import calc_required_amount
from app.services import registry as registry_service

router = APIRouter(tags=["companies"])


def _default_ogrn(inn: str, legal_form: LegalForm) -> str:
    if legal_form == LegalForm.IP:
        return (inn + "000")[:15].ljust(15, "0")
    return (inn + "000")[:13].ljust(13, "0")


def _company_out(
    company: Company,
    membership: CompanyMember | None = None,
) -> CompanyOut:
    return CompanyOut(
        id=company.id,
        inn=company.inn,
        name=company.name,
        legal_form=company.legal_form,
        ogrn=company.ogrn,
        industry=company.industry,
        registration_date=company.registration_date,
        region=company.region,
        employees_count=company.employees_count,
        registry_status=company.registry_status,
        version=company.version,
        membership_role=membership.role if membership else None,
        membership_permissions=membership.permissions if membership else None,
    )


@router.get("/companies", response_model=list[CompanyListItem])
def list_companies(db: DbDep, user: CurrentUser) -> list[CompanyListItem]:
    rows = list_accessible_companies(db, user)
    return [
        CompanyListItem(
            id=company.id,
            inn=company.inn,
            name=company.name,
            legal_form=company.legal_form,
            region=company.region,
            industry=company.industry,
            registry_status=company.registry_status,
            version=company.version,
            membership_role=membership.role if membership else None,
        )
        for company, membership in rows
    ]


@router.post("/registry/companies/lookup", response_model=RegistryLookupOut)
def registry_lookup(body: RegistryLookupIn, user: CurrentUser) -> RegistryLookupOut:
    _ = user  # auth обязателен, но lookup не tenant-scoped
    raw = registry_service.lookup(body.inn)
    company = None
    if raw.get("company"):
        company = raw["company"]
    return RegistryLookupOut(
        found=bool(raw["found"]),
        source=raw["source"],
        company=company,
        checked_at=raw["checked_at"],
        inn_valid=bool(raw.get("inn_valid", True)),
    )


@router.post("/companies/{company_id}/registry/verify", response_model=RegistryVerifyOut)
def registry_verify(
    company_id: str, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> RegistryVerifyOut:
    require_company_access(db, user, company_id, write=True)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")

    snap, result = registry_service.verify_company(db, company)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="registry_snapshot",
        entity_id=snap.id,
        action="registry.verify",
        details={
            "company_id": company_id,
            "found": result["found"],
            "match": (result.get("comparison") or {}).get("match"),
            "registry_status": result.get("registry_status"),
        },
        correlation_id=cid,
    )
    db.commit()
    return RegistryVerifyOut(**result)


@router.get("/companies/{company_id}/registry/history", response_model=list[RegistryHistoryItem])
def registry_history(company_id: str, db: DbDep, user: CurrentUser) -> list[RegistrySnapshot]:
    require_company_access(db, user, company_id)
    return list(
        db.scalars(
            select(RegistrySnapshot)
            .where(RegistrySnapshot.company_id == company_id)
            .order_by(RegistrySnapshot.checked_at.desc())
        ).all()
    )


@router.post("/companies", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(
    body: CompanyCreate, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> CompanyOut:
    require_roles(user, UserRole.ENTREPRENEUR)

    expected_inn_len = 12 if body.legal_form == LegalForm.IP else 10
    if len(body.inn) != expected_inn_len:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Для {body.legal_form.value} ИНН должен содержать {expected_inn_len} цифр",
        )

    inn_taken = db.scalar(select(Company.id).where(Company.inn == body.inn))
    if inn_taken is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Компания с таким ИНН уже существует")

    company = Company(
        inn=body.inn,
        name=body.name.strip(),
        legal_form=body.legal_form,
        ogrn=body.ogrn or _default_ogrn(body.inn, body.legal_form),
        industry=body.industry.strip(),
        registration_date=body.registration_date,
        region=body.region.strip(),
        employees_count=body.employees_count,
    )
    db.add(company)
    db.flush()
    membership = CompanyMember(
        company_id=company.id,
        user_id=user.id,
        role=MemberRole.OWNER,
        permissions={"read": True, "write": True, "submit": True},
    )
    db.add(membership)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company",
        entity_id=company.id,
        action="create",
        details={"inn": body.inn, "legal_form": body.legal_form.value},
        correlation_id=cid,
    )
    db.commit()
    db.refresh(company)
    return _company_out(company, membership)


@router.get("/companies/{company_id}", response_model=CompanyOut)
def get_company(company_id: str, db: DbDep, user: CurrentUser) -> CompanyOut:
    require_company_access(db, user, company_id)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")
    membership = get_membership(db, user.id, company_id)
    return _company_out(company, membership)


@router.get("/companies/{company_id}/dashboard", response_model=CompanyDashboardOut)
def company_dashboard(company_id: str, db: DbDep, user: CurrentUser) -> CompanyDashboardOut:
    require_company_access(db, user, company_id)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")
    return CompanyDashboardOut(**build_dashboard(db, company, user))


@router.patch("/companies/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: str, body: CompanyUpdate, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> CompanyOut:
    require_company_access(db, user, company_id, write=True)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")

    patch = body.model_dump(exclude_unset=True)
    expected_version = patch.pop("version", None)
    if expected_version is not None and expected_version != company.version:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Конфликт версии: ожидали {expected_version}, сейчас {company.version}",
        )
    if not patch:
        membership = get_membership(db, user.id, company_id)
        return _company_out(company, membership)

    before = {
        "name": company.name,
        "industry": company.industry,
        "region": company.region,
        "employees_count": company.employees_count,
        "version": company.version,
    }
    for k, v in patch.items():
        setattr(company, k, v)
    company.version = int(company.version or 1) + 1

    write_audit(
        db,
        actor_id=user.id,
        entity_type="company",
        entity_id=company_id,
        action="update",
        details={"before": before, "after": patch, "version": company.version},
        correlation_id=cid,
    )
    db.commit()
    db.refresh(company)
    membership = get_membership(db, user.id, company_id)
    return _company_out(company, membership)

@router.get("/companies/{company_id}/financials", response_model=FinancialSnapshotOut)
def get_financials(company_id: str, db: DbDep, user: CurrentUser) -> FinancialSnapshot:
    require_company_access(db, user, company_id)
    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    if snap is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Финансовые данные не найдены")
    return snap

@router.patch("/companies/{company_id}/financials", response_model=FinancialSnapshotOut)
def update_financials(
    company_id: str,
    body: FinancialSnapshotUpdate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> FinancialSnapshot:
    require_company_access(db, user, company_id, write=True)
    snap = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    if snap is None:
        data = body.model_dump(exclude_unset=True)
        snap = FinancialSnapshot(
            company_id=company_id,
            period=data.get("period", "2026-09"),
            avg_monthly_revenue=data.get("avg_monthly_revenue", 0),
            operating_expenses=data.get("operating_expenses", 0),
            cash_balance=data.get("cash_balance", 0),
            liabilities=data.get("liabilities", 0),
            active_credits=data.get("active_credits", 0),
            source=data.get("source", "manual"),
            confirmed=data.get("confirmed", False),
        )
        db.add(snap)
    else:
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(snap, k, v)
        if body.source is None:
            snap.source = "manual"
    write_audit(
        db,
        actor_id=user.id,
        entity_type="financial_snapshot",
        entity_id=snap.id if snap.id else company_id,
        action="update",
        correlation_id=cid,
    )
    db.commit()
    db.refresh(snap)
    return snap

@router.get("/obligations", response_model=list[ObligationOut])
def list_obligations(db: DbDep, user: CurrentUser, company_id: str | None = None) -> list[FinancialObligation]:
    cid = resolve_company_id(db, user, company_id)
    return list(
        db.scalars(
            select(FinancialObligation)
            .where(FinancialObligation.company_id == cid)
            .order_by(FinancialObligation.due_date)
        ).all()
    )

@router.post("/obligations", response_model=ObligationOut, status_code=201)
def create_obligation(body: ObligationCreate, db: DbDep, user: CurrentUser) -> FinancialObligation:
    cid = resolve_company_id(db, user, body.company_id)
    require_company_access(db, user, cid, write=True)
    ob = FinancialObligation(
        company_id=cid,
        type=body.type,
        title=body.title,
        amount=body.amount,
        due_date=body.due_date,
        recurring=body.recurring,
        status=body.status,
        currency=body.currency,
    )
    db.add(ob)
    db.commit()
    db.refresh(ob)
    return ob

@router.patch("/obligations/{obligation_id}", response_model=ObligationOut)
def update_obligation(
    obligation_id: str, body: ObligationUpdate, db: DbDep, user: CurrentUser
) -> FinancialObligation:
    ob = db.get(FinancialObligation, obligation_id)
    if ob is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Обязательство не найдено")
    require_company_access(db, user, ob.company_id, write=True)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ob, k, v)
    db.commit()
    db.refresh(ob)
    return ob

@router.post("/business-goals", response_model=BusinessGoalOut, status_code=201)
def create_business_goal(
    body: BusinessGoalCreate, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> BusinessGoal:
    require_company_access(db, user, body.company_id, write=True)
    required = calc_required_amount(body.costs, body.reserve, body.own_funds, body.other_funding)
    goal = BusinessGoal(
        company_id=body.company_id,
        goal_type=body.goal_type,
        title=body.title,
        description=body.description,
        costs={k: str(v) for k, v in body.costs.items()},
        reserve=body.reserve,
        own_funds=body.own_funds,
        other_funding=body.other_funding,
        required_amount=required,
        target_date=body.target_date,
        term_months=body.term_months,
    )
    db.add(goal)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="business_goal",
        entity_id="pending",
        action="create",
        details={"goal_type": body.goal_type.value, "required_amount": str(required)},
        correlation_id=cid,
    )
    db.commit()
    db.refresh(goal)
    return goal

@router.get("/companies/{company_id}/business-goals", response_model=list[BusinessGoalOut])
def list_goals(company_id: str, db: DbDep, user: CurrentUser) -> list[BusinessGoal]:
    require_company_access(db, user, company_id)
    return list(
        db.scalars(
            select(BusinessGoal)
            .where(BusinessGoal.company_id == company_id)
            .order_by(BusinessGoal.created_at.desc())
        ).all()
    )

@router.get("/business-goals/{goal_id}", response_model=BusinessGoalOut)
def get_goal(goal_id: str, db: DbDep, user: CurrentUser) -> BusinessGoal:
    goal = db.get(BusinessGoal, goal_id)
    if goal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Цель не найдена")
    require_company_access(db, user, goal.company_id)
    return goal
