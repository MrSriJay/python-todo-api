"""TODO persistence."""

import logging
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Todo, utcnow
from app.schemas import SortField, SortOrder, TodoCreate, TodoUpdate

logger = logging.getLogger("todo_api.todos")


class TodoNotFoundError(Exception):
    def __init__(self, todo_id: int) -> None:
        self.todo_id = todo_id
        super().__init__("TODO not found")


class TodoService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_todos(
        self,
        *,
        done: bool | None,
        limit: int | None,
        offset: int,
        sort: SortField,
        order: SortOrder,
    ) -> tuple[list[Todo], int]:
        count_stmt = select(func.count()).select_from(Todo)
        stmt = select(Todo)
        if done is not None:
            count_stmt = count_stmt.where(Todo.done.is_(done))
            stmt = stmt.where(Todo.done.is_(done))

        total = self.session.scalar(count_stmt)
        column = {
            "created_at": Todo.created_at,
            "updated_at": Todo.updated_at,
            "title": Todo.title,
        }[sort]
        primary = column.asc() if order == "asc" else column.desc()
        stmt = stmt.order_by(primary, Todo.id.asc()).offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)
        items: Sequence[Todo] = self.session.scalars(stmt).all()
        return list(items), int(total or 0)

    def get_todo(self, todo_id: int) -> Todo:
        todo = self.session.get(Todo, todo_id)
        if todo is None:
            raise TodoNotFoundError(todo_id)
        return todo

    def create_todo(self, data: TodoCreate) -> Todo:
        now = utcnow()
        todo = Todo(
            title=data.title,
            description=data.description,
            color=data.color,
            done=False,
            created_at=now,
            updated_at=now,
        )
        self.session.add(todo)
        self.session.commit()
        self.session.refresh(todo)
        logger.info("todo created", extra={"todo_id": todo.id})
        return todo

    def update_todo(self, todo_id: int, data: TodoUpdate) -> Todo:
        todo = self.get_todo(todo_id)
        if "title" in data.model_fields_set and data.title is not None:
            todo.title = data.title
        if "description" in data.model_fields_set:
            todo.description = data.description
        if "color" in data.model_fields_set and data.color is not None:
            todo.color = data.color
        todo.updated_at = utcnow()
        self.session.commit()
        self.session.refresh(todo)
        logger.info("todo updated", extra={"todo_id": todo.id})
        return todo

    def toggle_done(self, todo_id: int) -> Todo:
        todo = self.get_todo(todo_id)
        todo.done = not todo.done
        todo.updated_at = utcnow()
        self.session.commit()
        self.session.refresh(todo)
        logger.info("todo toggled", extra={"todo_id": todo.id})
        return todo

    def delete_todo(self, todo_id: int) -> None:
        todo = self.get_todo(todo_id)
        self.session.delete(todo)
        self.session.commit()
        logger.info("todo deleted", extra={"todo_id": todo_id})
