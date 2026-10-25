"""Unit: workflow transition matrix."""

from __future__ import annotations

import pytest

from app.core.enums import ApplicationStatus
from app.core.errors import AppError
from app.services.workflow import assert_can_transition, can_transition


def test_draft_to_submitted_allowed() -> None:
    assert can_transition(ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED)


def test_approved_to_draft_forbidden() -> None:
    assert not can_transition(ApplicationStatus.APPROVED, ApplicationStatus.DRAFT)
    with pytest.raises(AppError) as ei:
        assert_can_transition(ApplicationStatus.APPROVED, ApplicationStatus.DRAFT)
    assert ei.value.status_code == 409
    assert ei.value.code == "INVALID_TRANSITION"


def test_counteroffered_to_offer_accepted() -> None:
    assert can_transition(ApplicationStatus.COUNTEROFFERED, ApplicationStatus.OFFER_ACCEPTED)
