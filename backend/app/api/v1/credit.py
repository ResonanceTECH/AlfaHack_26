from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from app.core.enums import GoalType, ProductStatus, ScheduleType
from app.core.jsonutil import jsonable
from app.deps import CorrelationId, CurrentUser, DbDep
from app.models.company import Company
from app.models.credit import CreditProduct, CreditRecommendation
from app.models.finance import CreditScenario, FinancialSnapshot
from app.models.funding import FundingNeed
from app.models.policy import CreditPolicy
from app.schemas.credit import (
    CATALOG_VERSION,
    POLICY_VERSION_DEFAULT,
    SCORE_MEANING,
    CalculateRequest,
    CreditCalculationRequest,
    CreditCalculationResponse,
    CreditCompareRequest,
    CreditCompareResponse,
    CreditCompareRow,
    CreditMatchItem,
    CreditMatchRequest,
    CreditMatchResponse,
    CreditProductCatalogOut,
    CreditProductListItem,
    CreditProductOut,
    CreditProductRuleOut,
    CreditRecommendationOut,
    CreditScheduleItem,
    PaymentRowOut,
    PaymentScheduleOut,
    ProjectEvaluateOut,
    ProjectEvaluateRequest,
    ReadinessRequest,
    ReadinessResultOut,
    RecommendationsRequest,
    RecommendationsResponse,
    ScenarioRequest,
    ScenarioResultOut,
)
from app.services.access import require_company_access
from app.services.audit import write_audit
from app.services.finance_engine import (
    annuity_payment,
    build_payment_schedule,
    evaluate_project,
    round2,
    run_credit_scenario,
)
from app.services.readiness import compute_readiness
from app.services.recommendations import business_age_months, rank_products

router = APIRouter(tags=["credit"])


def _published_query():
    return (
        select(CreditProduct)
        .where(
            CreditProduct.is_active.is_(True),
            CreditProduct.status == ProductStatus.PUBLISHED,
        )
        .order_by(CreditProduct.type, CreditProduct.name)
    )


def _serialize_product(product: CreditProduct) -> CreditProductOut:
    rules = [
        CreditProductRuleOut(
            id=r.id,
            rule_type=r.rule_type,
            parameters=r.parameters or {},
            version=r.version,
        )
        for r in (product.rules or [])
    ]
    return CreditProductOut(
        id=product.id,
        code=product.code,
        name=product.name,
        type=product.type,
        description=product.description,
        amount_min=product.amount_min,
        amount_max=product.amount_max,
        term_min=product.term_min,
        term_max=product.term_max,
        rate_min=product.rate_min,
        rate_max=product.rate_max,
        collateral_required=product.collateral_required,
        legal_forms=product.legal_forms or [],
        min_business_age_months=product.min_business_age_months,
        suitable_goals=product.suitable_goals or [],
        documents=product.documents or [],
        fees=product.fees or [],
        schedule_types=product.schedule_types or [],
        features=product.features or [],
        eligibility_rules=product.eligibility_rules or {},
        rules=rules,
        status=product.status,
        version=product.version,
        catalog_version=CATALOG_VERSION,
        currency=product.currency or "RUB",
    )


def _get_published_product(db: DbDep, product_id: str) -> CreditProduct:
    product = db.scalar(
        select(CreditProduct)
        .options(joinedload(CreditProduct.rules))
        .where(
            or_(CreditProduct.id == product_id, CreditProduct.code == product_id),
            CreditProduct.is_active.is_(True),
            CreditProduct.status == ProductStatus.PUBLISHED,
        )
    )
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Продукт не найден")
    return product


@router.get("/credit-products", response_model=CreditProductCatalogOut)
def list_credit_products(db: DbDep, user: CurrentUser) -> CreditProductCatalogOut:
    """Опубликованный каталог (спека A3)."""
    _ = user
    rows = list(db.scalars(_published_query()).all())
    return CreditProductCatalogOut(
        catalog_version=CATALOG_VERSION,
        items=[
            CreditProductListItem(
                id=p.id,
                code=p.code,
                name=p.name,
                type=p.type,
                description=p.description,
                amount_min=p.amount_min,
                amount_max=p.amount_max,
                term_min=p.term_min,
                term_max=p.term_max,
                rate_min=p.rate_min,
                rate_max=p.rate_max,
                collateral_required=p.collateral_required,
                legal_forms=p.legal_forms or [],
                suitable_goals=p.suitable_goals or [],
                status=p.status,
                version=p.version,
                currency=p.currency or "RUB",
            )
            for p in rows
        ],
    )


@router.get("/credit-products/{product_id}", response_model=CreditProductOut)
def get_credit_product(product_id: str, db: DbDep, user: CurrentUser) -> CreditProductOut:
    _ = user
    return _serialize_product(_get_published_product(db, product_id))


