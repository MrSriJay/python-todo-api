"""Signup and login routes."""

from fastapi import APIRouter, Depends, status

from app.deps import get_auth_service, get_current_user
from app.models import User
from app.schemas import Login, PasscodeReset, Signup, TokenResponse, UserRead
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _token(user: User, access_token: str) -> TokenResponse:
    return TokenResponse(access_token=access_token, user=UserRead.model_validate(user))


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account",
)
def signup(payload: Signup, service: AuthService = Depends(get_auth_service)) -> TokenResponse:
    user, token = service.signup(payload)
    return _token(user, token)


@router.post("/login", response_model=TokenResponse, summary="Log in")
def login(payload: Login, service: AuthService = Depends(get_auth_service)) -> TokenResponse:
    user, token = service.login(payload)
    return _token(user, token)


@router.post("/passcode", status_code=status.HTTP_204_NO_CONTENT, summary="Reset passcode")
def reset_passcode(
    payload: PasscodeReset,
    user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> None:
    service.reset_passcode(user, payload)


@router.get("/me", response_model=UserRead, summary="Current account")
def me(user: User = Depends(get_current_user)) -> User:
    return user
