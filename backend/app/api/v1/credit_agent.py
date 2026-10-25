"""Дополнительные ручки агента. Роль и факты определяются только сервером."""
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import Field

from app.deps import CurrentUser, DbDep
from app.core.camel import api_model_config
from app.models.audit import AuditEvent
from app.schemas.common import APIModel
from app.services.agent_service import explain_application, select_product
from app.services.audit import write_audit
from app.services.credit_agent.models import AgentResponse

router = APIRouter(tags=["credit-agent"])


class QuestionIn(APIModel):
    model_config = api_model_config(extra="forbid")
    question: str = Field(default="", max_length=4000)


class SelectionIn(QuestionIn):
    goal: Literal["inventory_purchase", "new_point", "equipment", "production_expansion", "cash_gap", "other"] | None = None
    amount: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    term_months: int | None = Field(default=None, ge=1, le=360)


class AgentOut(AgentResponse):
    response_id: str


class FeedbackIn(APIModel):
    helpful: bool
    comment: str = Field(default="", max_length=1000)


@router.post("/applications/{application_id}/ai/explanation", response_model=AgentOut)
def explanation(application_id: str, body: QuestionIn, db: DbDep, user: CurrentUser):
    response = explain_application(db, user, application_id, question=body.question)
    db.commit()
    return response


@router.post("/applications/{application_id}/ai/chat", response_model=AgentOut)
def question(application_id: str, body: QuestionIn, db: DbDep, user: CurrentUser):
    response = explain_application(db, user, application_id, question=body.question)
    db.commit()
    return response


@router.post("/companies/{company_id}/ai/product-selection", response_model=AgentOut)
def selection(company_id: str, body: SelectionIn, db: DbDep, user: CurrentUser):
    response = select_product(db, user, company_id, question=body.question, goal=body.goal,
                              amount=body.amount, term_months=body.term_months)
    db.commit()
    return response


@router.post("/ai/responses/{response_id}/feedback")
def feedback(response_id: str, body: FeedbackIn, db: DbDep, user: CurrentUser):
    event = db.get(AuditEvent, response_id)
    if event is None or event.action != "credit_agent.response" or event.actor_id != user.id:
        raise HTTPException(404, "Ответ не найден")
    write_audit(db, actor_id=user.id, entity_type="credit_agent", entity_id=response_id,
                company_id=event.company_id, action="credit_agent.feedback",
                details={"helpful": body.helpful, "comment": body.comment})
    db.commit()
    return {"saved": True}