@router.get("/credit/products", response_model=list[CreditProductListItem], deprecated=True)
def list_products_legacy(db: DbDep, user: CurrentUser) -> list[CreditProductListItem]:
    return list_credit_products(db, user).items


@router.get("/credit/products/{product_id}", response_model=CreditProductOut, deprecated=True)
def get_product_legacy(product_id: str, db: DbDep, user: CurrentUser) -> CreditProductOut:
    return get_credit_product(product_id, db, user)


def _active_policy_version(db: DbDep) -> str:
    policy = db.scalar(
        select(CreditPolicy).where(CreditPolicy.code == "SMB_DEFAULT_v1").limit(1)
    )
    if policy is None:
        return POLICY_VERSION_DEFAULT
    return f"{policy.code}@v{policy.version}"


def _latest_snapshot(db: DbDep, company_id: str) -> FinancialSnapshot | None:
    return db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )


@router.post("/companies/{company_id}/credit-matches", response_model=CreditMatchResponse)
def credit_matches(
    company_id: str,
    body: CreditMatchRequest,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> CreditMatchResponse:
    require_company_access(db, user, company_id)
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")

    financials = _latest_snapshot(db, company_id)
    if financials is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Нет финансовых данных для подбора")

    need: FundingNeed | None = None
    if body.funding_need_id:
        need = db.get(FundingNeed, body.funding_need_id)
        if need is None or need.company_id != company_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Потребность не найдена")
    else:
        need = db.scalar(
            select(FundingNeed)
            .where(FundingNeed.company_id == company_id, FundingNeed.status == "ACTIVE")
            .order_by(FundingNeed.created_at.desc())
        )

    amount = body.requested_amount
    term = body.term_months
    goal_type = body.goal_type
    if need is not None:
        amount = amount if amount is not None else Decimal(str(need.required_amount))
        term = term if term is not None else need.term_months
        goal_type = goal_type or need.goal_type
    if amount is None or term is None or goal_type is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Укажите funding_need_id либо requested_amount + term_months + goal_type",
        )

    products = list(db.scalars(_published_query()).all())
    ranked = rank_products(
        company=company,
        financials=financials,
        goal_type=goal_type,
        amount=amount,
        term_months=term,
        products=products,
    )

    items: list[CreditMatchItem] = []
    for rec in ranked["recommendations"]:
        limitations = list(rec.get("warnings") or [])
        limitations.append("Итоговые условия определяются только после рассмотрения заявки")
        items.append(
            CreditMatchItem(
                product_id=rec["product_id"],
                product_name=rec["product_name"],
                product_type=rec["product_type"],
                eligible_by_basic_rules=bool(rec.get("eligible_by_basic_rules", True)),
                ranking_score=Decimal(str(rec["match_score"])),
                score_meaning=SCORE_MEANING,
                estimated_monthly_payment=rec.get("estimated_monthly_payment"),
                estimated_rate=rec.get("estimated_rate"),
                recommended_amount=rec.get("recommended_amount"),
                recommended_term=rec.get("recommended_term"),
                reasons=list(rec.get("reasons") or []),
                limitations=limitations,
            )
        )
        db.add(
            CreditRecommendation(
                company_id=company.id,
                product_id=rec["product_id"],
                funding_need_id=need.id if need else None,
                score=Decimal(str(rec["match_score"])),
                reasons=rec.get("reasons") or [],
                warnings=rec.get("warnings") or [],
                payload=jsonable(rec),
                model_version=ranked.get("model_version", "demo-rules-v1"),
            )
        )

    write_audit(
        db,
        actor_id=user.id,
        entity_type="credit_matches",
        entity_id=company.id,
        action="generate",
        details={
            "funding_need_id": need.id if need else None,
            "count": len(items),
            "amount": str(amount),
        },
        correlation_id=cid,
    )
    db.commit()

    return CreditMatchResponse(
        company_id=company.id,
        funding_need_id=need.id if need else None,
        catalog_version=CATALOG_VERSION,
        policy_version=_active_policy_version(db),
        requested_amount=amount,
        term_months=term,
        currency=body.currency,
        goal_type=goal_type,
        recommendations=items,
        is_official_offer=False,
        model_version=ranked.get("model_version", "demo-rules-v1"),
    )


