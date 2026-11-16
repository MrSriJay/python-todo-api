"""add sticky note color

Revision ID: 0002_add_todo_color
Revises: 0001_create_todos
Create Date: 2026-11-16

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_add_todo_color"
down_revision: str | None = "0001_create_todos"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "todos",
        sa.Column("color", sa.String(length=16), server_default="sun", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("todos", "color")
