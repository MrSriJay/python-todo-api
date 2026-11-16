"""HTTP error mapping."""

from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.services.todos import TodoNotFoundError


def format_validation_error(exc: RequestValidationError) -> str:
    messages: list[str] = []
    for error in exc.errors():
        message = _format_error(error)
        if message not in messages:
            messages.append(message)
    return "; ".join(messages) if messages else "Request validation failed"


def _format_error(error: dict[str, Any]) -> str:
    location = error.get("loc", ())
    parts = [str(part) for part in location if part not in {"body", "query", "path"}]
    field = ".".join(parts)
    message = str(error.get("msg", "invalid value"))
    prefix = "Value error, "
    if message.startswith(prefix):
        message = message[len(prefix) :]
    if error.get("type") == "json_invalid":
        ctx = error.get("ctx") or {}
        parser_error = ctx.get("error")
        if parser_error:
            return f"Request body is not valid JSON: {parser_error}"
        return "Request body is not valid JSON"
    if error.get("type") == "missing" and field:
        return f"{field} is required"
    if not field:
        return message
    if message.lower().startswith(field.lower()):
        return message
    return f"{field}: {message}"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(TodoNotFoundError)
    async def todo_not_found_handler(
        request: Request,
        exc: TodoNotFoundError,
    ) -> JSONResponse:
        del request, exc
        return JSONResponse(status_code=404, content={"detail": "TODO not found"})

    @app.exception_handler(RequestValidationError)
    async def validation_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        del request
        return JSONResponse(
            status_code=422,
            content={"detail": format_validation_error(exc)},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        del request
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": detail},
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        request.app.state.logger.exception(
            "unhandled error",
            exc_info=exc,
            extra={"http_method": request.method, "path": request.url.path},
        )
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
