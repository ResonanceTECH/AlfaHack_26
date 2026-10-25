from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.enums import (
    ApplicationStatus,
    DecisionType,
    GoalType,
    LegalForm,
    MemberRole,
    OfferStatus,
    PolicyStatus,
    ProductStatus,
    ProductType,
    StatementStatus,
    TransactionCategory,
    UserRole,
    UserStatus,
    WorkflowStatus,
)
from app.core.rbac import ROLE_PERMISSIONS
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import (  # noqa: F401
    ApplicationCheck,
    ApplicationDocument,
    ApplicationWorkflow,
    Company,
    CompanyDocument,
    CompanyInvite,
    CompanyMember,
    CreditApplication,
    CreditDecision,
    CreditOffer,
    CreditPolicy,
    CreditPolicyVersion,
    CreditProduct,
    CreditProductRule,
    CreditProductVersion,
    DemoScenario,
    DocumentRequest,
    FinancialObligation,
    FinancialSnapshot,
    FinancialStatement,
    FinancialTransaction,
    FundingNeed,
    FundingNeedItem,
    MlModelRegistry,
    ModelActivation,
    ModelEvaluation,
    Notification,
    RegistrySnapshot,
    RolePermission,
    User,
)
from app.services.registry import INN_IP, INN_OOO
from app.services.statements import tx_hash

SEED_VERSION = "2026-10"
DEMO_PASSWORD = "demo1234"

USER_ENT_01 = "user_ent_01"
USER_ENT_02 = "user_ent_02"
USER_ANALYST = "user_analyst_01"
USER_ADMIN = "user_admin_01"
USER_ACC = "user_acc_01"
USER_VIEW = "user_view_01"

COMPANY_IP = "company_001"
COMPANY_OOO = "company_002"

PRODUCTS = [
    {
        "id": "working_capital_01",
        "name": "Оборотный кредит «Сезон»",
        "type": ProductType.WORKING_CAPITAL,
        "description": "Финансирование закупок и покрытия кассовых разрывов под торговый оборот.",
        "amount_min": Decimal("500000"),
        "amount_max": Decimal("15000000"),
        "term_min": 3,
        "term_max": 36,
        "rate_min": Decimal("18.5"),
        "rate_max": Decimal("24"),
        "collateral_required": False,
        "legal_forms": ["IP", "OOO"],
        "min_business_age_months": 12,
        "suitable_goals": ["inventory_purchase", "cash_gap", "other"],
        "documents": ["Паспорт", "Выписка ЕГРИП", "Банковская выписка 6 мес.", "Карточка счёта 51"],
        "fees": [{"name": "Комиссия за выдачу", "type": "percent", "value": 0.5}],
        "schedule_types": ["annuity", "differentiated"],
    },
    {
        "id": "credit_line_01",
        "name": "Возобновляемая кредитная линия",
        "type": ProductType.CREDIT_LINE,
        "description": "Лимит с траншами под закупку товаров — платите проценты только за использованную сумму.",
        "amount_min": Decimal("1000000"),
        "amount_max": Decimal("20000000"),
        "term_min": 6,
        "term_max": 36,
        "rate_min": Decimal("17.9"),
        "rate_max": Decimal("22"),
        "collateral_required": False,
        "legal_forms": ["IP", "OOO"],
        "min_business_age_months": 18,
        "suitable_goals": ["inventory_purchase", "cash_gap", "production_expansion"],
        "documents": [
            "Паспорт",
            "Выписка ЕГРИП/ЕГРЮЛ",
            "Банковская выписка 12 мес.",
            "Договоры с поставщиками",
        ],
        "fees": [{"name": "Комиссия за резервирование", "type": "percent", "value": 0.3}],
        "schedule_types": ["annuity"],
    },
    {
        "id": "investment_01",
        "name": "Инвестиционный кредит «Рост»",
        "type": ProductType.INVESTMENT,
        "description": "Долгосрочное финансирование оборудования, ремонта и открытия точек.",
        "amount_min": Decimal("1000000"),
        "amount_max": Decimal("50000000"),
        "term_min": 12,
        "term_max": 84,
        "rate_min": Decimal("16.5"),
        "rate_max": Decimal("21"),
        "collateral_required": True,
        "legal_forms": ["IP", "OOO"],
        "min_business_age_months": 24,
        "suitable_goals": ["equipment", "new_point", "production_expansion"],
        "documents": [
            "Паспорт",
            "Бизнес-план",
            "Коммерческие предложения",
            "Правоустанавливающие документы на залог",
        ],
        "fees": [{"name": "Комиссия за выдачу", "type": "percent", "value": 1}],
        "schedule_types": ["annuity", "differentiated"],
    },
    {
        "id": "overdraft_01",
        "name": "Овердрафт к расчётному счёту",
        "type": ProductType.OVERDRAFT,
        "description": "Краткосрочное покрытие кассовых разрывов в пределах лимита оборотов.",
        "amount_min": Decimal("100000"),
        "amount_max": Decimal("5000000"),
        "term_min": 1,
        "term_max": 12,
        "rate_min": Decimal("19"),
        "rate_max": Decimal("26"),
        "collateral_required": False,
        "legal_forms": ["IP", "OOO"],
        "min_business_age_months": 6,
        "suitable_goals": ["cash_gap", "inventory_purchase"],
        "documents": ["Паспорт", "Выписка по расчётному счёту 3 мес."],
        "fees": [{"name": "Плата за лимит", "type": "fixed", "value": 5000}],
        "schedule_types": ["annuity"],
    },
]

