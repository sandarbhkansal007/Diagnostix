from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.config import settings
from app.core.security import verify_password
from app.db.base import Base
from app.main import app
from app.models.report import Report, ReportStatus
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


def future_appointment() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()


def auth_headers(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "correct-horse-battery-staple"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_centre_test(client: TestClient, headers: dict[str, str], price: str = "25.50") -> int:
    centre_response = client.post(
        "/api/v1/centres",
        json={"name": "Central Lab", "location": "Downtown"},
        headers=headers,
    )
    test_response = client.post(
        "/api/v1/tests",
        json={"name": "Blood Test", "description": "Routine analysis"},
        headers=headers,
    )
    assert centre_response.status_code == 201
    assert test_response.status_code == 201

    association_response = client.post(
        "/api/v1/centre-tests",
        json={
            "centre_id": centre_response.json()["id"],
            "test_id": test_response.json()["id"],
            "price": price,
        },
        headers=headers,
    )
    assert association_response.status_code == 201
    return association_response.json()["id"]


def create_booking(client: TestClient, headers: dict[str, str], centre_test_id: int) -> int:
    response = client.post(
        "/api/v1/bookings",
        json={"centre_test_id": centre_test_id, "appointment_datetime": future_appointment()},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_profile_update_restricts_to_own_email_and_validates_input(client: TestClient) -> None:
    headers = auth_headers(client, "profile-user@example.com")

    response = client.put(
        "/api/v1/auth/profile",
        json={"email": "updated-profile@example.com"},
        headers=headers,
    )
    invalid_response = client.put(
        "/api/v1/auth/profile",
        json={"email": "not-an-email", "role": "admin"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["email"] == "updated-profile@example.com"
    assert invalid_response.status_code == 422


def test_password_change_requires_current_password_and_invalidates_old_token(client: TestClient) -> None:
    signup_response = client.post(
        "/api/v1/auth/signup",
        json={"email": "password-user@example.com", "password": "correct-horse-battery-staple"},
    )
    headers = {"Authorization": f"Bearer {signup_response.json()['access_token']}"}
    old_token = signup_response.json()["access_token"]

    wrong_password_response = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "wrong-password", "new_password": "new-password-123"},
        headers=headers,
    )
    success_response = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "correct-horse-battery-staple", "new_password": "new-password-123"},
        headers=headers,
    )
    protected_after_change = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {old_token}"})

    assert wrong_password_response.status_code == 401
    assert success_response.status_code == 200
    assert success_response.json()["message"] == "Password updated successfully"
    assert protected_after_change.status_code == 401


def test_logout_revokes_the_current_session(client: TestClient) -> None:
    headers = auth_headers(client, "logout-user@example.com")

    logout_response = client.post("/api/v1/auth/logout", headers=headers)
    protected_after_logout = client.get("/api/v1/auth/me", headers=headers)

    assert logout_response.status_code == 200
    assert logout_response.json()["message"] == "Logged out successfully"
    assert protected_after_logout.status_code == 401


def test_patient_can_list_and_retrieve_own_reports_but_not_another_users(client: TestClient, test_db) -> None:
    owner_headers = auth_headers(client, "report-owner@example.com")
    other_headers = auth_headers(client, "report-other@example.com")
    centre_test_id = create_centre_test(client, owner_headers)
    booking_id = create_booking(client, owner_headers, centre_test_id)

    with test_db() as db:
        user = db.query(User).filter_by(email="report-owner@example.com").one()
        report = Report(
            user_id=user.id,
            booking_id=booking_id,
            status=ReportStatus.READY,
            summary="Vitamin D within range",
            findings="No concerns noted.",
            metadata={"type": "lab-summary"},
        )
        db.add(report)
        db.commit()
        db.refresh(report)

    list_response = client.get("/api/v1/reports", headers=owner_headers)
    own_response = client.get(f"/api/v1/reports/{report.id}", headers=owner_headers)
    other_response = client.get(f"/api/v1/reports/{report.id}", headers=other_headers)

    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert own_response.status_code == 200
    assert own_response.json()["id"] == report.id
    assert other_response.status_code == 404