@router.post("/credit-products/compare", response_model=CreditCompareResponse)
def compare_credit_products(
    body: CreditCompareRequest, db: DbDep, user: CurrentUser
) -> CreditCompareResponse:
    _ = user
    rows: list[CreditCompareRow] = []
    for pid in body.product_ids:
        product = _get_published_product(db, pid)
        rate = (Decimal(str(product.rate_min)) + Decimal(str(product.rate_max))) / 2
        est_payment = None
        fits = None
        notes: list[str] = []
        if body.amount is not None and body.term_months is not None:
            amount_ok = Decimal(str(product.amount_min)) <= body.amount <= Decimal(str(product.amount_max))
            term_ok = product.term_min <= body.term_months <= product.term_max
            fits = amount_ok and term_ok
            if not amount_ok:
                notes.append("Сумма вне диапазона продукта")
            if not term_ok:
                notes.append("Срок вне диапазона продукта")
            if fits:
                est_payment = annuity_payment(body.amount, rate, body.term_months)
        rows.append(
            CreditCompareRow(
                product_id=product.id,
                product_name=product.name,
                product_type=product.type,
                amount_min=product.amount_min,
                amount_max=product.amount_max,
                term_min=product.term_min,
                term_max=product.term_max,
                rate_min=product.rate_min,
                rate_max=product.rate_max,
                collateral_required=product.collateral_required,
                legal_forms=product.legal_forms or [],
                suitable_goals=product.suitable_goals or [],
                documents=product.documents or [],
                fees=product.fees or [],
                schedule_types=product.schedule_types or [],
                estimated_monthly_payment=est_payment,
                estimated_rate=round2(rate),
                fits_request=fits,
                notes=notes,
            )
        )

    highlights: list[str] = []
    if rows:
        cheapest = min(rows, key=lambda r: Decimal(str(r.rate_min)))
        highlights.append(f"Минимальная ставка у «{cheapest.product_name}»: от {cheapest.rate_min}%")
        no_collateral = [r for r in rows if not r.collateral_required]
        if no_collateral:
            highlights.append(
                "Без обязательного залога: "
                + ", ".join(f"«{r.product_name}»" for r in no_collateral)
            )
        if body.amount is not None:
            fit = [r for r in rows if r.fits_request]
            if fit:
                highlights.append("Подходят под запрос: " + ", ".join(f"«{r.product_name}»" for r in fit))

    return CreditCompareResponse(
        catalog_version=CATALOG_VERSION,
        amount=body.amount,
        term_months=body.term_months,
        products=rows,
        highlights=highlights,
    )


@router.post("/credit-calculations", response_model=CreditCalculationResponse)
def credit_calculations(
    body: CreditCalculationRequest, db: DbDep, user: CurrentUser
) -> CreditCalculationResponse:
    _ = user
    product: CreditProduct | None = None
    rate = body.annual_rate_percent
    rate_source: str = "scenario"
    rate_within: bool | None = None
    fees_pct = Decimal("0")
    fees_fixed = Decimal("0")

    if body.product_id:
        product = _get_published_product(db, body.product_id)
        if rate is None:
            rate = (Decimal(str(product.rate_min)) + Decimal(str(product.rate_max))) / 2
            rate_source = "catalog"
        else:
            lo, hi = Decimal(str(product.rate_min)), Decimal(str(product.rate_max))
            rate_within = lo <= rate <= hi
            rate_source = "catalog" if rate_within else "scenario"
        for fee in product.fees or []:
            if fee.get("type") == "percent":
                fees_pct += Decimal(str(fee["value"]))
            elif fee.get("type") == "fixed":
                fees_fixed += Decimal(str(fee["value"]))
        if body.term_months < product.term_min or body.term_months > product.term_max:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Срок вне каталога продукта ({product.term_min}–{product.term_max} мес.)",
            )
        if body.amount < product.amount_min or body.amount > product.amount_max:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Сумма вне каталога продукта ({product.amount_min}–{product.amount_max})",
            )

    assert rate is not None
    start = body.start_date or date.today()
    raw = build_payment_schedule(
        amount=body.amount,
        term_months=body.term_months,
        annual_rate=rate,
        schedule_type=body.repayment_type,
        start_date=start,
        fees_percent=fees_pct,
        fees_fixed=fees_fixed,
    )
    total_payments = Decimal(str(raw["total_payment"]))
    overpayment = round2(total_payments - Decimal(str(body.amount)))
    schedule = [
        CreditScheduleItem(
            month=row["month"],
            date=row["date"],
            principal=row["principal"],
            interest=row["interest"],
            payment=row["payment"],
            remaining_principal=row["balance"],
            fees=row["fees"],
        )
        for row in raw["rows"]
    ]
    return CreditCalculationResponse(
        product_id=product.id if product else None,
        amount=body.amount,
        term_months=body.term_months,
        annual_rate_percent=round2(rate),
        repayment_type=ScheduleType(body.repayment_type),
        monthly_payment=raw["monthly_payment"],
        total_payments=total_payments,
        overpayment=overpayment,
        total_fees=raw["total_fees"],
        rate_source=rate_source,  # type: ignore[arg-type]
        rate_within_catalog=rate_within,
        schedule=schedule,
        currency=body.currency,
    )


