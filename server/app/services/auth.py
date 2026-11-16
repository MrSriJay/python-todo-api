"""Account creation and login."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User, utcnow
from app.schemas import Login, PasscodeReset, Signup
from app.security import create_access_token, hash_passcode, verify_passcode

logger = logging.getLogger("todo_api.auth")


class EmailAlreadyUsedError(Exception):
    def __init__(self) -> None:
        super().__init__("An account with this email already exists")


class InvalidLoginError(Exception):
    def __init__(self) -> None:
        super().__init__("Email or passcode is incorrect")


class InvalidPasscodeError(Exception):
    def __init__(self) -> None:
        super().__init__("Current passcode is incorrect")


class AuthService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def signup(self, data: Signup) -> tuple[User, str]:
        existing = self.session.scalar(select(User).where(User.email == data.email))
        if existing is not None:
            raise EmailAlreadyUsedError
        user = User(
            name=data.name,
            email=data.email,
            passcode_hash=hash_passcode(data.passcode),
            created_at=utcnow(),
        )
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        logger.info("user signed up", extra={"user_id": user.id})
        return user, create_access_token(user.id)

    def login(self, data: Login) -> tuple[User, str]:
        user = self.session.scalar(select(User).where(User.email == data.email))
        if user is None or not verify_passcode(data.passcode, user.passcode_hash):
            raise InvalidLoginError
        logger.info("user logged in", extra={"user_id": user.id})
        return user, create_access_token(user.id)

    def reset_passcode(self, user: User, data: PasscodeReset) -> None:
        if not verify_passcode(data.current_passcode, user.passcode_hash):
            raise InvalidPasscodeError
        user.passcode_hash = hash_passcode(data.new_passcode)
        self.session.commit()
        logger.info("passcode reset", extra={"user_id": user.id})
