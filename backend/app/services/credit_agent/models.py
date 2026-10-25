"""Контракт агента: модель ссылается только на факты подготовленного контекста."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PROMPT_VERSION = "credit-explanations-v1"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)


class CitedText(StrictModel):
    source_id: str = Field(min_length=1, max_length=150)
    text: str = Field(min_length=1, max_length=500)


class GeneratedAnswer(StrictModel):
    summary: str = Field(min_length=1, max_length=600)
    main_reasons: list[CitedText] = Field(max_length=8)
    what_to_change: list[CitedText] = Field(max_length=4)
    next_steps: list[str] = Field(max_length=5)
    product_ids: list[str] = Field(max_length=3)


class Fact(StrictModel):
    id: str
    text: str
    kind: Literal["factor", "rule", "offer", "status", "simulation", "product"]
    scope: Literal["request", "offer", "catalog"] = "request"
    factor_id: str | None = None
    rule_id: str | None = None
    product_id: str | None = None


class GroundedReason(CitedText):
    scope: str
    factor_id: str | None = None
    rule_id: str | None = None
    product_id: str | None = None


class AgentResponse(StrictModel):
    summary: str
    main_reasons: list[GroundedReason]
    what_to_change: list[GroundedReason]
    next_steps: list[str]
    product_ids: list[str]
    prefill: dict = Field(default_factory=dict)
    mode: Literal["llm", "template"]
    prompt_version: str = PROMPT_VERSION
    model: str | None = None
    validation_errors: list[str] = Field(default_factory=list)
    score_complete: bool | None = None
    disclaimer: str = "Предварительная оценка на синтетических данных; не гарантия выдачи кредита."

    def as_text(self):
        paragraphs = [self.summary]
        paragraphs.extend(r.text for r in self.main_reasons)
        paragraphs.extend(r.text for r in self.what_to_change)
        paragraphs.extend(self.next_steps)
        return "\n\n".join(paragraphs + [self.disclaimer])
