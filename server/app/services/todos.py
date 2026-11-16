"""TODO persistence."""

import logging
from collections.abc import Sequence
from typing import cast

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Todo, User, utcnow
from app.schemas import NoteColor, SortField, SortOrder, TodoCreate, TodoRead, TodoUpdate
from app.security import decrypt_text, encrypt_text

logger = logging.getLogger("todo_api.todos")


class TodoNotFoundError(Exception):
    def __init__(self, todo_id: int) -> None:
        self.todo_id = todo_id
        super().__init__("TODO not found")


def present_todo(todo: Todo) -> TodoRead:
    description = None if todo.description is None else decrypt_text(todo.description)
    return TodoRead(
        id=todo.id,
        title=decrypt_text(todo.title),
        description=description,
        color=cast(NoteColor, todo.color),
        done=todo.done,
        created_at=todo.created_at,
        updated_at=todo.updated_at,
    )


class TodoService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_todos(
        self,
        user: User,
        *,
        done: bool | None,
        limit: int | None,
        offset: int,
        sort: SortField,
        order: SortOrder,
    ) -> tuple[list[Todo], int]:
        count_stmt = select(func.count()).select_from(Todo).where(Todo.user_id == user.id)
        stmt = select(Todo).where(Todo.user_id == user.id)
        if done is not None:
            count_stmt = count_stmt.where(Todo.done.is_(done))
            stmt = stmt.where(Todo.done.is_(done))

        if sort == "title":
            rows = list(self.session.scalars(stmt).all())
            rows.sort(key=lambda todo: todo.id)
            rows.sort(key=lambda todo: decrypt_text(todo.title).casefold(), reverse=order == "desc")
            total = len(rows)
            page = rows[offset:] if limit is None else rows[offset : offset + limit]
            return page, total

        total = self.session.scalar(count_stmt) or 0
        column = Todo.updated_at if sort == "updated_at" else Todo.created_at
        primary = column.asc() if order == "asc" else column.desc()
        stmt = stmt.order_by(primary, Todo.id.asc()).offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)
        items: Sequence[Todo] = self.session.scalars(stmt).all()
        return list(items), int(total or 0)

    def get_todo(self, user: User, todo_id: int) -> Todo:
        todo = self.session.get(Todo, todo_id)
        if todo is None or todo.user_id != user.id:
            raise TodoNotFoundError(todo_id)
        return todo

    def create_todo(self, user: User, data: TodoCreate) -> Todo:
        now = utcnow()
        todo = Todo(
            user_id=user.id,
            title=encrypt_text(data.title),
            description=None if data.description is None else encrypt_text(data.description),
            color=data.color,
            done=False,
            created_at=now,
            updated_at=now,
        )
        self.session.add(todo)
        self.session.commit()
        self.session.refresh(todo)
        logger.info("todo created", extra={"todo_id": todo.id, "user_id": user.id})
        return todo

    def update_todo(self, user: User, todo_id: int, data: TodoUpdate) -> Todo:
        todo = self.get_todo(user, todo_id)
        if "title" in data.model_fields_set and data.title is not None:
            todo.title = encrypt_text(data.title)
        if "description" in data.model_fields_set:
            todo.description = None if data.description is None else encrypt_text(data.description)
        if "color" in data.model_fields_set and data.color is not None:
            todo.color = data.color
        todo.updated_at = utcnow()
        self.session.commit()
        self.session.refresh(todo)
        logger.info("todo updated", extra={"todo_id": todo.id, "user_id": user.id})
        return todo

    def toggle_done(self, user: User, todo_id: int) -> Todo:
        todo = self.get_todo(user, todo_id)
        todo.done = not todo.done
        todo.updated_at = utcnow()
        self.session.commit()
        self.session.refresh(todo)
        logger.info("todo toggled", extra={"todo_id": todo.id, "user_id": user.id})
        return todo

    def delete_todo(self, user: User, todo_id: int) -> None:
        todo = self.get_todo(user, todo_id)
        self.session.delete(todo)
        self.session.commit()
        logger.info("todo deleted", extra={"todo_id": todo_id, "user_id": user.id})
