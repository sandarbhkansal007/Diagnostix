from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.base import Base
from app.main import app
from app.api.deps import get_db
from app.models.user import User


@pytest.fixture
def test_db(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "test-only-secret")
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield testing_session
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def client(test_db) -> TestClient:
    return TestClient(app)


def signup_payload(email: str = "user@example.com") -> dict[str, str]:
    return {"email": email, "password": "correct-horse-battery-staple"}


# Covers successful signup, token issuance, and safe user response fields.
def test_successful_signup_returns_user_and_token(client: TestClient) -> None:
    response = client.post("/api/v1/auth/signup", json=signup_payload())

    assert response.status_code == 201
    payload = response.json()
    assert payload["user"]["email"] == "user@example.com"
    assert payload["token_type"] == "bearer"
    assert payload["access_token"]
    assert "password_hash" not in payload


# Covers rejecting signup with an email that is already registered.
def test_duplicate_signup_returns_conflict(client: TestClient) -> None:
    client.post("/api/v1/auth/signup", json=signup_payload())

    response = client.post("/api/v1/auth/signup", json=signup_payload())

    assert response.status_code == 409


# Covers storing a verifiable password hash instead of plaintext.
def test_password_is_stored_hashed(test_db, client: TestClient) -> None:
    client.post("/api/v1/auth/signup", json=signup_payload())

    with test_db() as db:
        user = db.query(User).filter_by(email="user@example.com").one()
        assert user.password_hash != "correct-horse-battery-staple"
        assert verify_password("correct-horse-battery-staple", user.password_hash)


# Covers password hash creation and correct/incorrect password verification.
def test_password_hashing_utility_round_trip() -> None:
    password = "correct-horse-battery-staple"
    password_hash = hash_password(password)

    assert password_hash != password
    assert verify_password(password, password_hash)
    assert not verify_password("wrong-password", password_hash)


# Covers successful login and access-token issuance.
def test_successful_login_returns_token(client: TestClient) -> None:
    client.post("/api/v1/auth/signup", json=signup_payload())

    response = client.post("/api/v1/auth/login", json=signup_payload())

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "user@example.com"
    assert response.json()["access_token"]


# Covers uniform unauthorized responses for wrong passwords and unknown users.
def test_invalid_password_and_nonexistent_user_are_unauthorized(client: TestClient) -> None:
    client.post("/api/v1/auth/signup", json=signup_payload())

    invalid_password = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "wrong-password"},
    )
    nonexistent_user = client.post(
        "/api/v1/auth/login",
        json=signup_payload("missing@example.com"),
    )

    assert invalid_password.status_code == 401
    assert nonexistent_user.status_code == 401
    assert invalid_password.json() == nonexistent_user.json()


# Covers validating a JWT and loading its authenticated user.
def test_valid_jwt_returns_correct_authenticated_user(client: TestClient) -> None:
    signup_response = client.post("/api/v1/auth/signup", json=signup_payload())
    token = signup_response.json()["access_token"]

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


# Covers rejecting invalid and expired access tokens.
def test_invalid_and_expired_jwt_are_unauthorized(client: TestClient) -> None:
    invalid_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )
    expired_token = create_access_token("1", expires_delta=timedelta(seconds=-1))
    expired_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert invalid_response.status_code == 401
    assert expired_response.status_code == 401


# Covers rejecting missing or malformed Bearer authorization headers.
def test_missing_and_malformed_authorization_headers_are_unauthorized(client: TestClient) -> None:
    missing_response = client.get("/api/v1/auth/me")
    malformed_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Token not-a-bearer-token"},
    )

    assert missing_response.status_code == 401
    assert malformed_response.status_code == 401


# Covers validation errors for malformed email and short password input.
def test_invalid_signup_payload_returns_unprocessable_entity(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "not-an-email", "password": "short"},
    )

    assert response.status_code == 422
