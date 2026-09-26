from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.models.payment import Payment, PaymentStatus
from app.models.webhook_event import WebhookEvent, WebhookEventStatus
from app.schemas.webhook import PaymentWebhookRequest, WebhookPaymentOutcome


class WebhookPaymentNotFoundError(Exception):
    pass


class WebhookAmountMismatchError(Exception):
    pass


class InvalidWebhookStateError(Exception):
    pass


@dataclass
class WebhookProcessingResult:
    event: WebhookEvent
    payment: Payment | None
    booking: Booking | None
    duplicate: bool


def _payload_hash(payload: PaymentWebhookRequest) -> str:
    canonical_payload = json.dumps(payload.model_dump(mode="json"), sort_keys=True)
    return hashlib.sha256(canonical_payload.encode("utf-8")).hexdigest()


def _get_payment_and_booking(
    db: Session,
    provider_payment_id: str,
    booking_id: int,
) -> tuple[Payment, Booking]:
    payment = db.scalar(
        select(Payment)
        .where(Payment.provider_payment_id == provider_payment_id)
        .with_for_update()
    )
    if payment is None or payment.booking_id != booking_id:
        raise WebhookPaymentNotFoundError

    booking = db.scalar(select(Booking).where(Booking.id == booking_id).with_for_update())
    if booking is None:
        raise WebhookPaymentNotFoundError
    return payment, booking


def _apply_webhook_state(
    payment: Payment,
    booking: Booking,
    outcome: WebhookPaymentOutcome,
) -> None:
    target_payment_status = (
        PaymentStatus.SUCCESS
        if outcome is WebhookPaymentOutcome.SUCCESS
        else PaymentStatus.FAILED
    )
    target_booking_status = (
        BookingStatus.CONFIRMED
        if outcome is WebhookPaymentOutcome.SUCCESS
        else BookingStatus.FAILED
    )

    if payment.status is target_payment_status and booking.status is target_booking_status:
        return
    if payment.status is not PaymentStatus.PENDING or booking.status is not BookingStatus.PENDING:
        raise InvalidWebhookStateError

    payment.status = target_payment_status
    booking.status = target_booking_status


def process_payment_webhook(
    db: Session,
    payload: PaymentWebhookRequest,
) -> WebhookProcessingResult:
    event = WebhookEvent(
        provider_event_id=payload.provider_event_id,
        event_type=payload.event_type.value,
        payload_hash=_payload_hash(payload),
        status=WebhookEventStatus.INVALID,
    )

    transaction = db.begin()
    try:
        dialect_name = db.get_bind().dialect.name
        insert_function = {
            "postgresql": postgres_insert,
            "sqlite": sqlite_insert,
        }.get(dialect_name)
        if insert_function is None:
            raise RuntimeError(f"Unsupported database dialect: {dialect_name}")

        insert_statement = insert_function(WebhookEvent).values(
            provider_event_id=event.provider_event_id,
            event_type=event.event_type,
            payload_hash=event.payload_hash,
            status=event.status,
        ).on_conflict_do_nothing(index_elements=["provider_event_id"])
        insert_result = db.execute(insert_statement)

        if insert_result.rowcount == 0:
            existing_event = db.scalar(
                select(WebhookEvent).where(
                    WebhookEvent.provider_event_id == payload.provider_event_id
                )
            )
            if existing_event is None:
                raise RuntimeError(
                    "Webhook event conflict occurred but the existing event could not be loaded"
                )
            payment = db.scalar(
                select(Payment).where(
                    Payment.provider_payment_id == payload.provider_payment_id
                )
            )
            booking = db.get(Booking, payload.booking_id) if payment is not None else None
            transaction.commit()
            return WebhookProcessingResult(existing_event, payment, booking, True)

        event = db.scalar(
            select(WebhookEvent).where(
                WebhookEvent.provider_event_id == payload.provider_event_id
            )
        )

        payment, booking = _get_payment_and_booking(
            db,
            payload.provider_payment_id,
            payload.booking_id,
        )
        if payload.amount is not None and payload.amount != payment.amount:
            raise WebhookAmountMismatchError

        _apply_webhook_state(payment, booking, payload.payment_outcome)
        event.status = WebhookEventStatus.PROCESSED
        event.processed_at = datetime.now(timezone.utc)
        transaction.commit()
        return WebhookProcessingResult(event, payment, booking, False)
    except Exception:
        transaction.rollback()
        raise