SCENARIOS = [
    {
        "id": "sc_approved",
        "code": "demo_approved",
        "title": "Положительное решение",
        "description": "Стабильный оборот, заявка APPROVED + активный offer.",
        "persona": "ENTREPRENEUR",
        "seed_payload": {
            "seed_version": SEED_VERSION,
            "company_id": COMPANY_IP,
            "application_id": "app_approved_01",
            "expected_status": ApplicationStatus.APPROVED.value,
            "expected_decision": DecisionType.APPROVED.value,
            "expected_offer_id": "offer_approved_01",
        },
    },
    {
        "id": "sc_counteroffer",
        "code": "demo_counteroffer",
        "title": "Альтернативное предложение",
        "description": "Запрошенная сумма завышена — COUNTEROFFERED с меньшей суммой.",
        "persona": "ENTREPRENEUR",
        "seed_payload": {
            "seed_version": SEED_VERSION,
            "company_id": COMPANY_IP,
            "application_id": "app_counter_01",
            "expected_status": ApplicationStatus.COUNTEROFFERED.value,
            "expected_decision": DecisionType.COUNTEROFFERED.value,
            "expected_offer_id": "offer_counter_01",
        },
    },
    {
        "id": "sc_docs",
        "code": "demo_missing_docs",
        "title": "Недостающий документ",
        "description": "Заявка DOCS_REQUESTED, открытый document_request.",
        "persona": "ANALYST",
        "seed_payload": {
            "seed_version": SEED_VERSION,
            "company_id": COMPANY_IP,
            "application_id": "app_docs_01",
            "expected_status": ApplicationStatus.DOCS_REQUESTED.value,
            "document_request_id": "docreq_01",
        },
    },
    {
        "id": "sc_rejected",
        "code": "demo_rejected",
        "title": "Отказ",
        "description": "Высокая долговая нагрузка / нестабильный CF — REJECTED.",
        "persona": "ENTREPRENEUR",
        "seed_payload": {
            "seed_version": SEED_VERSION,
            "company_id": COMPANY_OOO,
            "application_id": "app_rejected_01",
            "expected_status": ApplicationStatus.REJECTED.value,
            "expected_decision": DecisionType.REJECTED.value,
            "reason_codes": ["HIGH_DEBT_BURDEN", "UNSTABLE_CASHFLOW"],
        },
    },
    {
        "id": "sc_unstable",
        "code": "demo_unstable_cashflow",
        "title": "Нестабильный поток",
        "description": "Компания ООО: рваные поступления, высокий debt load.",
        "persona": "ENTREPRENEUR",
        "seed_payload": {
            "seed_version": SEED_VERSION,
            "company_id": COMPANY_OOO,
            "highlight": "transactions_volatile",
            "expected_readiness_max": 45,
        },
    },
    {
        "id": "sc_combined",
        "code": "demo_combined_funding",
        "title": "Комбинированное финансирование",
        "description": "Funding need с несколькими статьями бюджета (товары + логистика + резерв).",
        "persona": "ENTREPRENEUR",
        "seed_payload": {
            "seed_version": SEED_VERSION,
            "company_id": COMPANY_IP,
            "funding_need_id": "need_001",
            "item_ids": ["need_item_01", "need_item_02", "need_item_03"],
            "expected_products": ["working_capital_01", "credit_line_01"],
        },
    },
]


def _iso(dt: datetime | None = None) -> str:
    return (dt or datetime.now(timezone.utc)).isoformat()


def _seed_users(db, pwd: str, now: datetime) -> None:
    db.add_all(
        [
            User(
                id=USER_ENT_01,
                login="ip@demo.alfa",
                email="ip@demo.alfa",
                password_hash=pwd,
                full_name="Иван Петров",
                role=UserRole.ENTREPRENEUR,
                status=UserStatus.ACTIVE,
                mfa_enabled=False,
                email_verified_at=now,
                last_login_at=now - timedelta(hours=2),
            ),
            User(
                id=USER_ENT_02,
                login="ooo@demo.alfa",
                email="ooo@demo.alfa",
                password_hash=pwd,
                full_name="Мария Козлова",
                role=UserRole.ENTREPRENEUR,
                status=UserStatus.ACTIVE,
                mfa_enabled=False,
                email_verified_at=now,
            ),
            User(
                id=USER_ANALYST,
                login="analyst@demo.alfa",
                email="analyst@demo.alfa",
                password_hash=pwd,
                full_name="Анна Соколова",
                role=UserRole.ANALYST,
                status=UserStatus.ACTIVE,
                mfa_enabled=True,
                email_verified_at=now,
                last_login_at=now - timedelta(hours=1),
            ),
            User(
                id=USER_ADMIN,
                login="admin@demo.alfa",
                email="admin@demo.alfa",
                password_hash=pwd,
                full_name="Елена Васильева",
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
                mfa_enabled=True,
                email_verified_at=now,
                last_login_at=now - timedelta(minutes=40),
            ),
            User(
                id=USER_ACC,
                login="accountant@demo.alfa",
                email="accountant@demo.alfa",
                password_hash=pwd,
                full_name="Ольга Бухгалтерова",
                role=UserRole.ENTREPRENEUR,
                status=UserStatus.ACTIVE,
                mfa_enabled=False,
                email_verified_at=now,
                last_login_at=now - timedelta(days=1),
            ),
            User(
                id=USER_VIEW,
                login="viewer@demo.alfa",
                email="viewer@demo.alfa",
                password_hash=pwd,
                full_name="Павел Наблюдатель",
                role=UserRole.ENTREPRENEUR,
                status=UserStatus.ACTIVE,
                mfa_enabled=False,
                email_verified_at=now,
                last_login_at=now - timedelta(days=4),
            ),
        ]
    )


