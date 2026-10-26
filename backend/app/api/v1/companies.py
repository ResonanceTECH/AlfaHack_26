from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.enums import LegalForm, MemberRole, UserRole
from app.deps import CorrelationId, CurrentUser, DbDep
from app.models.company import Company, CompanyMember, RegistrySnapshot
from app.models.finance import FinancialObligation, FinancialSnapshot
from app.models.funding import FundingNeed, FundingNeedItem
from app.schemas.common import MessageOut
from app.schemas.company import (
    CalendarReminderSettings,
    CalendarReminderSettingsPatch,
    CompanyCreate,
    CompanyDocumentOut,
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
from app.schemas.funding import (
    GOAL_CATALOG,
    BusinessGoalCatalogItem,
    FundingNeedCreate,
    FundingNeedItemIn,
    FundingNeedItemOut,
    FundingNeedItemUpdate,
    FundingNeedOut,
    FundingNeedUpdate,
)
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
from app.services.calendar_ics import build_calendar_ics
from app.services.calendar_reminders import (
    dispatch_obligation_reminders,
    get_company_reminder_settings,
    save_company_reminder_settings,
)
from app.services.company_documents import (
    create_document,
    delete_document,
    list_documents,
    require_document,
    serialize_document,
)
from app.services.dashboard import build_dashboard
from app.services.documents import resolve_download_path
from app.services.funding import (
    costs_from_items,
    load_need,
    recompute_required,
    replace_items,
    serialize_need,
)
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

def _obligation_out(ob: FinancialObligation) -> ObligationOut:
    meta = ob.meta or {}
    if ob.due_date is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Обязательство без даты")
    return ObligationOut(
        id=ob.id,
        company_id=ob.company_id,
        type=ob.type,
        title=ob.title or ob.creditor or ob.type,
        amount=ob.amount,
        due_date=ob.due_date,
        recurring=bool(ob.recurring),
        status=ob.status or "planned",
        currency=str(meta.get("currency") or "RUB"),
    )


@router.get("/obligations", response_model=list[ObligationOut])
def list_obligations(
    db: DbDep,
    user: CurrentUser,
    company_id: str | None = Query(default=None, alias="companyId"),
) -> list[ObligationOut]:
    cid = resolve_company_id(db, user, company_id)
    rows = list(
        db.scalars(
            select(FinancialObligation)
            .where(FinancialObligation.company_id == cid)
            .order_by(FinancialObligation.due_date)
        ).all()
    )
    return [_obligation_out(r) for r in rows if r.due_date is not None]


@router.post("/obligations", response_model=ObligationOut, status_code=201)
def create_obligation(body: ObligationCreate, db: DbDep, user: CurrentUser) -> ObligationOut:
    cid = resolve_company_id(db, user, body.company_id)
    require_company_access(db, user, cid, write=True)
    ob = FinancialObligation(
        company_id=cid,
        type=body.type,
        title=body.title,
        amount=body.amount,
        due_date=body.due_date,
        recurring=body.recurring,
        status=body.status or "planned",
        meta={"currency": body.currency or "RUB"},
    )
    db.add(ob)
    db.commit()
    db.refresh(ob)
    return _obligation_out(ob)


@router.patch("/obligations/{obligation_id}", response_model=ObligationOut)
def update_obligation(
    obligation_id: str, body: ObligationUpdate, db: DbDep, user: CurrentUser
) -> ObligationOut:
    ob = db.get(FinancialObligation, obligation_id)
    if ob is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Обязательство не найдено")
    require_company_access(db, user, ob.company_id, write=True)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(ob, k, v)
    db.commit()
    db.refresh(ob)
    return _obligation_out(ob)


@router.get(
    "/companies/{company_id}/calendar.ics",
    responses={200: {"content": {"text/calendar": {}}}},
)
def export_company_calendar_ics(
    company_id: str,
    db: DbDep,
    user: CurrentUser,
    month: str | None = Query(default=None, description="YYYY-MM"),
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
) -> Response:
    require_company_access(db, user, company_id)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")
    settings = get_company_reminder_settings(company)
    alarm_days = settings["days_before"] if settings.get("enabled") else []

    d_from, d_to = date_from, date_to
    if month and not (d_from or d_to):
        try:
            y_s, m_s = month.split("-", 1)
            y, m = int(y_s), int(m_s)
            d_from = date(y, m, 1)
            if m == 12:
                d_to = date(y + 1, 1, 1) - timedelta(days=1)
            else:
                d_to = date(y, m + 1, 1) - timedelta(days=1)
        except ValueError as exc:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, detail="month должен быть YYYY-MM"
            ) from exc

    rows = list(
        db.scalars(
            select(FinancialObligation)
            .where(FinancialObligation.company_id == company_id)
            .order_by(FinancialObligation.due_date)
        ).all()
    )
    ics = build_calendar_ics(
        rows,
        calendar_name=f"{company.name} — календарь",
        alarm_days=alarm_days,
        date_from=d_from,
        date_to=d_to,
    )
    filename = f"calendar-{company_id}"
    if month:
        filename = f"calendar-{month}"
    return Response(
        content=ics.encode("utf-8"),
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}.ics"',
        },
    )


