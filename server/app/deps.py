"""Shared FastAPI dependencies."""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.todos import TodoService


def get_todo_service(db: Session = Depends(get_db)) -> TodoService:
    return TodoService(db)
