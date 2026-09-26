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
from app.models.payment import Payment, PaymentStatus
from app.models.webhook_event import WebhookEvent, WebhookEventStatus


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


def create_booking(client: TestClient, headers: dict[str, str]) -> int:
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
            "price": "500.00",
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


def create_pending_payment(test_db, client: TestClient, email: str = "webhook@example.com") -> tuple[int, str]:
    headers = auth_headers(client, email)
    booking_id = create_booking(client, headers)
    provider_payment_id = f"provider_{booking_id}"
    with test_db() as db:
        booking = db.get(Booking, booking_id)
        db.add(
            Payment(
                booking_id=booking_id,
                amount=booking.amount,
                status=PaymentStatus.PENDING,
                provider_payment_id=provider_payment_id,
            )
        )
        db.commit()
    return booking_id, provider_payment_id


def webhook_payload(
    booking_id: int,
    provider_payment_id: str,
    event_id: str = "evt_123",
    outcome: str = "SUCCESS",
    amount: str | None = "500.00",
) -> dict:
    payload = {
        "provider_event_id": event_id,
        "event_type": "payment.succeeded" if outcome == "SUCCESS" else "payment.failed",
        "provider_payment_id": provider_payment_id,
        "booking_id": booking_id,
        "payment_outcome": outcome,
    }
    if amount is not None:
        payload["amount"] = amount
    return payload


def test_success_webhook_updates_payment_and_booking(client: TestClient, test_db) -> None:
    booking_id, provider_payment_id = create_pending_payment(test_db, client)

    response = client.post(
        "/api/v1/payments/webhook",
        json=webhook_payload(booking_id, provider_payment_id),
    )

    assert response.status_code == 200
    assert response.json()["event_status"] == WebhookEventStatus.PROCESSED.value
    assert response.json()["payment_status"] == PaymentStatus.SUCCESS.value
    assert response.json()["booking_status"] == BookingStatus.CONFIRMED.value


def test_failure_webhook_updates_payment_and_booking(client: TestClient, test_db) -> None:
    booking_id, provider_payment_id = create_pending_payment(test_db, client, "failure@example.com")

    response = client.post(
        "/api/v1/payments/webhook",
        json=webhook_payload(booking_id, provider_payment_id, "evt_failure", "FAILED"),
    )

    assert response.status_code == 200
    assert response.json()["payment_status"] == PaymentStatus.FAILED.value
    assert response.json()["booking_status"] == BookingStatus.FAILED.value


def test_webhook_does_not_require_user_authentication(client: TestClient, test_db) -> None:
    booking_id, provider_payment_id = create_pending_payment(test_db, client, "no-auth@example.com")

    response = client.post(
        "/api/v1/payments/webhook",
        json=webhook_payload(booking_id, provider_payment_id),
    )

    assert response.status_code == 200


def test_nonexistent_payment_returns_404_and_records_no_event(client: TestClient, test_db) -> None:
    response = client.post(
        "/api/v1/payments/webhook",
        json=webhook_payload(999, "missing-payment"),
    )

    with test_db() as db:
        event_count = db.query(WebhookEvent).count()

    assert response.status_code == 404
    assert event_count == 0


def test_booking_payment_relationship_mismatch_returns_404(client: TestClient, test_db) -> None:
    booking_id, provider_payment_id = create_pending_payment(test_db, client, "relationship@example.com")

    response = client.post(
        "/api/v1/payments/webhook",
        json=webhook_payload(booking_id + 999, provider_payment_id),
    )

    assert response.status_code == 404


def test_invalid_event_type_and_payload_return_422(client: TestClient, test_db) -> None:
    booking_id, provider_payment_id = create_pending_payment(test_db, client, "validation@example.com")
    invalid_event = webhook_payload(booking_id, provider_payment_id)
    invalid_event["event_type"] = "payment.refunded"
    invalid_payload = {"provider_event_id": "evt_invalid"}

    invalid_event_response = client.post("/api/v1/payments/webhook", json=invalid_event)
    invalid_payload_response = client.post("/api/v1/payments/webhook", json=invalid_payload)

    assert invalid_event_response.status_code == 422
    assert invalid_payload_response.status_code == 422


def test_amount_mismatch_returns_409_and_does_not_process_event(client: TestClient, test_db) -> None:
    booking_id, provider_payment_id = create_pending_payment(test_db, client, "amount-mismatch@example.com")

    response = client.post(
        "/api/v1/payments/webhook",
        json=webhook_payload(booking_id, provider_payment_id, amount="501.00"),
    )

    with test_db() as db:
        event_count = db.query(WebhookEvent).count()
        payment = db.query(Payment).one()
        booking = db.get(Booking, booking_id)

    assert response.status_code == 409
    assert event_count == 0
    assert payment.status is PaymentStatus.PENDING
    assert booking.status is BookingStatus.PENDING


