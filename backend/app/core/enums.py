from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    ENTREPRENEUR = "entrepreneur"
    ACCOUNTANT = "accountant"
    MANAGER = "manager"
    RISK_ANALYST = "risk_analyst"
    ADMIN = "admin"


class LegalForm(str, enum.Enum):
    IP = "IP"
    OOO = "OOO"


class GoalType(str, enum.Enum):
    INVENTORY_PURCHASE = "inventory_purchase"
    NEW_POINT = "new_point"
    EQUIPMENT = "equipment"
    PRODUCTION_EXPANSION = "production_expansion"
    CASH_GAP = "cash_gap"
    OTHER = "other"


class ProductType(str, enum.Enum):
    WORKING_CAPITAL = "working_capital"
    INVESTMENT = "investment"
    OVERDRAFT = "overdraft"
    CREDIT_LINE = "credit_line"


class ApplicationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    IN_REVIEW = "in_review"
    DOCS_REQUESTED = "docs_requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    ISSUED = "issued"


class ScheduleType(str, enum.Enum):
    ANNUITY = "annuity"
    DIFFERENTIATED = "differentiated"


class TransactionCategory(str, enum.Enum):
    REVENUE = "revenue"
    OPEX = "opex"
    SALARY = "salary"
    TAX = "tax"
    RENT = "rent"
    LOAN_IN = "loan_in"
    LOAN_OUT = "loan_out"
    TRANSFER_INTERNAL = "transfer_internal"
    SUPPLIER = "supplier"
    OTHER = "other"


class MemberRole(str, enum.Enum):
    OWNER = "owner"
    ACCOUNTANT = "accountant"
    VIEWER = "viewer"


class UserStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    DISABLED = "disabled"


class ChallengePurpose(str, enum.Enum):
    REGISTRATION = "registration"
    LOGIN = "login"
    PASSWORD_RESET = "password_reset"
    CONTACT_CHANGE = "contact_change"


class ChallengeChannel(str, enum.Enum):
    SMS = "sms"
    EMAIL = "email"


STATUS_TRANSITIONS: dict[ApplicationStatus, set[ApplicationStatus]] = {
    ApplicationStatus.DRAFT: {ApplicationStatus.SUBMITTED},
    ApplicationStatus.SUBMITTED: {
        ApplicationStatus.IN_REVIEW,
        ApplicationStatus.DOCS_REQUESTED,
        ApplicationStatus.REJECTED,
    },
    ApplicationStatus.IN_REVIEW: {
        ApplicationStatus.DOCS_REQUESTED,
        ApplicationStatus.APPROVED,
        ApplicationStatus.REJECTED,
    },
    ApplicationStatus.DOCS_REQUESTED: {
        ApplicationStatus.IN_REVIEW,
        ApplicationStatus.REJECTED,
    },
    ApplicationStatus.APPROVED: {ApplicationStatus.ISSUED, ApplicationStatus.REJECTED},
    ApplicationStatus.REJECTED: set(),
    ApplicationStatus.ISSUED: set(),
}