def _seed_rbac(db) -> None:
    for role, perms in ROLE_PERMISSIONS.items():
        for perm in perms:
            db.add(RolePermission(role=role, permission=perm))


def _seed_catalog(db, now: datetime) -> None:
    for p in PRODUCTS:
        row = dict(p)
        row["code"] = p["id"]
        row["status"] = ProductStatus.PUBLISHED
        row["is_active"] = True
        db.add(CreditProduct(**row))
        db.add(
            CreditProductRule(
                product_id=p["id"],
                rule_type="eligibility",
                parameters={
                    "min_age_months": p["min_business_age_months"],
                    "legal_forms": p["legal_forms"],
                    "goals": p["suitable_goals"],
                },
                version="demo-rules-v1",
            )
        )
        db.add(
            CreditProductVersion(
                id=f"cpv_{p['id']}",
                product_id=p["id"],
                version=1,
                snapshot={k: str(v) if isinstance(v, Decimal) else v for k, v in p.items() if k != "type"}
                | {"type": p["type"].value, "status": ProductStatus.PUBLISHED.value},
                changelog="initial publish",
                created_by=USER_ADMIN,
            )
        )

    policy = CreditPolicy(
        id="policy_default",
        code="SMB_DEFAULT_v1",
        name="Базовая политика МСБ",
        description="Демо-правила: долговая нагрузка, возраст бизнеса, стабильность CF.",
        status=PolicyStatus.PUBLISHED,
        version=1,
        rules={
            "max_debt_burden_ratio": 0.55,
            "min_business_age_months": 12,
            "min_avg_monthly_revenue": "300000.00",
            "require_statement_months": 3,
        },
        created_by=USER_ADMIN,
        published_at=now,
    )
    db.add(policy)
    db.add(
        CreditPolicyVersion(
            id="policy_ver_1",
            policy_id="policy_default",
            version=1,
            rules=policy.rules,
            changelog="initial",
            created_by=USER_ADMIN,
        )
    )

    models = [
        MlModelRegistry(
            id="ml_rank_v1",
            name="credit_product_ranker",
            version="demo-v1",
            task="RANK_PRODUCTS",
            status="ACTIVE",
            endpoint=None,
            metrics={"ndcg": 0.72, "latency_p50_ms": 12, "note": "rule-based fallback"},
            meta={
                "seed_version": SEED_VERSION,
                "input_schema": {"funding_need": "object", "products": "array"},
                "output_schema": {"ranked_product_ids": "array", "scores": "array"},
                "artifact": "builtin:rules/ranker_v1",
                "resources": {"ram_mb": 64, "device": "cpu"},
                "fallback": "RULES_ENGINE",
            },
        ),
        MlModelRegistry(
            id="ml_assistant_v1",
            name="credit_assistant_llm",
            version="v1",
            task="AI_ASSISTANT",
            status="REGISTERED",
            endpoint=None,
            metrics={"latency_p50_ms": 180, "note": "small open-weight stub"},
            meta={
                "seed_version": SEED_VERSION,
                "input_schema": {"messages": "array", "company_context": "object"},
                "output_schema": {"reply": "string", "citations": "array"},
                "artifact": "builtin:llm/assistant_v1",
                "resources": {"ram_mb": 2048, "device": "cpu"},
                "params_billion": 0.5,
                "fallback": "TEMPLATE_REPLIES",
            },
        ),
        MlModelRegistry(
            id="ml_assistant_v2",
            name="credit_assistant_llm",
            version="v2",
            task="AI_ASSISTANT",
            status="REGISTERED",
            endpoint=None,
            metrics={"latency_p50_ms": 220, "note": "improved stub"},
            meta={
                "seed_version": SEED_VERSION,
                "input_schema": {"messages": "array", "company_context": "object"},
                "output_schema": {"reply": "string", "citations": "array", "actions": "array"},
                "artifact": "builtin:llm/assistant_v2",
                "resources": {"ram_mb": 3072, "device": "cpu"},
                "params_billion": 1.0,
                "fallback": "TEMPLATE_REPLIES",
            },
        ),
    ]
    db.add_all(models)
    db.add(
        ModelActivation(
            id="ml_act_rank_v1",
            model_id="ml_rank_v1",
            task="RANK_PRODUCTS",
            is_active=True,
            activated_by=USER_ADMIN,
            activated_at=now,
        )
    )
    db.add(
        ModelEvaluation(
            id="ml_eval_rank_v1",
            model_id="ml_rank_v1",
            dataset="synthetic_smb_v1",
            metrics={"ndcg": 0.72, "hit_rate": 0.81, "baseline_ndcg": 0.55},
            notes="Сравнение с random baseline на seed-датасете",
            created_by=USER_ADMIN,
        )
    )
    db.add(
        ModelEvaluation(
            id="ml_eval_asst_v2",
            model_id="ml_assistant_v2",
            dataset="assistant_smoke_v1",
            metrics={"latency_p50_ms": 220, "toxicity": 0.0, "format_ok": 1.0},
            notes="Smoke на шаблонных вопросах кабинета",
            created_by=USER_ADMIN,
        )
    )