def test_duplicate_event_is_idempotent_and_creates_one_event(client: TestClient, test_db) -> None:
    booking_id, provider_payment_id = create_pending_payment(test_db, client, "duplicate-event@example.com")
    payload = webhook_payload(booking_id, provider_payment_id)

    first_response = client.post("/api/v1/payments/webhook", json=payload)
    second_response = client.post("/api/v1/payments/webhook", json=payload)

    with test_db() as db:
        events = db.query(WebhookEvent).filter_by(provider_event_id="evt_123").all()
        payments = db.query(Payment).filter_by(booking_id=booking_id).all()
        booking = db.get(Booking, booking_id)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert second_response.json()["duplicate"] is True
    assert len(events) == 1
    assert len(payments) == 1
    assert booking.status is BookingStatus.CONFIRMED


def test_duplicate_event_preserves_payment_id_and_booking_amount(client: TestClient, test_db) -> None:
    booking_id, provider_payment_id = create_pending_payment(test_db, client, "duplicate-payment@example.com")
    payload = webhook_payload(booking_id, provider_payment_id)

    first_response = client.post("/api/v1/payments/webhook", json=payload)
    second_response = client.post(
        "/api/v1/payments/webhook",
        json=webhook_payload(booking_id, provider_payment_id, amount="999.99"),
    )

    with test_db() as db:
        payment = db.query(Payment).filter_by(booking_id=booking_id).one()
        booking = db.get(Booking, booking_id)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert second_response.json()["duplicate"] is True
    assert payment.provider_payment_id == provider_payment_id
    assert payment.amount == Decimal("500.00")
    assert booking.amount == Decimal("500.00")


def test_direct_payment_then_matching_success_webhook_is_safe(client: TestClient) -> None:
    headers = auth_headers(client, "direct-payment-webhook@example.com")
    booking_id = create_booking(client, headers)
    direct_response = client.post(
        "/api/v1/payments",
        json={"booking_id": booking_id, "simulation_outcome": "SUCCESS"},
        headers=headers,
    )
    provider_payment_id = direct_response.json()["provider_payment_id"]

    webhook_response = client.post(
        "/api/v1/payments/webhook",
        json=webhook_payload(booking_id, provider_payment_id),
    )

    assert direct_response.status_code == 200
    assert webhook_response.status_code == 200
    assert webhook_response.json()["payment_status"] == PaymentStatus.SUCCESS.value
    assert webhook_response.json()["booking_status"] == BookingStatus.CONFIRMED.value


def test_invalid_contradictory_state_returns_409(client: TestClient, test_db) -> None:
    headers = auth_headers(client, "contradictory-state@example.com")
    booking_id = create_booking(client, headers)
    direct_response = client.post(
        "/api/v1/payments",
        json={"booking_id": booking_id, "simulation_outcome": "SUCCESS"},
        headers=headers,
    )
    provider_payment_id = direct_response.json()["provider_payment_id"]

    response = client.post(
        "/api/v1/payments/webhook",
        json=webhook_payload(booking_id, provider_payment_id, "evt_contradictory", "FAILED"),
    )

    with test_db() as db:
        event_count = db.query(WebhookEvent).filter_by(provider_event_id="evt_contradictory").count()
        booking = db.get(Booking, booking_id)

    assert response.status_code == 409
    assert event_count == 0
    assert booking.status is BookingStatus.CONFIRMED


def test_cancelled_booking_cannot_be_confirmed_by_webhook(client: TestClient, test_db) -> None:
    headers = auth_headers(client, "cancelled-webhook@example.com")
    booking_id = create_booking(client, headers)
    with test_db() as db:
        booking = db.get(Booking, booking_id)
        db.add(
            Payment(
                booking_id=booking_id,
                amount=booking.amount,
                status=PaymentStatus.PENDING,
                provider_payment_id="provider_cancelled",
            )
        )
        db.commit()
    cancel_response = client.post(f"/api/v1/bookings/{booking_id}/cancel", headers=headers)

    response = client.post(
        "/api/v1/payments/webhook",
        json=webhook_payload(booking_id, "provider_cancelled"),
    )

    assert cancel_response.status_code == 200
    assert response.status_code == 409


def test_two_event_ids_for_same_completed_payment_are_safe(client: TestClient, test_db) -> None:
    booking_id, provider_payment_id = create_pending_payment(test_db, client, "two-events@example.com")
    first_payload = webhook_payload(booking_id, provider_payment_id, "evt_first")
    second_payload = webhook_payload(booking_id, provider_payment_id, "evt_second")

    first_response = client.post("/api/v1/payments/webhook", json=first_payload)
    second_response = client.post("/api/v1/payments/webhook", json=second_payload)

    with test_db() as db:
        events = db.query(WebhookEvent).filter(
            WebhookEvent.provider_event_id.in_(["evt_first", "evt_second"])
        ).all()
        payments = db.query(Payment).filter_by(booking_id=booking_id).all()

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert len(events) == 2
    assert len(payments) == 1
