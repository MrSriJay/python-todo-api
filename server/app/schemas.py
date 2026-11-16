"""Request and response schemas."""

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

TITLE_MAX_LENGTH = 200
DESCRIPTION_MAX_LENGTH = 2000

SortField = Literal["created_at", "updated_at", "title"]
SortOrder = Literal["asc", "desc"]
NoteColor = Literal["sun", "sky", "blush", "peach", "leaf"]


def _clean_title(value: str | None) -> str:
    if value is None or not value.strip():
        raise ValueError("title must not be empty or whitespace")
    cleaned = value.strip()
    if len(cleaned) > TITLE_MAX_LENGTH:
        raise ValueError(f"title must be at most {TITLE_MAX_LENGTH} characters")
    return cleaned


def _clean_description(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if len(cleaned) > DESCRIPTION_MAX_LENGTH:
        raise ValueError(f"description must be at most {DESCRIPTION_MAX_LENGTH} characters")
    return cleaned


class TodoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(description="Short name of the task.")
    description: str | None = Field(
        default=None,
        description=(
            "Optional note. The UI stores bold, italic, underline, strike, and lists "
            "as a small set of HTML tags: strong, em, u, s, ul, ol, li, br, div."
        ),
    )
    color: NoteColor = Field(default="sun", description="Sticky note color.")

    @model_validator(mode="after")
    def validate_fields(self) -> "TodoCreate":
        self.title = _clean_title(self.title)
        self.description = _clean_description(self.description)
        return self


class TodoUpdate(BaseModel):
    """Partial update. Only fields present in the body are changed."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    description: str | None = None
    color: NoteColor | None = None

    @model_validator(mode="after")
    def validate_fields(self) -> "TodoUpdate":
        if not self.model_fields_set:
            raise ValueError("provide title and/or description to update")
        if "title" in self.model_fields_set:
            self.title = _clean_title(self.title)
        if "description" in self.model_fields_set:
            self.description = _clean_description(self.description)
        return self


class Signup(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    email: str
    passcode: str

    @model_validator(mode="after")
    def validate_fields(self) -> "Signup":
        self.name = _clean_name(self.name)
        self.email = _clean_email(self.email)
        self.passcode = _clean_passcode(self.passcode)
        return self


class Login(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    passcode: str

    @model_validator(mode="after")
    def validate_fields(self) -> "Login":
        self.email = _clean_email(self.email)
        self.passcode = _clean_passcode(self.passcode)
        return self


class PasscodeReset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_passcode: str
    new_passcode: str

    @model_validator(mode="after")
    def validate_fields(self) -> "PasscodeReset":
        self.current_passcode = _clean_passcode(self.current_passcode)
        self.new_passcode = _clean_passcode(self.new_passcode)
        if self.current_passcode == self.new_passcode:
            raise ValueError("new passcode must be different from the current passcode")
        return self


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


def _clean_name(value: str | None) -> str:
    if value is None or not value.strip():
        raise ValueError("name must not be empty or whitespace")
    cleaned = value.strip()
    if len(cleaned) > 80:
        raise ValueError("name must be at most 80 characters")
    return cleaned


def _clean_email(value: str | None) -> str:
    if value is None:
        raise ValueError("email must be a valid email address")
    cleaned = value.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", cleaned):
        raise ValueError("email must be a valid email address")
    return cleaned


def _clean_passcode(value: str | None) -> str:
    if value is None or not re.fullmatch(r"\d{6}", value):
        raise ValueError("passcode must be a 6 digit number")
    return value


class TodoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    color: NoteColor
    done: bool
    created_at: datetime
    updated_at: datetime