def _seed_company_ip(db, now: datetime) -> None:
    db.add(
        Company(
            id=COMPANY_IP,
            inn=INN_IP,
            name="ИП Петров Иван Сергеевич",
            legal_form=LegalForm.IP,
            ogrn="304770100012345",
            industry="Розничная торговля",
            registration_date=date(2019, 3, 15),
            region="Москва",
            employees_count=8,
            registry_status="ACTIVE",
        )
    )
    db.add(
        CompanyMember(
            company_id=COMPANY_IP,
            user_id=USER_ENT_01,
            role=MemberRole.OWNER,
            permissions={"read": True, "write": True, "submit": True, "manage_team": True},
        )
    )
    db.add(
        CompanyMember(
            company_id=COMPANY_IP,
            user_id=USER_ACC,
            role=MemberRole.MEMBER,
            permissions={"read": True, "write": True, "submit": False},
        )
    )
    db.add(
        CompanyMember(
            company_id=COMPANY_IP,
            user_id=USER_VIEW,
            role=MemberRole.VIEWER,
            permissions={"read": True, "write": False, "submit": False},
        )
    )
    db.add(
        CompanyInvite(
            id="invite_pending_01",
            company_id=COMPANY_IP,
            email="lawyer@demo.alfa",
            role=MemberRole.VIEWER,
            code="demoinvite01",
            invited_by=USER_ENT_01,
            expires_at=now + timedelta(days=7),
            status="PENDING",
            message="Доступ к кабинету для юриста",
        )
    )
    for doc in [
        {
            "id": "cdoc_001",
            "title": "Свидетельство о регистрации ИП",
            "category": "Учредительные",
            "status": "ACCEPTED",
            "file_name": "egrip_petrov.pdf",
            "size_bytes": 310_000,
            "uploaded_at": now - timedelta(days=14),
        },
        {
            "id": "cdoc_002",
            "title": "Бух. отчётность 2025",
            "category": "Финансовые",
            "status": "ACCEPTED_REMARK",
            "file_name": "otchet_2025.xlsx",
            "size_bytes": 860_000,
            "uploaded_at": now - timedelta(days=8),
            "review_comment": "Нет пояснений к прочим расходам",
        },
        {
            "id": "cdoc_003",
            "title": "Выписка по расчётному счёту",
            "category": "Финансовые",
            "status": "PENDING",
            "file_name": "extract_sep2026.pdf",
            "size_bytes": 2_400_000,
            "uploaded_at": now - timedelta(days=5),
        },
        {
            "id": "cdoc_004",
            "title": "Договор аренды склада",
            "category": "Имущество",
            "status": "NEED_UPLOAD",
        },
        {
            "id": "cdoc_005",
            "title": "Паспорт владельца",
            "category": "Владельцы",
            "status": "ACCEPTED",
            "file_name": "passport_scan.pdf",
            "size_bytes": 540_000,
            "uploaded_at": now - timedelta(days=11),
        },
        {
            "id": "cdoc_006",
            "title": "Согласие на обработку ПДн",
            "category": "Согласия",
            "status": "ACCEPTED",
            "file_name": "consent_pd.pdf",
            "size_bytes": 120_000,
            "uploaded_at": now - timedelta(days=11),
        },
        {
            "id": "cdoc_007",
            "title": "Справка об отсутствии задолженности",
            "category": "Финансовые",
            "status": "NEED_UPLOAD",
        },
        {
            "id": "cdoc_008",
            "title": "Выписка из ЕГРИП",
            "category": "Учредительные",
            "status": "ACCEPTED",
            "file_name": "egrip_extract.pdf",
            "size_bytes": 280_000,
            "uploaded_at": now - timedelta(days=14),
        },
    ]:
        uploaded_at = doc.get("uploaded_at")
        db.add(
            CompanyDocument(
                id=doc["id"],
                company_id=COMPANY_IP,
                title=doc["title"],
                category=doc["category"],
                status=doc["status"],
                file_name=doc.get("file_name"),
                file_path="" if doc.get("file_name") else None,
                mime_type="application/pdf" if doc.get("file_name") else None,
                size_bytes=doc.get("size_bytes"),
                uploaded_by=USER_ENT_01 if doc.get("file_name") else None,
                uploaded_at=uploaded_at,
                review_comment=doc.get("review_comment"),
            )
        )
    db.add(
        RegistrySnapshot(
            id="reg_ip_001",
            company_id=COMPANY_IP,
            inn=INN_IP,
            source="SYNTHETIC_REGISTRY",
            found=True,
            registry_status="ACTIVE",
            payload={
                "name": "ИП Петров Иван Сергеевич",
                "legal_form": "IP",
                "ogrnip": "304770100012345",
                "status": "ACTIVE",
                "checked_at": _iso(now),
            },
            checked_at=now,
        )
    )
    db.add(
        FinancialSnapshot(
            id="fs_001",
            company_id=COMPANY_IP,
            period="2026-09",
            avg_monthly_revenue=Decimal("900000"),
            operating_expenses=Decimal("650000"),
            cash_balance=Decimal("420000"),
            liabilities=Decimal("180000"),
            active_credits=Decimal("150000"),
            net_profit=Decimal("250000"),
            source="aggregated",
            confirmed=True,
        )
    )

    for oid, typ, title, amount, due, recurring in [
        ("ob_1", "rent", "Аренда склада", "120000", date(2026, 11, 5), True),
        ("ob_2", "salary", "ФОТ", "280000", date(2026, 11, 10), True),
        ("ob_3", "tax", "УСН аванс", "95000", date(2026, 11, 25), False),
        ("ob_4", "supplier", "Оплата поставщику «ДомТорг»", "450000", date(2026, 10, 28), False),
        ("ob_5", "loan", "Платёж по действующему кредиту", "42000", date(2026, 11, 1), True),
    ]:
        db.add(
            FinancialObligation(
                id=oid,
                company_id=COMPANY_IP,
                type=typ,
                title=title,
                amount=Decimal(amount),
                remaining=Decimal(amount),
                due_date=due,
                recurring=recurring,
                status="planned",
            )
        )

    need = FundingNeed(
        id="need_001",
        company_id=COMPANY_IP,
        goal_type=GoalType.INVENTORY_PURCHASE,
        title="Закупка сезонной партии товаров для дома",
        description="Перед высоким сезоном нужна доп. партия; комбинируем оборотный + линию.",
        costs={"goods": "2500000", "logistics": "80000", "reserve": "150000"},
        reserve=Decimal("150000"),
        own_funds=Decimal("230000"),
        other_funding=Decimal("0"),
        required_amount=Decimal("2500000"),
        target_date=date(2026, 11, 15),
        term_months=12,
        meta={"scenario": "demo_combined_funding"},
    )
    db.add(need)
    db.add_all(
        [
            FundingNeedItem(
                id="need_item_01",
                need_id="need_001",
                name="Товары для дома",
                amount=Decimal("2500000"),
                quantity=1,
                unit="лот",
            ),
            FundingNeedItem(
                id="need_item_02",
                need_id="need_001",
                name="Логистика",
                amount=Decimal("80000"),
                quantity=1,
                unit="услуга",
            ),
            FundingNeedItem(
                id="need_item_03",
                need_id="need_001",
                name="Резерв на кассовый разрыв",
                amount=Decimal("150000"),
                quantity=1,
                unit="резерв",
            ),
        ]
    )

    db.add(
        FinancialStatement(
            id="stmt_ip_001",
            company_id=COMPANY_IP,
            period_from=date(2026, 9, 1),
            period_to=date(2026, 10, 8),
            source_type="SEED",
            file_name="demo_statement_ip.csv",
            status=StatementStatus.CONFIRMED,
            parsed_summary={"tx_count": 12, "seed": True},
            uploaded_at=now,
            processed_at=now,
        )
    )

    sample = [
        (date(2026, 9, 3), "85000", "in", "ООО Ромашка", "Оплата по счёту за товары", TransactionCategory.REVENUE),
        (date(2026, 9, 5), "120000", "out", "Арендодатель", "Аренда склада сентябрь", TransactionCategory.RENT),
        (date(2026, 9, 10), "280000", "out", "ФОТ", "Зарплата сотрудникам", TransactionCategory.SALARY),
        (date(2026, 9, 12), "450000", "in", "ИП Сидоров", "Поступление за реализацию", TransactionCategory.REVENUE),
        (date(2026, 9, 15), "95000", "out", "ФНС", "УСН авансовый платёж", TransactionCategory.TAX),
        (date(2026, 9, 18), "320000", "out", "ДомТорг", "Оплата поставщику по договору", TransactionCategory.SUPPLIER),
        (date(2026, 9, 20), "50000", "out", "Свой счёт", "Перевод между своими счетами", TransactionCategory.TRANSFER_INTERNAL),
        (date(2026, 9, 22), "210000", "in", "ООО Уют", "Оплата счёта-фактуры", TransactionCategory.REVENUE),
        (date(2026, 9, 25), "42000", "out", "Альфа-Банк", "Погашение процентов по кредиту", TransactionCategory.LOAN_OUT),
        (date(2026, 10, 2), "190000", "in", "ООО Ромашка", "Оплата по счёту за товары", TransactionCategory.REVENUE),
        (date(2026, 10, 5), "120000", "out", "Арендодатель", "Аренда склада октябрь", TransactionCategory.RENT),
        (date(2026, 10, 8), "175000", "in", "ИП Козлов", "Поступление за реализацию", TransactionCategory.REVENUE),
    ]
    for i, (d, amt, direction, cp, purpose, cat) in enumerate(sample, start=1):
        amount = Decimal(amt)
        db.add(
            FinancialTransaction(
                id=f"tx_ip_{i:03d}",
                company_id=COMPANY_IP,
                statement_id="stmt_ip_001",
                date=d,
                amount=amount,
                direction=direction,
                counterparty=cp,
                purpose=purpose,
                category=cat,
                source="statement",
                external_hash=tx_hash(COMPANY_IP, d, amount, purpose, cp),
            )
        )


