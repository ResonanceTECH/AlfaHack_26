from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, companies, credit

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(companies.router)
api_router.include_router(credit.router)
