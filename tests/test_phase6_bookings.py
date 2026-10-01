from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.config import settings
from app.db.base import Base
from app.main import app
from app.models.booking import Booking, BookingStatus
from app.models.centre_test import CentreTest


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


def create_booking(client: TestClient, headers: dict[str, str], centre_test_id: int, **extra) -> dict:
    payload = {"centre_test_id": centre_test_id, "appointment_datetime": future_appointment()}
    payload.update(extra)
    response = client.post("/api/v1/bookings", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


# Covers authenticated booking creation and the initial PENDING status.
def test_authenticated_booking_creation_and_pending_status(client: TestClient) -> None:
    headers = auth_headers(client, "booking-owner@example.com")
    centre_test_id = create_centre_test(client, headers)

    booking = create_booking(client, headers, centre_test_id)

    assert booking["centre_test_id"] == centre_test_id
    assert booking["status"] == BookingStatus.PENDING.value


# Covers rejecting booking creation without authentication.
def test_unauthenticated_booking_creation_returns_401(client: TestClient) -> None:
    response = client.post(
        "/api/v1/bookings",
        json={"centre_test_id": 1, "appointment_datetime": future_appointment()},
    )

    assert response.status_code == 401


# Covers rejecting a booking for an unknown centre-test association.
def test_nonexistent_centre_test_returns_404(client: TestClient) -> None:
    headers = auth_headers(client, "missing-association@example.com")

    response = client.post(
        "/api/v1/bookings",
        json={"centre_test_id": 999, "appointment_datetime": future_appointment()},
        headers=headers,
    )

    assert response.status_code == 404


# Covers copying the current centre-test price into the booking.
def test_booking_amount_is_snapshotted_from_centre_test_price(client: TestClient) -> None:
    headers = auth_headers(client, "price-owner@example.com")
    centre_test_id = create_centre_test(client, headers, price="25.50")

    booking = create_booking(client, headers, centre_test_id)

    assert Decimal(str(booking["amount"])) == Decimal("25.50")


# Covers rejecting client-supplied booking amounts.
def test_client_cannot_control_booking_amount(client: TestClient) -> None:
    headers = auth_headers(client, "amount-owner@example.com")
    centre_test_id = create_centre_test(client, headers, price="25.50")

    response = client.post(
        "/api/v1/bookings",
        json={
            "centre_test_id": centre_test_id,
            "appointment_datetime": future_appointment(),
            "amount": "1.00",
        },
        headers=headers,
    )

    assert response.status_code == 422


# Covers listing bookings with user ownership isolation.
def test_user_can_list_only_their_own_bookings(client: TestClient) -> None:
    owner_headers = auth_headers(client, "list-owner@example.com")
    other_headers = auth_headers(client, "list-other@example.com")
    centre_test_id = create_centre_test(client, owner_headers)
    create_booking(client, owner_headers, centre_test_id)

    owner_response = client.get("/api/v1/bookings", headers=owner_headers)
    other_response = client.get("/api/v1/bookings", headers=other_headers)

    assert owner_response.status_code == 200
    assert len(owner_response.json()) == 1
    assert other_response.status_code == 200
    assert other_response.json() == []


# Covers retrieving owned bookings while hiding another user's booking.
def test_user_can_retrieve_own_booking_but_not_another_users(client: TestClient) -> None:
    owner_headers = auth_headers(client, "retrieve-owner@example.com")
    other_headers = auth_headers(client, "retrieve-other@example.com")
    centre_test_id = create_centre_test(client, owner_headers)
    booking = create_booking(client, owner_headers, centre_test_id)

    own_response = client.get(f"/api/v1/bookings/{booking['id']}", headers=owner_headers)
    other_response = client.get(f"/api/v1/bookings/{booking['id']}", headers=other_headers)

    assert own_response.status_code == 200
    assert own_response.json()["id"] == booking["id"]
    assert other_response.status_code == 404


# Covers the allowed PENDING-to-CANCELLED transition.
def test_pending_booking_can_be_cancelled(client: TestClient) -> None:
    headers = auth_headers(client, "cancel-owner@example.com")
    centre_test_id = create_centre_test(client, headers)
    booking = create_booking(client, headers, centre_test_id)

    response = client.post(f"/api/v1/bookings/{booking['id']}/cancel", headers=headers)

    assert response.status_code == 200
    assert response.json()["status"] == BookingStatus.CANCELLED.value


# Covers rejecting cancellation from the FAILED state.
def test_invalid_cancellation_transition_returns_409(test_db, client: TestClient) -> None:
    headers = auth_headers(client, "transition-owner@example.com")
    centre_test_id = create_centre_test(client, headers)
    booking = create_booking(client, headers, centre_test_id)

    with test_db() as db:
        stored_booking = db.get(Booking, booking["id"])
        stored_booking.status = BookingStatus.FAILED
        db.commit()

    response = client.post(f"/api/v1/bookings/{booking['id']}/cancel", headers=headers)

    assert response.status_code == 409


# Covers preventing one user from cancelling another user's booking.
def test_user_cannot_cancel_another_users_booking(client: TestClient) -> None:
    owner_headers = auth_headers(client, "cancel-other-owner@example.com")
    other_headers = auth_headers(client, "cancel-other-user@example.com")
    centre_test_id = create_centre_test(client, owner_headers)
    booking = create_booking(client, owner_headers, centre_test_id)

    response = client.post(f"/api/v1/bookings/{booking['id']}/cancel", headers=other_headers)

    assert response.status_code == 404


# Covers 404 responses for missing bookings on read and cancel requests.
def test_invalid_booking_id_returns_404(client: TestClient) -> None:
    headers = auth_headers(client, "invalid-booking@example.com")

    get_response = client.get("/api/v1/bookings/999", headers=headers)
    cancel_response = client.post("/api/v1/bookings/999/cancel", headers=headers)

    assert get_response.status_code == 404
    assert cancel_response.status_code == 404


# Covers rejecting past and timezone-naive appointment datetimes.
def test_invalid_or_past_appointment_datetime_returns_422(client: TestClient) -> None:
    headers = auth_headers(client, "invalid-date@example.com")
    centre_test_id = create_centre_test(client, headers)

    past_response = client.post(
        "/api/v1/bookings",
        json={
            "centre_test_id": centre_test_id,
            "appointment_datetime": "2020-01-01T10:00:00+00:00",
        },
        headers=headers,
    )
    naive_response = client.post(
        "/api/v1/bookings",
        json={
            "centre_test_id": centre_test_id,
            "appointment_datetime": "2099-01-01T10:00:00",
        },
        headers=headers,
    )

    assert past_response.status_code == 422
    assert naive_response.status_code == 422


# Covers preserving the booking price snapshot after catalogue price changes.
def test_booking_amount_snapshot_does_not_change_when_price_changes(test_db, client: TestClient) -> None:
    headers = auth_headers(client, "snapshot-owner@example.com")
    centre_test_id = create_centre_test(client, headers, price="25.50")
    booking = create_booking(client, headers, centre_test_id)

    with test_db() as db:
        centre_test = db.get(CentreTest, centre_test_id)
        centre_test.price = Decimal("99.99")
        db.commit()

    response = client.get(f"/api/v1/bookings/{booking['id']}", headers=headers)

    assert response.status_code == 200
    assert Decimal(str(response.json()["amount"])) == Decimal("25.50")