@router.get(
    "/companies/{company_id}/calendar/reminder-settings",
    response_model=CalendarReminderSettings,
)
def get_reminder_settings(
    company_id: str, db: DbDep, user: CurrentUser
) -> CalendarReminderSettings:
    require_company_access(db, user, company_id)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")
    return CalendarReminderSettings(**get_company_reminder_settings(company))


@router.patch(
    "/companies/{company_id}/calendar/reminder-settings",
    response_model=CalendarReminderSettings,
)
def patch_reminder_settings(
    company_id: str,
    body: CalendarReminderSettingsPatch,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> CalendarReminderSettings:
    require_company_access(db, user, company_id, write=True)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")
    settings = save_company_reminder_settings(
        company, body.model_dump(exclude_unset=True)
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company",
        entity_id=company_id,
        action="calendar_reminder_settings",
        details=settings,
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    return CalendarReminderSettings(**settings)


@router.post(
    "/companies/{company_id}/calendar/reminders/dispatch",
    response_model=MessageOut,
)
def dispatch_reminders(
    company_id: str, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> MessageOut:
    """Создать in-app уведомления по текущим настройкам (для демо / cron-хука)."""
    require_company_access(db, user, company_id, write=True)
    n = dispatch_obligation_reminders(db, company_id=company_id)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company",
        entity_id=company_id,
        action="calendar_reminders_dispatch",
        details={"created": n},
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    return MessageOut(message=f"created:{n}")

def _get_company_need(db: DbDep, company_id: str, need_id: str, user: CurrentUser) -> FundingNeed:
    require_company_access(db, user, company_id)
    need = load_need(db, need_id)
    if need is None or need.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Потребность не найдена")
    return need


@router.get("/business-goals", response_model=list[BusinessGoalCatalogItem])
def list_business_goal_catalog(user: CurrentUser) -> list[BusinessGoalCatalogItem]:
    _ = user
    return [BusinessGoalCatalogItem(**row) for row in GOAL_CATALOG]


@router.get("/companies/{company_id}/funding-needs", response_model=list[FundingNeedOut])
def list_funding_needs(company_id: str, db: DbDep, user: CurrentUser) -> list[FundingNeedOut]:
    require_company_access(db, user, company_id)
    rows = db.scalars(
        select(FundingNeed)
        .options(joinedload(FundingNeed.items))
        .where(FundingNeed.company_id == company_id)
        .order_by(FundingNeed.created_at.desc())
    ).unique().all()
    return [FundingNeedOut(**serialize_need(n)) for n in rows]


@router.post(
    "/companies/{company_id}/funding-needs",
    response_model=FundingNeedOut,
    status_code=status.HTTP_201_CREATED,
)
def create_funding_need(
    company_id: str,
    body: FundingNeedCreate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> FundingNeedOut:
    require_company_access(db, user, company_id, write=True)
    items_raw = [i.model_dump() for i in body.items]
    if body.costs and items_raw:
        costs = {k: Decimal(str(v)) for k, v in body.costs.items()}
        for k, v in costs_from_items(items_raw).items():
            costs[k] = costs.get(k, Decimal("0")) + v
    elif body.costs:
        costs = {k: Decimal(str(v)) for k, v in body.costs.items()}
    else:
        costs = costs_from_items(items_raw)

    required = recompute_required(
        costs=costs,
        reserve=body.reserve,
        own_funds=body.own_funds,
        other_funding=body.other_funding,
        override=body.required_amount,
    )
    need = FundingNeed(
        company_id=company_id,
        goal_type=body.goal_type,
        title=body.title,
        description=body.description,
        costs={k: str(v) for k, v in costs.items()},
        reserve=body.reserve,
        own_funds=body.own_funds,
        other_funding=body.other_funding,
        required_amount=required,
        target_date=body.target_date,
        term_months=body.term_months,
        urgency=body.urgency,
        currency=body.currency,
    )
    db.add(need)
    db.flush()
    if items_raw:
        replace_items(db, need, items_raw)

    write_audit(
        db,
        actor_id=user.id,
        entity_type="funding_need",
        entity_id=need.id,
        action="create",
        details={
            "goal_type": body.goal_type.value,
            "required_amount": str(required),
            "items": len(items_raw),
        },
        correlation_id=cid,
    )
    db.commit()
    need = load_need(db, need.id)
    assert need is not None
    return FundingNeedOut(**serialize_need(need))


@router.get(
    "/companies/{company_id}/funding-needs/{need_id}",
    response_model=FundingNeedOut,
)
def get_funding_need(
    company_id: str, need_id: str, db: DbDep, user: CurrentUser
) -> FundingNeedOut:
    need = _get_company_need(db, company_id, need_id, user)
    return FundingNeedOut(**serialize_need(need))


@router.patch(
    "/companies/{company_id}/funding-needs/{need_id}",
    response_model=FundingNeedOut,
)
def update_funding_need(
    company_id: str,
    need_id: str,
    body: FundingNeedUpdate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> FundingNeedOut:
    require_company_access(db, user, company_id, write=True)
    need = load_need(db, need_id)
    if need is None or need.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Потребность не найдена")

    patch = body.model_dump(exclude_unset=True)
    items_raw = None
    if "items" in patch:
        items_raw = [i.model_dump() if hasattr(i, "model_dump") else i for i in (body.items or [])]
        patch.pop("items", None)

    for k, v in patch.items():
        if k == "costs" and v is not None:
            setattr(need, k, {ck: str(cv) for ck, cv in v.items()})
        elif k == "title" and isinstance(v, str):
            setattr(need, k, v.strip())
        else:
            setattr(need, k, v)

    if items_raw is not None:
        replace_items(db, need, items_raw)
        if body.costs is None:
            need.costs = {k: str(v) for k, v in costs_from_items(items_raw).items()}

    costs = {k: v for k, v in (need.costs or {}).items()}
    if body.required_amount is None:
        need.required_amount = recompute_required(
            costs=costs,
            reserve=need.reserve,
            own_funds=need.own_funds,
            other_funding=need.other_funding,
        )

    write_audit(
        db,
        actor_id=user.id,
        entity_type="funding_need",
        entity_id=need.id,
        action="update",
        details=body.model_dump(exclude_unset=True, mode="json"),
        correlation_id=cid,
    )
    db.commit()
    need = load_need(db, need.id)
    assert need is not None
    return FundingNeedOut(**serialize_need(need))


@router.delete(
    "/companies/{company_id}/funding-needs/{need_id}",
    response_model=FundingNeedOut,
)
def archive_funding_need(
    company_id: str, need_id: str, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> FundingNeedOut:
    require_company_access(db, user, company_id, write=True)
    need = load_need(db, need_id)
    if need is None or need.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Потребность не найдена")
    need.status = "ARCHIVED"
    write_audit(
        db,
        actor_id=user.id,
        entity_type="funding_need",
        entity_id=need.id,
        action="archive",
        correlation_id=cid,
    )
    db.commit()
    need = load_need(db, need.id)
    assert need is not None
    return FundingNeedOut(**serialize_need(need))


@router.post(
    "/companies/{company_id}/funding-needs/{need_id}/items",
    response_model=FundingNeedItemOut,
    status_code=status.HTTP_201_CREATED,
)
def add_funding_need_item(
    company_id: str,
    need_id: str,
    body: FundingNeedItemIn,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> FundingNeedItemOut:
    require_company_access(db, user, company_id, write=True)
    need = load_need(db, need_id)
    if need is None or need.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Потребность не найдена")

    item = FundingNeedItem(
        need_id=need.id,
        name=body.name.strip(),
        amount=body.amount,
        quantity=body.quantity,
        unit=body.unit,
        meta=body.meta,
    )
    db.add(item)
    db.flush()
    need = load_need(db, need_id)
    assert need is not None
    need.costs = {k: str(v) for k, v in costs_from_items(need.items).items()}
    need.required_amount = recompute_required(
        costs=need.costs,
        reserve=need.reserve,
        own_funds=need.own_funds,
        other_funding=need.other_funding,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="funding_need_item",
        entity_id=item.id,
        action="create",
        details={"need_id": need.id, "amount": str(body.amount)},
        correlation_id=cid,
    )
    db.commit()
    db.refresh(item)
    return FundingNeedItemOut(
        id=item.id,
        need_id=item.need_id,
        name=item.name,
        amount=item.amount,
        quantity=item.quantity,
        unit=item.unit,
        meta=item.meta or {},
        created_at=item.created_at,
    )


@router.patch(
    "/companies/{company_id}/funding-needs/{need_id}/items/{item_id}",
    response_model=FundingNeedItemOut,
)
def update_funding_need_item(
    company_id: str,
    need_id: str,
    item_id: str,
    body: FundingNeedItemUpdate,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> FundingNeedItemOut:
    require_company_access(db, user, company_id, write=True)
    need = load_need(db, need_id)
    if need is None or need.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Потребность не найдена")
    item = db.get(FundingNeedItem, item_id)
    if item is None or item.need_id != need.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Статья бюджета не найдена")

    for k, v in body.model_dump(exclude_unset=True).items():
        if k == "name" and isinstance(v, str):
            setattr(item, k, v.strip())
        else:
            setattr(item, k, v)

    db.flush()
    need = load_need(db, need_id)
    assert need is not None
    need.costs = {k: str(v) for k, v in costs_from_items(need.items).items()}
    need.required_amount = recompute_required(
        costs=need.costs,
        reserve=need.reserve,
        own_funds=need.own_funds,
        other_funding=need.other_funding,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="funding_need_item",
        entity_id=item.id,
        action="update",
        details=body.model_dump(exclude_unset=True, mode="json"),
        correlation_id=cid,
    )
    db.commit()
    db.refresh(item)
    return FundingNeedItemOut(
        id=item.id,
        need_id=item.need_id,
        name=item.name,
        amount=item.amount,
        quantity=item.quantity,
        unit=item.unit,
        meta=item.meta or {},
        created_at=item.created_at,
    )


@router.delete(
    "/companies/{company_id}/funding-needs/{need_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_funding_need_item(
    company_id: str,
    need_id: str,
    item_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> Response:
    require_company_access(db, user, company_id, write=True)
    need = load_need(db, need_id)
    if need is None or need.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Потребность не найдена")
    item = db.get(FundingNeedItem, item_id)
    if item is None or item.need_id != need.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Статья бюджета не найдена")

    db.delete(item)
    db.flush()
    need = load_need(db, need_id)
    assert need is not None
    need.costs = {k: str(v) for k, v in costs_from_items(need.items).items()}
    need.required_amount = recompute_required(
        costs=need.costs,
        reserve=need.reserve,
        own_funds=need.own_funds,
        other_funding=need.other_funding,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="funding_need_item",
        entity_id=item_id,
        action="delete",
        details={"need_id": need_id},
        correlation_id=cid,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/companies/{company_id}/documents", response_model=list[CompanyDocumentOut])
def company_documents(
    company_id: str,
    db: DbDep,
    user: CurrentUser,
    category: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
) -> list[CompanyDocumentOut]:
    require_company_access(db, user, company_id)
    rows = list_documents(db, company_id, category=category, status=status_filter, q=q)
    return [CompanyDocumentOut(**serialize_document(d)) for d in rows]


@router.post(
    "/companies/{company_id}/documents",
    response_model=CompanyDocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_company_document(
    company_id: str,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
    title: str = Form(...),
    category: str = Form(...),
    file: UploadFile | None = File(default=None),
) -> CompanyDocumentOut:
    require_company_access(db, user, company_id, write=True)
    content = await file.read() if file is not None else None
    filename = file.filename if file is not None else None
    content_type = file.content_type if file is not None else None
    doc = create_document(
        db,
        company_id=company_id,
        user=user,
        title=title,
        category=category,
        content=content,
        filename=filename,
        content_type=content_type,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_document",
        entity_id=doc.id,
        action="document_create",
        details={"title": title, "category": category, "status": doc.status},
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    db.refresh(doc)
    return CompanyDocumentOut(**serialize_document(doc))


@router.get("/companies/{company_id}/documents/{doc_id}", response_model=CompanyDocumentOut)
def get_company_document(
    company_id: str, doc_id: str, db: DbDep, user: CurrentUser
) -> CompanyDocumentOut:
    require_company_access(db, user, company_id)
    doc = require_document(db, company_id, doc_id)
    return CompanyDocumentOut(**serialize_document(doc))


@router.get("/companies/{company_id}/documents/{doc_id}/download")
def download_company_document(
    company_id: str, doc_id: str, db: DbDep, user: CurrentUser
) -> Response:
    require_company_access(db, user, company_id)
    doc = require_document(db, company_id, doc_id)
    path = resolve_download_path(doc)  # type: ignore[arg-type]
    if path is None:
        body = (
            f"Demo stub for company document {doc.id}\n"
            f"title={doc.title}\n"
            f"category={doc.category}\n"
        ).encode("utf-8")
        return Response(
            content=body,
            media_type="text/plain; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="stub-{doc_id[:8]}.txt"',
            },
        )
    return FileResponse(
        path,
        filename=doc.file_name or doc.title or path.name,
        media_type=doc.mime_type or "application/octet-stream",
    )


@router.delete("/companies/{company_id}/documents/{doc_id}", response_model=MessageOut)
def delete_company_document(
    company_id: str, doc_id: str, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> MessageOut:
    require_company_access(db, user, company_id, write=True)
    doc = require_document(db, company_id, doc_id)
    delete_document(db, doc)
    write_audit(
        db,
        actor_id=user.id,
        entity_type="company_document",
        entity_id=doc_id,
        action="document_delete",
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    return MessageOut(message="ok")
