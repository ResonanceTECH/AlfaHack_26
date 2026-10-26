from __future__ import annotations

from fastapi import APIRouter, Query, status

from app.deps import CorrelationId, CurrentUser, DbDep
from app.schemas.doc_review import (
    DocumentReviewAssignIn,
    DocumentReviewOut,
    DocumentReviewPatch,
)
from app.services.access import require_company_access
from app.services.audit import write_audit
from app.services.doc_reviews import assign_reviews, list_reviews, patch_review, serialize_review

router = APIRouter(tags=["document-reviews"])


@router.get(
    "/companies/{company_id}/document-reviews",
    response_model=list[DocumentReviewOut],
)
def get_document_reviews(
    company_id: str,
    db: DbDep,
    user: CurrentUser,
    mine: bool = Query(default=False),
    application_id: str | None = Query(default=None, alias="applicationId"),
    status_filter: str | None = Query(default=None, alias="status"),
) -> list[DocumentReviewOut]:
    require_company_access(db, user, company_id, write=False)
    rows = list_reviews(
        db,
        company_id=company_id,
        mine_user_id=user.id if mine else None,
        application_id=application_id,
        status=status_filter,
    )
    return [DocumentReviewOut(**r) for r in rows]


@router.post(
    "/companies/{company_id}/document-reviews/assign",
    response_model=list[DocumentReviewOut],
    status_code=status.HTTP_201_CREATED,
)
def post_assign_document_reviews(
    company_id: str,
    body: DocumentReviewAssignIn,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> list[DocumentReviewOut]:
    require_company_access(db, user, company_id, write=True)
    items = [i.model_dump() for i in body.items]
    created = assign_reviews(
        db,
        company_id=company_id,
        actor=user,
        assignee_user_id=body.assignee_user_id,
        application_id=body.application_id,
        purpose=body.purpose,
        items=items,
        due_days=body.due_days,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="document_review",
        entity_id=created[0].id if created else company_id,
        action="doc_review_assign",
        details={
            "count": len(created),
            "assignee_user_id": body.assignee_user_id,
            "application_id": body.application_id,
        },
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    for r in created:
        db.refresh(r)
    return [DocumentReviewOut(**serialize_review(r)) for r in created]


@router.patch(
    "/companies/{company_id}/document-reviews/{review_id}",
    response_model=DocumentReviewOut,
)
def patch_document_review(
    company_id: str,
    review_id: str,
    body: DocumentReviewPatch,
    db: DbDep,
    user: CurrentUser,
    cid: CorrelationId,
) -> DocumentReviewOut:
    require_company_access(db, user, company_id, write=True)
    review = patch_review(
        db,
        company_id=company_id,
        review_id=review_id,
        actor=user,
        status=body.status,
        comment=body.comment,
    )
    write_audit(
        db,
        actor_id=user.id,
        entity_type="document_review",
        entity_id=review.id,
        action="doc_review_patch",
        details={"status": review.status},
        correlation_id=cid,
        company_id=company_id,
    )
    db.commit()
    db.refresh(review)
    return DocumentReviewOut(**serialize_review(review))
