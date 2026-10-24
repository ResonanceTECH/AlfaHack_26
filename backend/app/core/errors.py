from __future__ import annotations

from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.common import APIModel


class ErrorField(APIModel):
    field: str
    code: str


class ErrorBody(APIModel):
    code: str
    message: str
    fields: list[ErrorField] | None = None
    request_id: str | None = None


class ErrorResponse(APIModel):
    error: ErrorBody


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        fields: list[dict[str, str]] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.fields = fields
        super().__init__(message)


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None) or request.headers.get("X-Correlation-ID")


def error_payload(
    *,
    code: str,
    message: str,
    request_id: str | None = None,
    fields: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id,
        }
    }
    if fields:
        body["error"]["fields"] = fields
    return body


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(
            code=exc.code,
            message=exc.message,
            request_id=_request_id(request),
            fields=exc.fields,
        ),
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail and "message" in detail:
        code = str(detail["code"])
        message = str(detail["message"])
        fields = detail.get("fields")
    else:
        code = f"HTTP_{exc.status_code}"
        message = detail if isinstance(detail, str) else str(detail)
        fields = None
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(
            code=code,
            message=message,
            request_id=_request_id(request),
            fields=fields,
        ),
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    fields: list[dict[str, str]] = []
    for err in exc.errors():
        loc = err.get("loc") or ()
        field = ".".join(str(p) for p in loc if p != "body")
        fields.append({"field": field or "body", "code": err.get("type", "VALIDATION_ERROR")})
    message = "Ошибка валидации запроса"
    if fields:
        message = f"Ошибка валидации: {fields[0]['field']}"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=error_payload(
            code="VALIDATION_ERROR",
            message=message,
            request_id=_request_id(request),
            fields=fields,
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_payload(
            code="INTERNAL_ERROR",
            message="Внутренняя ошибка сервера",
            request_id=_request_id(request),
        ),
    )