@router.post("/credit/recommendations", response_model=RecommendationsResponse, deprecated=True)
def recommendations(
    body: RecommendationsRequest, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> RecommendationsResponse:
    match = credit_matches(
        company_id=body.company_id,
        body=CreditMatchRequest(
            funding_need_id=body.business_goal_id,
            requested_amount=body.amount,
            term_months=body.term_months,
        ),
        db=db,
        user=user,
        cid=cid,
    )
    return RecommendationsResponse(
        company_id=match.company_id,
        business_goal=match.goal_type or GoalType.OTHER,
        requested_amount=match.requested_amount,
        currency=match.currency,
        recommendations=[
            CreditRecommendationOut(
                product_id=r.product_id,
                product_type=r.product_type,
                product_name=r.product_name,
                match_score=r.ranking_score,
                eligible_by_basic_rules=r.eligible_by_basic_rules,
                estimated_monthly_payment=r.estimated_monthly_payment or Decimal("0"),
                estimated_rate=r.estimated_rate or Decimal("0"),
                recommended_amount=r.recommended_amount or match.requested_amount,
                recommended_term=r.recommended_term or match.term_months,
                reasons=r.reasons,
                warnings=r.limitations,
            )
            for r in match.recommendations
        ],
        is_official_offer=False,
        model_version=match.model_version,
    )


@router.post("/credit/calculate", response_model=PaymentScheduleOut, deprecated=True)
def calculate(body: CalculateRequest, db: DbDep, user: CurrentUser) -> PaymentScheduleOut:
    calc = credit_calculations(
        body=CreditCalculationRequest(
            product_id=body.product_id,
            amount=body.amount,
            currency=body.currency,
            term_months=body.term_months,
            annual_rate_percent=body.annual_rate,
            repayment_type=body.schedule_type.value,
            start_date=body.start_date,
        ),
        db=db,
        user=user,
    )
    interest = round2(Decimal(str(calc.overpayment)) - Decimal(str(calc.total_fees)))
    return PaymentScheduleOut(
        schedule_type=calc.repayment_type,
        amount=calc.amount,
        term_months=calc.term_months,
        annual_rate=calc.annual_rate_percent,
        monthly_payment=calc.monthly_payment,
        total_payment=calc.total_payments,
        total_interest=interest,
        total_fees=calc.total_fees,
        rows=[
            PaymentRowOut(
                month=s.month,
                date=s.date,
                payment=s.payment,
                principal=s.principal,
                interest=s.interest,
                fees=s.fees,
                balance=s.remaining_principal,
            )
            for s in calc.schedule
        ],
        currency=calc.currency,
    )

@router.post("/credit/scenarios", response_model=ScenarioResultOut)
def scenarios(body: ScenarioRequest, db: DbDep, user: CurrentUser) -> dict:
    require_company_access(db, user, body.company_id, write=True)
    params = body.params.model_dump()
    result = run_credit_scenario(body.name, params)
    if body.persist:
        row = CreditScenario(
            id=result["id"],
            company_id=body.company_id,
            name=body.name,
            parameters=jsonable(result["params"]),
            result=jsonable({k: v for k, v in result.items() if k != "params"}),
        )
        db.add(row)
        db.commit()
    return result

@router.get("/credit/scenarios", response_model=list[ScenarioResultOut])
def list_scenarios(company_id: str, db: DbDep, user: CurrentUser) -> list[dict]:
    require_company_access(db, user, company_id)
    rows = db.scalars(
        select(CreditScenario)
        .where(CreditScenario.company_id == company_id)
        .order_by(CreditScenario.created_at.desc())
    ).all()
    out = []
    for r in rows:
        out.append(
            {
                "id": r.id,
                "name": r.name,
                "params": r.parameters,
                **{k: v for k, v in r.result.items() if k not in ("id", "name")},
                "created_at": r.created_at.isoformat() + "Z",
            }
        )
    return out

@router.post("/credit/readiness", response_model=ReadinessResultOut)
def readiness(body: ReadinessRequest, db: DbDep, user: CurrentUser) -> dict:
    require_company_access(db, user, body.company_id)
    company = db.get(Company, body.company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")
    financials = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == body.company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    product = db.get(CreditProduct, body.product_id) if body.product_id else None
    documents = []
    if body.application_id:
        from app.models.application import CreditApplication

        app = db.get(CreditApplication, body.application_id)
        if app is None or app.company_id != body.company_id:
            from fastapi import HTTPException, status as http_status

            raise HTTPException(http_status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
        documents = list(app.documents)
        if product is None:
            product = db.get(CreditProduct, app.product_id)

    return compute_readiness(
        company=company,
        financials=financials,
        product=product,
        documents=documents,
        business_age_months=business_age_months(company.registration_date),
    )

@router.post("/projects/evaluate", response_model=ProjectEvaluateOut)
def evaluate(body: ProjectEvaluateRequest, user: CurrentUser) -> dict:
    return evaluate_project(body.model_dump())