def _seed_company_ooo(db, now: datetime) -> None:
    db.add(
        Company(
            id=COMPANY_OOO,
            inn=INN_OOO,
            name="ООО Секретные Данные",
            legal_form=LegalForm.OOO,
            ogrn="1027700000123",
            industry="Оптовая торговля",
            registration_date=date(2018, 1, 10),
            region="Санкт-Петербург",
            employees_count=25,
            registry_status="ACTIVE",
        )
    )
    db.add(
        CompanyMember(
            company_id=COMPANY_OOO,
            user_id=USER_ENT_02,
            role=MemberRole.OWNER,
            permissions={"read": True, "write": True, "submit": True},
        )
    )
    db.add(
        RegistrySnapshot(
            id="reg_ooo_001",
            company_id=COMPANY_OOO,
            inn=INN_OOO,
            source="SYNTHETIC_REGISTRY",
            found=True,
            registry_status="ACTIVE",
            payload={"name": "ООО Секретные Данные", "legal_form": "OOO", "status": "ACTIVE"},
            checked_at=now,
        )
    )
    db.add(
        FinancialSnapshot(
            id="fs_002",
            company_id=COMPANY_OOO,
            period="2026-09",
            avg_monthly_revenue=Decimal("1200000"),
            operating_expenses=Decimal("1450000"),
            cash_balance=Decimal("80000"),
            liabilities=Decimal("4200000"),
            active_credits=Decimal("3800000"),
            debt_load=Decimal("0.72"),
            source="aggregated",
            confirmed=True,
            metrics={"volatile": True, "scenario": "demo_unstable_cashflow"},
        )
    )

    volatile = [
        (date(2026, 8, 2), "900000", "in", "Клиент А", "Крупный разовый платёж", TransactionCategory.REVENUE),
        (date(2026, 8, 5), "850000", "out", "Поставщик X", "Закупка", TransactionCategory.SUPPLIER),
        (date(2026, 8, 20), "12000", "in", "Клиент B", "Мелкий платёж", TransactionCategory.REVENUE),
        (date(2026, 9, 1), "15000", "in", "Клиент C", "Мелкий платёж", TransactionCategory.REVENUE),
        (date(2026, 9, 10), "700000", "out", "Банк", "Погашение тела кредита", TransactionCategory.LOAN_OUT),
        (date(2026, 9, 15), "1100000", "in", "Клиент D", "Разовый контракт", TransactionCategory.REVENUE),
        (date(2026, 9, 18), "980000", "out", "Поставщик Y", "Срочная закупка", TransactionCategory.SUPPLIER),
        (date(2026, 10, 1), "8000", "in", "Клиент E", "Хвост", TransactionCategory.REVENUE),
    ]
    for i, (d, amt, direction, cp, purpose, cat) in enumerate(volatile, start=1):
        amount = Decimal(amt)
        db.add(
            FinancialTransaction(
                id=f"tx_ooo_{i:03d}",
                company_id=COMPANY_OOO,
                date=d,
                amount=amount,
                direction=direction,
                counterparty=cp,
                purpose=purpose,
                category=cat,
                source="statement",
                external_hash=tx_hash(COMPANY_OOO, d, amount, purpose, cp),
                meta={"volatile": True},
            )
        )


