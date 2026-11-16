"""add users and encrypt note text

Revision ID: 0003_users_and_encryption
Revises: 0002_add_todo_color
Create Date: 2026-11-16

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_users_and_encryption"
down_revision: str | None = "0002_add_todo_color"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("passcode_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.execute("DELETE FROM todos")
    with op.batch_alter_table("todos") as batch:
        batch.alter_column(
            "title",
            existing_type=sa.String(length=200),
            type_=sa.Text(),
            existing_nullable=False,
        )
        batch.add_column(sa.Column("user_id", sa.Integer(), nullable=False))
        batch.create_foreign_key(
            "fk_todos_user_id",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch.create_index("ix_todos_user_id", ["user_id"])


def downgrade() -> None:
    with op.batch_alter_table("todos") as batch:
        batch.drop_index("ix_todos_user_id")
        batch.drop_constraint("fk_todos_user_id", type_="foreignkey")
        batch.drop_column("user_id")
        batch.alter_column(
            "title",
            existing_type=sa.Text(),
            type_=sa.String(length=200),
            existing_nullable=False,
        )
    op.drop_table("users")
