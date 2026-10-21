from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import applications, auth, companies, credit, manager

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(companies.router)
api_router.include_router(credit.router)
api_router.include_router(applications.router)
api_router.include_router(manager.router)
