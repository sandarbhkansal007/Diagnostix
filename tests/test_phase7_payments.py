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
from app.models.payment import Payment, PaymentStatus


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


def create_booking(client: TestClient, headers: dict[str, str], price: str = "25.50") -> int:
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

    booking_response = client.post(
        "/api/v1/bookings",
        json={
            "centre_test_id": association_response.json()["id"],
            "appointment_datetime": future_appointment(),
        },
        headers=headers,
    )
    assert booking_response.status_code == 201
    return booking_response.json()["id"]


def pay(client: TestClient, headers: dict[str, str], booking_id: int, outcome: str = "SUCCESS", **extra):
    payload = {"booking_id": booking_id, "simulation_outcome": outcome}
    payload.update(extra)
    return client.post("/api/v1/payments", json=payload, headers=headers)


# Covers an authenticated user's payment request for their own booking.
def test_authenticated_payment_for_own_booking_succeeds(client: TestClient) -> None:
    headers = auth_headers(client, "payment-owner@example.com")
    booking_id = create_booking(client, headers)

    response = pay(client, headers, booking_id)

    assert response.status_code == 200
    assert response.json()["booking_id"] == booking_id
    assert response.json()["status"] == PaymentStatus.SUCCESS.value


# Covers requiring authentication to create a payment.
def test_unauthenticated_payment_returns_401(client: TestClient) -> None:
    response = client.post(
        "/api/v1/payments",
        json={"booking_id": 1, "simulation_outcome": "SUCCESS"},
    )

    assert response.status_code == 401


# Covers returning 404 when the requested booking does not exist.
def test_payment_for_nonexistent_booking_returns_404(client: TestClient) -> None:
    headers = auth_headers(client, "missing-payment-booking@example.com")

    response = pay(client, headers, 999)

    assert response.status_code == 404


# Covers hiding another user's booking from payment requests.
def test_user_cannot_pay_for_another_users_booking(client: TestClient) -> None:
    owner_headers = auth_headers(client, "payment-owner-two@example.com")
    other_headers = auth_headers(client, "payment-other@example.com")
    booking_id = create_booking(client, owner_headers)

    response = pay(client, other_headers, booking_id)

    assert response.status_code == 404


# Covers successful simulated payment, provider ID creation, and confirmation.
def test_successful_payment_confirms_booking_and_stores_provider_id(client: TestClient) -> None:
    headers = auth_headers(client, "success-payment@example.com")
    booking_id = create_booking(client, headers)

    payment_response = pay(client, headers, booking_id, "SUCCESS")
    booking_response = client.get(f"/api/v1/bookings/{booking_id}", headers=headers)

    assert payment_response.status_code == 200
    assert payment_response.json()["provider_payment_id"].startswith("sim_payment_")
    assert booking_response.json()["status"] == BookingStatus.CONFIRMED.value


# Covers failed simulated payment and the resulting booking state.
def test_failed_payment_marks_booking_failed(client: TestClient) -> None:
    headers = auth_headers(client, "failed-payment@example.com")
    booking_id = create_booking(client, headers)

    payment_response = pay(client, headers, booking_id, "FAILED")
    booking_response = client.get(f"/api/v1/bookings/{booking_id}", headers=headers)

    assert payment_response.status_code == 200
    assert payment_response.json()["status"] == PaymentStatus.FAILED.value
    assert booking_response.json()["status"] == BookingStatus.FAILED.value


# Covers using the booking's saved amount instead of current catalogue pricing.
def test_payment_amount_comes_from_booking_snapshot(client: TestClient, test_db) -> None:
    headers = auth_headers(client, "payment-amount@example.com")
    booking_id = create_booking(client, headers, price="500.00")

    with test_db() as db:
        booking = db.get(Booking, booking_id)
        centre_test = db.get(CentreTest, booking.centre_test_id)
        centre_test.price = Decimal("700.00")
        db.commit()

    response = pay(client, headers, booking_id)

    assert response.status_code == 200
    assert Decimal(str(response.json()["amount"])) == Decimal("500.00")


# Covers rejecting client-supplied payment amounts.
def test_client_cannot_override_payment_amount(client: TestClient) -> None:
    headers = auth_headers(client, "payment-override@example.com")
    booking_id = create_booking(client, headers, price="500.00")

    response = pay(client, headers, booking_id, amount="1.00")

    assert response.status_code == 422


# Covers rejecting payment for a cancelled booking.
def test_cancelled_booking_cannot_be_paid(client: TestClient) -> None:
    headers = auth_headers(client, "cancelled-payment@example.com")
    booking_id = create_booking(client, headers)
    cancel_response = client.post(f"/api/v1/bookings/{booking_id}/cancel", headers=headers)

    response = pay(client, headers, booking_id)

    assert cancel_response.status_code == 200
    assert response.status_code == 409


# Covers rejecting payment when the booking is already confirmed.
def test_confirmed_booking_without_payment_cannot_be_paid(test_db, client: TestClient) -> None:
    headers = auth_headers(client, "confirmed-payment@example.com")
    booking_id = create_booking(client, headers)

    with test_db() as db:
        booking = db.get(Booking, booking_id)
        booking.status = BookingStatus.CONFIRMED
        db.commit()

    response = pay(client, headers, booking_id)

    assert response.status_code == 409


# Covers rejecting payment when the booking is already failed.
def test_failed_booking_without_payment_cannot_be_paid(test_db, client: TestClient) -> None:
    headers = auth_headers(client, "failed-state-payment@example.com")
    booking_id = create_booking(client, headers)

    with test_db() as db:
        booking = db.get(Booking, booking_id)
        booking.status = BookingStatus.FAILED
        db.commit()

    response = pay(client, headers, booking_id)

    assert response.status_code == 409


# Covers idempotent repeated payment requests and the one-payment-per-booking rule.
def test_repeated_payment_is_idempotent_and_does_not_duplicate(test_db, client: TestClient) -> None:
    headers = auth_headers(client, "repeat-payment@example.com")
    booking_id = create_booking(client, headers)

    first_response = pay(client, headers, booking_id, "SUCCESS")
    second_response = pay(client, headers, booking_id, "FAILED")

    with test_db() as db:
        payments = db.query(Payment).filter_by(booking_id=booking_id).all()

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert second_response.json() == first_response.json()
    assert len(payments) == 1


# Covers consistent persistence of payment and booking state and amount.
def test_payment_and_booking_are_persisted_consistently(test_db, client: TestClient) -> None:
    headers = auth_headers(client, "consistent-payment@example.com")
    booking_id = create_booking(client, headers)

    response = pay(client, headers, booking_id, "FAILED")

    with test_db() as db:
        payment = db.query(Payment).filter_by(booking_id=booking_id).one()
        booking = db.get(Booking, booking_id)

    assert response.status_code == 200
    assert payment.status is PaymentStatus.FAILED
    assert booking.status is BookingStatus.FAILED
    assert payment.amount == booking.amount
