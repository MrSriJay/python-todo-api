"""Shared FastAPI dependencies."""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import TokenError, read_user_id
from app.services.auth import AuthService
from app.services.todos import TodoService

_bearer = HTTPBearer(auto_error=False)


def get_todo_service(db: Session = Depends(get_db)) -> TodoService:
    return TodoService(db)


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = read_user_id(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user
