"""FastAPI application."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.exceptions import register_exception_handlers
from app.logging_config import configure_logging
from app.middleware import RequestLoggingMiddleware
from app.routers.todos import router as todos_router

logger = logging.getLogger("todo_api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.logger.info("application started")
    yield
    app.state.logger.info("application stopped")


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(
        title="TODO API",
        version="1.0.0",
        summary="Task management API",
        description=(
            "Create, list, update, complete, and delete TODO items. "
            "Interactive documentation is at /docs."
        ),
        lifespan=lifespan,
    )
    app.state.logger = logger
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Total-Count", "X-Limit", "X-Offset"],
    )
    app.add_middleware(RequestLoggingMiddleware)
    register_exception_handlers(app)
    app.include_router(todos_router, prefix="/api")

    @app.get("/health", tags=["health"], summary="Health check")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
