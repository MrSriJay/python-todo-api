"""Passcode hashing, JWT checks, and note encryption."""

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


class TokenError(Exception):
    """The bearer token is missing, expired, or not a token this API issued."""


def hash_passcode(passcode: str) -> str:
    return bcrypt.hashpw(passcode.encode(), bcrypt.gensalt()).decode()


def verify_passcode(passcode: str, passcode_hash: str) -> bool:
    try:
        return bcrypt.checkpw(passcode.encode(), passcode_hash.encode())
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    expires = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "exp": expires}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def read_user_id(token: str) -> int:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as exc:
        raise TokenError from exc


def _fernet() -> Fernet:
    key = get_settings().note_encryption_key.encode()
    return Fernet(key)


def encrypt_text(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_text(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise TokenError from exc