def _seed_applications(db, now: datetime) -> None:
    ts = _iso(now)
    earlier = now - timedelta(days=3)

    db.add(
        CreditApplication(
            id="app_draft_01",
            company_id=COMPANY_IP,
            created_by=USER_ENT_01,
            product_id="working_capital_01",
            product_name="Оборотный кредит «Сезон»",
            product_type=ProductType.WORKING_CAPITAL,
            funding_need_id="need_001",
            goal_type=GoalType.INVENTORY_PURCHASE,
            status=ApplicationStatus.DRAFT,
            amount=Decimal("2500000"),
            term_months=12,
            rate=Decimal("21.25"),
            purpose="Закупка сезонной партии",
            readiness_score=62,
            status_history=[{"status": "DRAFT", "at": ts, "by": "Иван Петров"}],
            ai_summary="Черновик на оборотный кредит 2,5 млн ₽. Демо-данные.",
        )
    )

    # demo_approved
    db.add(
        CreditApplication(
            id="app_approved_01",
            company_id=COMPANY_IP,
            created_by=USER_ENT_01,
            assigned_analyst_id=USER_ANALYST,
            assigned_manager_id=USER_ANALYST,
            product_id="working_capital_01",
            product_name="Оборотный кредит «Сезон»",
            product_type=ProductType.WORKING_CAPITAL,
            funding_need_id="need_001",
            goal_type=GoalType.INVENTORY_PURCHASE,
            status=ApplicationStatus.APPROVED,
            amount=Decimal("2000000"),
            term_months=12,
            rate=Decimal("20.5"),
            purpose="Сезонная закупка — одобренный кейс",
            readiness_score=78,
            submitted_at=earlier,
            decided_at=now,
            status_history=[
                {"status": "DRAFT", "at": _iso(earlier - timedelta(days=2)), "by": "Иван Петров"},
                {"status": "SUBMITTED", "at": _iso(earlier), "by": "Иван Петров"},
                {"status": "IN_REVIEW", "at": _iso(earlier + timedelta(hours=2)), "by": "Анна Соколова"},
                {"status": "APPROVED", "at": ts, "by": "Анна Соколова"},
            ],
            ai_summary="Предварительно одобрено. Не является офертой банка.",
        )
    )
    db.add(
        ApplicationWorkflow(
            id="wf_approved_01",
            application_id="app_approved_01",
            workflow_type="CREDIT_REVIEW",
            status=WorkflowStatus.COMPLETED,
            current_step="DECISION",
            started_at=earlier,
            finished_at=now,
            result={"outcome": "APPROVED"},
        )
    )
    db.flush()  # workflow до checks (FK workflow_id)
    db.add(
        ApplicationCheck(
            id="chk_approved_01",
            application_id="app_approved_01",
            workflow_id="wf_approved_01",
            check_key="DEBT_BURDEN",
            audience="PUBLIC",
            status="PASSED",
            score=80,
            reason_codes=["OK_DEBT_BURDEN"],
            explanation="Долговая нагрузка в пределах политики.",
        )
    )
    db.add(
        CreditDecision(
            id="dec_approved_01",
            application_id="app_approved_01",
            decision_type=DecisionType.APPROVED,
            decided_by=USER_ANALYST,
            score=80,
            reason_codes=["STABLE_CASHFLOW", "OK_DEBT_BURDEN"],
            explanation="Предварительное одобрение на запрошенных условиях.",
            model_version="demo-rules-v1",
            policy_version_id="policy_ver_1",
            payload={"scenario": "demo_approved"},
        )
    )
    db.flush()  # decision до offers
    db.add(
        CreditOffer(
            id="offer_approved_01",
            application_id="app_approved_01",
            decision_id="dec_approved_01",
            product_id="working_capital_01",
            amount=Decimal("2000000"),
            term_months=12,
            rate=Decimal("20.5"),
            monthly_payment=Decimal("186500"),
            status=OfferStatus.ACTIVE,
            conditions={"collateral": False, "schedule": "annuity"},
            expires_at=now + timedelta(days=14),
        )
    )

    # demo_counteroffer
    db.add(
        CreditApplication(
            id="app_counter_01",
            company_id=COMPANY_IP,
            created_by=USER_ENT_01,
            assigned_analyst_id=USER_ANALYST,
            assigned_manager_id=USER_ANALYST,
            product_id="working_capital_01",
            product_name="Оборотный кредит «Сезон»",
            product_type=ProductType.WORKING_CAPITAL,
            status=ApplicationStatus.COUNTEROFFERED,
            amount=Decimal("5000000"),
            term_months=18,
            rate=Decimal("22"),
            purpose="Завышенный запрос — альтернатива",
            readiness_score=55,
            submitted_at=earlier,
            decided_at=now,
            status_history=[
                {"status": "SUBMITTED", "at": _iso(earlier), "by": "Иван Петров"},
                {"status": "COUNTEROFFERED", "at": ts, "by": "Анна Соколова"},
            ],
            ai_summary="Запрошенная сумма выше комфортного лимита — предложена альтернатива.",
        )
    )
    db.add(
        CreditDecision(
            id="dec_counter_01",
            application_id="app_counter_01",
            decision_type=DecisionType.COUNTEROFFERED,
            decided_by=USER_ANALYST,
            score=58,
            reason_codes=["AMOUNT_TOO_HIGH", "MAX_DEBT_BURDEN"],
            explanation="Доступна меньшая сумма на более короткий срок.",
            model_version="demo-rules-v1",
            policy_version_id="policy_ver_1",
            payload={"scenario": "demo_counteroffer"},
        )
    )
    db.flush()
    db.add(
        CreditOffer(
            id="offer_counter_01",
            application_id="app_counter_01",
            decision_id="dec_counter_01",
            product_id="credit_line_01",
            amount=Decimal("2500000"),
            term_months=12,
            rate=Decimal("19.5"),
            monthly_payment=Decimal("232000"),
            status=OfferStatus.ACTIVE,
            conditions={"note": "Альтернатива вместо 5 млн"},
            expires_at=now + timedelta(days=10),
        )
    )

    # demo_missing_docs
    db.add(
        CreditApplication(
            id="app_docs_01",
            company_id=COMPANY_IP,
            created_by=USER_ENT_01,
            assigned_analyst_id=USER_ANALYST,
            assigned_manager_id=USER_ANALYST,
            product_id="investment_01",
            product_name="Инвестиционный кредит «Рост»",
            product_type=ProductType.INVESTMENT,
            status=ApplicationStatus.DOCS_REQUESTED,
            amount=Decimal("8000000"),
            term_months=36,
            rate=Decimal("18"),
            purpose="Оборудование — ждём документы",
            readiness_score=48,
            submitted_at=earlier,
            status_history=[
                {"status": "SUBMITTED", "at": _iso(earlier), "by": "Иван Петров"},
                {"status": "DOCS_REQUESTED", "at": ts, "by": "Анна Соколова"},
            ],
            ai_summary="Нужен бизнес-план и коммерческие предложения.",
        )
    )
    db.add(
        DocumentRequest(
            id="docreq_01",
            application_id="app_docs_01",
            requested_by=USER_ANALYST,
            doc_type="business_plan",
            comment="Приложите бизнес-план на 12 месяцев и КП на оборудование",
            status="OPEN",
            due_at=now + timedelta(days=7),
        )
    )
    db.add(
        ApplicationDocument(
            id="doc_placeholder_01",
            application_id="app_docs_01",
            doc_type="business_plan",
            document_type="business_plan",
            name="Запрошено: business_plan",
            size=0,
            status="requested",
            uploaded_by=USER_ANALYST,
        )
    )

    # demo_rejected (на чужом тенанте)
    db.add(
        CreditApplication(
            id="app_rejected_01",
            company_id=COMPANY_OOO,
            created_by=USER_ENT_02,
            assigned_analyst_id=USER_ANALYST,
            assigned_manager_id=USER_ANALYST,
            product_id="credit_line_01",
            product_name="Возобновляемая кредитная линия",
            product_type=ProductType.CREDIT_LINE,
            status=ApplicationStatus.REJECTED,
            amount=Decimal("10000000"),
            term_months=24,
            rate=Decimal("21"),
            purpose="Расширение склада — отказ",
            readiness_score=28,
            rejection_reason="Высокая долговая нагрузка и нестабильный денежный поток",
            submitted_at=earlier,
            decided_at=now,
            status_history=[
                {"status": "SUBMITTED", "at": _iso(earlier), "by": "Мария Козлова"},
                {"status": "IN_REVIEW", "at": _iso(earlier + timedelta(hours=1)), "by": "Анна Соколова"},
                {"status": "REJECTED", "at": ts, "by": "Анна Соколова"},
            ],
            ai_summary="Отказ по демосценарию unstable/rejected.",
        )
    )
    db.add(
        CreditDecision(
            id="dec_rejected_01",
            application_id="app_rejected_01",
            decision_type=DecisionType.REJECTED,
            decided_by=USER_ANALYST,
            score=25,
            reason_codes=["HIGH_DEBT_BURDEN", "UNSTABLE_CASHFLOW"],
            explanation="Демонстрационный отказ: превышен порог долговой нагрузки.",
            model_version="demo-rules-v1",
            policy_version_id="policy_ver_1",
            payload={"scenario": "demo_rejected"},
        )
    )


