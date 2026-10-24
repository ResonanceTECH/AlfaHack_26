from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.enums import LegalForm, MemberRole
from app.deps import CorrelationId, CurrentUser, DbDep
from app.models.company import Company, CompanyMember
from app.models.finance import FinancialObligation, FinancialSnapshot
from app.models.funding import BusinessGoal
from app.schemas.company import (
    BusinessGoalCreate,
    BusinessGoalOut,
    CompanyCreate,
    CompanyOut,
    CompanyUpdate,
    FinancialSnapshotOut,
    FinancialSnapshotUpdate,
    ObligationCreate,
    ObligationOut,
    ObligationUpdate,
)
from app.services.access import require_company_access, resolve_company_id
from app.services.audit import write_audit
from app.services.finance_engine import calc_required_amount

router = APIRouter(tags=["companies"])


def _default_ogrn(inn: str, legal_form: LegalForm) -> str:
    if legal_form == LegalForm.IP:
        return (inn + "000")[:15].ljust(15, "0")
    return (inn + "000")[:13].ljust(13, "0")


@router.post("/companies", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(
    body: CompanyCreate, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> Company:
    if user.company_id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="У пользователя уже есть компания",
        )

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
    db.add(
        CompanyMember(
            company_id=company.id,
            user_id=user.id,
            role=MemberRole.OWNER,
            permissions={"read": True, "write": True, "submit": True},
        )
    )
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
    return company


@router.get("/companies/{company_id}", response_model=CompanyOut)
def get_company(company_id: str, db: DbDep, user: CurrentUser) -> Company:
    require_company_access(db, user, company_id)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")
    return company

@router.patch("/companies/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: str, body: CompanyUpdate, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> Company:
    require_company_access(db, user, company_id, write=True)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(company, k, v)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company",
        entity_id=company_id,
        action="update",
        details=body.model_dump(exclude_unset=True, mode="json"),
        correlation_id=cid,
    )
    db.commit()
    db.refresh(company)
    return company

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
