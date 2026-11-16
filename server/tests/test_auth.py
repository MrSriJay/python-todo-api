from app.models import Todo
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_signup_and_me(client: TestClient) -> None:
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "ada@example.com"
    assert me.json()["name"] == "Ada Lovelace"
    assert "passcode" not in me.json()
    assert "passcode_hash" not in me.json()


def test_login_returns_a_jwt(client: TestClient) -> None:
    anonymous = TestClient(client.app)
    logged_in = anonymous.post(
        "/api/auth/login",
        json={"email": "Ada@Example.com", "passcode": "123456"},
    )
    assert logged_in.status_code == 200
    body = logged_in.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == "ada@example.com"

    rejected = anonymous.post(
        "/api/auth/login",
        json={"email": "ada@example.com", "passcode": "000000"},
    )
    assert rejected.status_code == 401
    assert rejected.json() == {"detail": "Email or passcode is incorrect"}


def test_signup_requires_a_six_digit_passcode(client: TestClient) -> None:
    short = client.post(
        "/api/auth/signup",
        json={"name": "Grace", "email": "grace@example.com", "passcode": "12345"},
    )
    assert short.status_code == 422
    assert "6 digit" in short.json()["detail"]

    letters = client.post(
        "/api/auth/signup",
        json={"name": "Grace", "email": "grace@example.com", "passcode": "12ab56"},
    )
    assert letters.status_code == 422


def test_duplicate_email_is_rejected(client: TestClient) -> None:
    again = client.post(
        "/api/auth/signup",
        json={"name": "Ada", "email": "ada@example.com", "passcode": "654321"},
    )
    assert again.status_code == 409
    assert again.json() == {"detail": "An account with this email already exists"}


def test_todos_require_a_jwt(client: TestClient) -> None:
    anonymous = TestClient(client.app)
    missing = anonymous.get("/api/todos")
    assert missing.status_code == 401
    assert missing.json() == {"detail": "Not authenticated"}

    forged = anonymous.get("/api/todos", headers={"Authorization": "Bearer not-a-token"})
    assert forged.status_code == 401
    assert forged.json() == {"detail": "Invalid or expired token"}


def test_notes_are_encrypted_and_private(client: TestClient, db_session: Session) -> None:
    created = client.post(
        "/api/todos",
        json={"title": "Secret title", "description": "Secret note"},
    )
    assert created.status_code == 201
    assert created.json()["title"] == "Secret title"

    stored = db_session.get(Todo, created.json()["id"])
    assert stored is not None
    assert stored.title != "Secret title"
    assert "Secret" not in stored.title
    assert stored.description is not None
    assert "Secret" not in stored.description

    other = client.post(
        "/api/auth/signup",
        json={"name": "Bea", "email": "bea@example.com", "passcode": "654321"},
    )
    other_client = TestClient(client.app)
    other_client.headers["Authorization"] = f"Bearer {other.json()['access_token']}"
    hidden = other_client.get(f"/api/todos/{created.json()['id']}")
    assert hidden.status_code == 404
    assert other_client.get("/api/todos").json() == []


def test_logged_in_user_can_reset_passcode(client: TestClient) -> None:
    anonymous = TestClient(client.app)
    missing = anonymous.post(
        "/api/auth/passcode",
        json={"current_passcode": "123456", "new_passcode": "654321"},
    )
    assert missing.status_code == 401
    assert missing.json() == {"detail": "Not authenticated"}

    wrong = client.post(
        "/api/auth/passcode",
        json={"current_passcode": "000000", "new_passcode": "654321"},
    )
    assert wrong.status_code == 401
    assert wrong.json() == {"detail": "Current passcode is incorrect"}

    same = client.post(
        "/api/auth/passcode",
        json={"current_passcode": "123456", "new_passcode": "123456"},
    )
    assert same.status_code == 422

    reset = client.post(
        "/api/auth/passcode",
        json={"current_passcode": "123456", "new_passcode": "654321"},
    )
    assert reset.status_code == 204

    old = anonymous.post(
        "/api/auth/login",
        json={"email": "ada@example.com", "passcode": "123456"},
    )
    assert old.status_code == 401
    fresh = anonymous.post(
        "/api/auth/login",
        json={"email": "ada@example.com", "passcode": "654321"},
    )
    assert fresh.status_code == 200
