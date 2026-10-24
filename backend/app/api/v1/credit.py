from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from app.core.enums import ProductStatus
from app.core.jsonutil import jsonable
from app.deps import CorrelationId, CurrentUser, DbDep
from app.models.company import Company
from app.models.credit import CreditProduct, CreditRecommendation
from app.models.finance import CreditScenario, FinancialSnapshot
from app.models.funding import BusinessGoal
from app.schemas.credit import (
    CATALOG_VERSION,
    CalculateRequest,
    CreditProductCatalogOut,
    CreditProductListItem,
    CreditProductOut,
    CreditProductRuleOut,
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
from app.services.finance_engine import build_payment_schedule, evaluate_project, run_credit_scenario
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

@router.post("/credit/recommendations", response_model=RecommendationsResponse)
def recommendations(
    body: RecommendationsRequest, db: DbDep, user: CurrentUser, cid: CorrelationId
) -> dict:
    require_company_access(db, user, body.company_id)
    company = db.get(Company, body.company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Компания не найдена")

    financials = db.scalar(
        select(FinancialSnapshot)
        .where(FinancialSnapshot.company_id == body.company_id)
        .order_by(FinancialSnapshot.updated_at.desc())
    )
    if financials is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Нет финансовых данных для подбора")

    goal = None
    if body.business_goal_id:
        goal = db.get(BusinessGoal, body.business_goal_id)
    else:
        goal = db.scalar(
            select(BusinessGoal)
            .where(BusinessGoal.company_id == body.company_id)
            .order_by(BusinessGoal.created_at.desc())
        )
    if goal is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Сначала создайте бизнес-цель")

    amount = body.amount if body.amount is not None else Decimal(str(goal.required_amount))
    term = body.term_months if body.term_months is not None else goal.term_months
    products = list(db.scalars(_published_query()).all())

    result = rank_products(
        company=company,
        financials=financials,
        goal_type=goal.goal_type,
        amount=amount,
        term_months=term,
        products=products,
    )

    for rec in result["recommendations"]:
        db.add(
            CreditRecommendation(
                company_id=company.id,
                product_id=rec["product_id"],
                business_goal_id=goal.id,
                score=rec["match_score"],
                reasons=rec["reasons"],
                warnings=rec["warnings"],
                payload=jsonable(rec),
                model_version=result["model_version"],
            )
        )

    write_audit(
        db,
        actor_id=user.id,
        entity_type="recommendations",
        entity_id=company.id,
        action="generate",
        details={"count": len(result["recommendations"]), "amount": str(amount)},
        correlation_id=cid,
    )
    db.commit()
    return result

@router.post("/credit/calculate", response_model=PaymentScheduleOut)
def calculate(body: CalculateRequest, db: DbDep, user: CurrentUser) -> dict:
    fees_pct = body.fees_percent
    fees_fixed = body.fees_fixed
    if body.product_id:
        product = db.get(CreditProduct, body.product_id)
        if product:
            for fee in product.fees or []:
                if fee.get("type") == "percent":
                    fees_pct += Decimal(str(fee["value"]))
                elif fee.get("type") == "fixed":
                    fees_fixed += Decimal(str(fee["value"]))

    start = body.start_date or date.today()
    return build_payment_schedule(
        amount=body.amount,
        term_months=body.term_months,
        annual_rate=body.annual_rate,
        schedule_type=body.schedule_type.value,
        start_date=start,
        fees_percent=fees_pct,
        fees_fixed=fees_fixed,
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
