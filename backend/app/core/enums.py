from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    ENTREPRENEUR = "ENTREPRENEUR"
    ANALYST = "ANALYST"
    ADMIN = "ADMIN"


class Permission(str, enum.Enum):
    USERS_MANAGE = "users.manage"
    CATALOG_MANAGE = "catalog.manage"
    POLICY_EDIT = "policy.edit"
    POLICY_PUBLISH = "policy.publish"
    MODELS_MANAGE = "models.manage"
    DEMO_RESET = "demo.reset"
    ANALYTICS_READ = "analytics.read"
    AUDIT_READ = "audit.read"
    APPLICATIONS_REVIEW = "applications.review"
    APPLICATIONS_DECIDE = "applications.decide"
    COMPANIES_READ_CLIENT = "companies.read_client"


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


class ProductStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class PolicyStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class ApplicationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    VALIDATING = "VALIDATING"
    IN_REVIEW = "IN_REVIEW"
    DOCS_REQUESTED = "DOCS_REQUESTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COUNTEROFFERED = "COUNTEROFFERED"
    OFFER_ACCEPTED = "OFFER_ACCEPTED"
    AGREEMENT_PREPARATION = "AGREEMENT_PREPARATION"
    ISSUED = "ISSUED"


class DecisionType(str, enum.Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COUNTEROFFERED = "COUNTEROFFERED"
    NEED_INFO = "NEED_INFO"


class OfferStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    EXPIRED = "EXPIRED"
    SUPERSEDED = "SUPERSEDED"


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
    OWNER = "OWNER"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"


class UserStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"


class StatementStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CONFIRMED = "CONFIRMED"


class WorkflowStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class CheckAudience(str, enum.Enum):
    PUBLIC = "PUBLIC"
    ANALYST = "ANALYST"
    INTERNAL = "INTERNAL"


STATUS_TRANSITIONS: dict[ApplicationStatus, set[ApplicationStatus]] = {
    ApplicationStatus.DRAFT: {ApplicationStatus.SUBMITTED},
    ApplicationStatus.SUBMITTED: {
        ApplicationStatus.VALIDATING,
        ApplicationStatus.IN_REVIEW,
        ApplicationStatus.DOCS_REQUESTED,
        ApplicationStatus.REJECTED,
    },
    ApplicationStatus.VALIDATING: {
        ApplicationStatus.IN_REVIEW,
        ApplicationStatus.DOCS_REQUESTED,
        ApplicationStatus.APPROVED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.COUNTEROFFERED,
    },
    ApplicationStatus.IN_REVIEW: {
        ApplicationStatus.DOCS_REQUESTED,
        ApplicationStatus.APPROVED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.COUNTEROFFERED,
    },
    ApplicationStatus.DOCS_REQUESTED: {
        ApplicationStatus.IN_REVIEW,
        ApplicationStatus.VALIDATING,
        ApplicationStatus.REJECTED,
    },
    ApplicationStatus.APPROVED: {
        ApplicationStatus.OFFER_ACCEPTED,
        ApplicationStatus.AGREEMENT_PREPARATION,
        ApplicationStatus.ISSUED,
        ApplicationStatus.REJECTED,
    },
    ApplicationStatus.COUNTEROFFERED: {
        ApplicationStatus.OFFER_ACCEPTED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.IN_REVIEW,
    },
    ApplicationStatus.OFFER_ACCEPTED: {ApplicationStatus.AGREEMENT_PREPARATION, ApplicationStatus.ISSUED},
    ApplicationStatus.AGREEMENT_PREPARATION: {ApplicationStatus.ISSUED},
    ApplicationStatus.REJECTED: set(),
    ApplicationStatus.ISSUED: set(),
}