def _seed_scenarios_and_notifications(db, now: datetime) -> None:
    for sc in SCENARIOS:
        db.add(
            DemoScenario(
                id=sc["id"],
                code=sc["code"],
                title=sc["title"],
                description=sc["description"],
                persona=sc["persona"],
                seed_payload=sc["seed_payload"],
            )
        )

    ent = db.get(User, USER_ENT_01)
    analyst = db.get(User, USER_ANALYST)
    if ent is None or analyst is None:
        raise RuntimeError(
            f"Seed: users missing before notifications "
            f"(ent={ent is not None}, analyst={analyst is not None}) — нужен flush после _seed_users"
        )

    ent.notifications.append(
        Notification(
            id="ntf_ent_01",
            channel="IN_APP",
            type="APPLICATION_APPROVED",
            title="Заявка предварительно одобрена",
            body="По заявке app_approved_01 доступно предложение offer_approved_01.",
            payload={"application_id": "app_approved_01", "offer_id": "offer_approved_01"},
            is_read=False,
        )
    )
    ent.notifications.append(
        Notification(
            id="ntf_ent_02",
            channel="IN_APP",
            type="DOCS_REQUESTED",
            title="Запрошены документы",
            body="По заявке app_docs_01 нужен бизнес-план.",
            payload={"application_id": "app_docs_01", "document_request_id": "docreq_01"},
            is_read=False,
        )
    )
    analyst.notifications.append(
        Notification(
            id="ntf_analyst_01",
            channel="IN_APP",
            type="QUEUE_HINT",
            title="Очередь аналитика",
            body="В демо есть заявки COUNTEROFFERED / DOCS_REQUESTED / REJECTED.",
            payload={"seed_version": SEED_VERSION},
            is_read=True,
            read_at=now,
        )
    )


