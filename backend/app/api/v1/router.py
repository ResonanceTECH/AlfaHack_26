from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    analyst,
    applications,
    auth,
    companies,
    credit,
    credit_agent,
    finance,
    notifications,
    team,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(companies.router)
api_router.include_router(team.router)
api_router.include_router(credit.router)
api_router.include_router(applications.router)
api_router.include_router(finance.router)
api_router.include_router(analyst.router)
api_router.include_router(admin.router)
api_router.include_router(notifications.router)
api_router.include_router(credit_agent.router)
