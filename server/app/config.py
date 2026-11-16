"""Application settings loaded from the environment."""

import logging
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """Use the psycopg v3 driver for PostgreSQL URLs that omit a driver."""
    stripped = url.strip()
    if stripped.startswith("postgres://"):
        return "postgresql+psycopg://" + stripped[len("postgres://") :]
    if stripped.startswith("postgresql://"):
        return "postgresql+psycopg://" + stripped[len("postgresql://") :]
    return stripped


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite:///./todo.db"
    log_level: str = "INFO"
    cors_origins: str = "*"
    jwt_secret: str = "dev-todo-jwt-secret-change-me-now"
    jwt_expire_minutes: int = 60 * 24 * 7
    note_encryption_key: str = "5TNNnzTUoxctj6W88TAld9X-ESJ45b4qDQohSHyFg0c="

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        return normalize_database_url(value)

    @field_validator("log_level")
    @classmethod
    def _normalize_log_level(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in logging.getLevelNamesMapping():
            raise ValueError("log_level must be a Python logging level name such as INFO")
        return normalized

    def allowed_origins(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