def wipe_all_tables(db) -> None:
    from sqlalchemy import text

    table_names = [t.name for t in Base.metadata.sorted_tables]
    if not table_names:
        return
    quoted = ", ".join(f'"{name}"' for name in table_names)
    db.execute(text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))
    db.flush()


def populate(db, *, now: datetime | None = None) -> None:
    pwd = hash_password(DEMO_PASSWORD)
    now = now or datetime.now(timezone.utc)
    _seed_users(db, pwd, now)
    db.flush()
    _seed_rbac(db)
    _seed_catalog(db, now)
    db.flush()
    _seed_company_ip(db, now)
    _seed_company_ooo(db, now)
    db.flush()
    _seed_applications(db, now)
    db.flush()
    _seed_scenarios_and_notifications(db, now)
    from scripts.seed_scoring import seed_scoring
    seed_scoring(db)


def seed(*, force: bool = False) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.get(User, USER_ENT_01)
        if existing and not force:
            from scripts.seed_scoring import seed_scoring
            seed_scoring(db)
            db.commit()
            print(f"Seed уже применён (seed_version={SEED_VERSION}) — пропуск")
            print("  force: python -m scripts.seed --force  или POST /admin/demo/reset")
            return

        if existing and force:
            print(f"Force reseed: wipe + seed_version={SEED_VERSION}")
            wipe_all_tables(db)

        populate(db)
        db.commit()
        print(f"Seed OK  seed_version={SEED_VERSION}")
        print(f"  INN IP  = {INN_IP}")
        print(f"  INN OOO = {INN_OOO}")
        print("  Аккаунты (пароль demo1234):")
        print("    ip@demo.alfa          ENTREPRENEUR  company_001 OWNER")
        print("    accountant@demo.alfa  ENTREPRENEUR  company_001 MEMBER")
        print("    viewer@demo.alfa      ENTREPRENEUR  company_001 VIEWER")
        print("    ooo@demo.alfa         ENTREPRENEUR  company_002 (rejected/unstable)")
        print("    analyst@demo.alfa     ANALYST  mfa")
        print("    admin@demo.alfa       ADMIN  mfa")
        print("  Invite pending: lawyer@demo.alfa code=demoinvite01")
        print("  Сценарии: demo_approved, demo_counteroffer, demo_missing_docs,")
        print("            demo_rejected, demo_unstable_cashflow, demo_combined_funding")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Wipe all tables and reseed")
    args = parser.parse_args()
    seed(force=args.force)
