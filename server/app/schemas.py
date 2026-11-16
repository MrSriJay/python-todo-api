"""Request and response schemas."""

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


class TodoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    color: NoteColor
    done: bool
    created_at: datetime
    updated_at: datetime
