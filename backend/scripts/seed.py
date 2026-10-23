from __future__ import annotations

import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.enums import (
    ApplicationStatus,
    GoalType,
    LegalForm,
    MemberRole,
    ProductType,
    TransactionCategory,
    UserRole,
    UserStatus,
)
from app.core.rbac import ROLE_PERMISSIONS
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import (  # noqa: F401
    ApplicationComment,
    ApplicationDocument,
    BusinessGoal,
    Company,
    CompanyMember,
    CreditApplication,
    CreditProduct,
    CreditProductRule,
    FinancialObligation,
    FinancialSnapshot,
    FinancialTransaction,
    RolePermission,
    User,
)

DEMO_PASSWORD = "demo1234"
COMPANY_ID = "company_001"
COMPANY_ID_B = "company_002"

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

def _ensure_isolation_tenant(db, pwd: str) -> None:
    if db.get(User, "user_ent_02"):
        return
    db.add(
        User(
            id="user_ent_02",
            email="ooo@demo.alfa",
            password_hash=pwd,
            full_name="Мария Козлова",
            role=UserRole.ENTREPRENEUR,
            status=UserStatus.ACTIVE,
            email_verified_at=datetime.now(timezone.utc),
        )
    )
    if not db.get(Company, COMPANY_ID_B):
        db.add(
            Company(
                id=COMPANY_ID_B,
                inn="770987654321",
                name="ООО Секретные Данные",
                legal_form=LegalForm.OOO,
                ogrn="1027700000123",
                industry="Оптовая торговля",
                registration_date=date(2018, 1, 10),
                region="Санкт-Петербург",
                employees_count=25,
            )
        )
        db.add(
            FinancialSnapshot(
                id="fs_002",
                company_id=COMPANY_ID_B,
                period="2026-09",
                avg_monthly_revenue=Decimal("5000000"),
                operating_expenses=Decimal("3200000"),
                cash_balance=Decimal("1800000"),
                liabilities=Decimal("900000"),
                active_credits=Decimal("700000"),
                source="manual",
                confirmed=True,
            )
        )
    db.add(
        CompanyMember(
            company_id=COMPANY_ID_B,
            user_id="user_ent_02",
            role=MemberRole.OWNER,
            permissions={"read": True, "write": True, "submit": True},
        )
    )

def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        pwd = hash_password(DEMO_PASSWORD)
        if db.get(User, "user_ent_01"):
            _ensure_isolation_tenant(db, pwd)
            db.commit()
            print("Seed уже применён — isolation-тенант проверен")
            return

        now = datetime.now(timezone.utc)
        users = [
            User(
                id="user_ent_01",
                email="ip@demo.alfa",
                password_hash=pwd,
                full_name="Иван Петров",
                role=UserRole.ENTREPRENEUR,
                status=UserStatus.ACTIVE,
                email_verified_at=now,
            ),
            User(
                id="user_analyst_01",
                email="analyst@demo.alfa",
                password_hash=pwd,
                full_name="Анна Соколова",
                role=UserRole.ANALYST,
                status=UserStatus.ACTIVE,
                email_verified_at=now,
            ),
            User(
                id="user_admin_01",
                email="admin@demo.alfa",
                password_hash=pwd,
                full_name="Елена Васильева",
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
                email_verified_at=now,
            ),
        ]
        db.add_all(users)

        for role, perms in ROLE_PERMISSIONS.items():
            for perm in perms:
                db.add(RolePermission(role=role, permission=perm))

        company = Company(
            id=COMPANY_ID,
            inn="770123456789",
            name="ИП Петров Иван Сергеевич",
            legal_form=LegalForm.IP,
            ogrn="304770100012345",
            industry="Розничная торговля",
            registration_date=date(2019, 3, 15),
            region="Москва",
            employees_count=8,
        )
        db.add(company)
        db.add_all(
            [
                CompanyMember(
                    company_id=COMPANY_ID,
                    user_id="user_ent_01",
                    role=MemberRole.OWNER,
                    permissions={"read": True, "write": True, "submit": True},
                ),
            ]
        )

        db.add(
            FinancialSnapshot(
                id="fs_001",
                company_id=COMPANY_ID,
                period="2026-09",
                avg_monthly_revenue=Decimal("900000"),
                operating_expenses=Decimal("650000"),
                cash_balance=Decimal("420000"),
                liabilities=Decimal("180000"),
                active_credits=Decimal("150000"),
                source="aggregated",
                confirmed=True,
            )
        )

        obligations = [
            ("ob_1", "rent", "Аренда склада", "120000", date(2026, 11, 5), True),
            ("ob_2", "salary", "ФОТ", "280000", date(2026, 11, 10), True),
            ("ob_3", "tax", "УСН аванс", "95000", date(2026, 11, 25), False),
            ("ob_4", "supplier", "Оплата поставщику «ДомТорг»", "450000", date(2026, 10, 28), False),
            ("ob_5", "loan", "Платёж по действующему кредиту", "42000", date(2026, 11, 1), True),
        ]
        for oid, typ, title, amount, due, recurring in obligations:
            db.add(
                FinancialObligation(
                    id=oid,
                    company_id=COMPANY_ID,
                    type=typ,
                    title=title,
                    amount=Decimal(amount),
                    due_date=due,
                    recurring=recurring,
                    status="planned",
                )
            )

        for p in PRODUCTS:
            db.add(CreditProduct(**p))
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
            BusinessGoal(
                id="goal_001",
                company_id=COMPANY_ID,
                goal_type=GoalType.INVENTORY_PURCHASE,
                title="Закупка сезонной партии товаров для дома",
                description="Перед высоким сезоном нужна доп. партия на 2,5 млн",
                costs={"goods": "2500000", "logistics": "80000"},
                reserve=Decimal("150000"),
                own_funds=Decimal("230000"),
                other_funding=Decimal("0"),
                required_amount=Decimal("2500000"),
                target_date=date(2026, 11, 15),
                term_months=12,
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
        from app.services.statements import tx_hash

        for i, (d, amt, direction, cp, purpose, cat) in enumerate(sample, start=1):
            amount = Decimal(amt)
            h = tx_hash(COMPANY_ID, d, amount, purpose, cp)
            db.add(
                FinancialTransaction(
                    id=f"tx_{i:03d}",
                    company_id=COMPANY_ID,
                    date=d,
                    amount=amount,
                    direction=direction,
                    counterparty=cp,
                    purpose=purpose,
                    category=cat,
                    source="statement",
                    external_hash=h,
                )
            )

        now = datetime.now(timezone.utc).isoformat()
        app = CreditApplication(
            id="app_draft_01",
            company_id=COMPANY_ID,
            product_id="working_capital_01",
            product_name="Оборотный кредит «Сезон»",
            status=ApplicationStatus.DRAFT,
            amount=Decimal("2500000"),
            term_months=12,
            rate=Decimal("21.25"),
            purpose="Закупка сезонной партии",
            readiness_score=62,
            status_history=[{"status": "draft", "at": now, "by": "Иван Петров"}],
            ai_summary="Черновик на оборотный кредит 2,5 млн ₽. Демо-данные.",
        )
        db.add(app)

        _ensure_isolation_tenant(db, pwd)

        db.commit()
        print("Seed OK")
        print("  ip@demo.alfa / demo1234  (ENTREPRENEUR)")
        print("  ooo@demo.alfa / demo1234  (ENTREPRENEUR, чужой тенант)")
        print("  analyst@demo.alfa / demo1234  (ANALYST)")
        print("  admin@demo.alfa / demo1234  (ADMIN)")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
