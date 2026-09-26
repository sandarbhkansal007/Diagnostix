from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.models.payment import Payment, PaymentStatus
from app.schemas.payment import PaymentSimulationOutcome


class InvalidPaymentStateError(Exception):
    pass


def process_payment(
    db: Session,
    user_id: int,
    booking_id: int,
    simulation_outcome: PaymentSimulationOutcome,
) -> Payment | None:
    booking = db.scalar(
        select(Booking)
        .where(Booking.id == booking_id, Booking.user_id == user_id)
        .with_for_update()
    )
    if booking is None:
        return None

    existing_payment = db.scalar(
        select(Payment).where(Payment.booking_id == booking_id).with_for_update()
    )
    if existing_payment is not None:
        return existing_payment

    if booking.status is not BookingStatus.PENDING:
        raise InvalidPaymentStateError

    payment_status = (
        PaymentStatus.SUCCESS
        if simulation_outcome is PaymentSimulationOutcome.SUCCESS
        else PaymentStatus.FAILED
    )
    payment = Payment(
        booking_id=booking.id,
        amount=booking.amount,
        status=payment_status,
        provider_payment_id=f"sim_payment_{uuid4().hex}",
    )
    booking.status = (
        BookingStatus.CONFIRMED
        if payment_status is PaymentStatus.SUCCESS
        else BookingStatus.FAILED
    )
    db.add(payment)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing_payment = db.scalar(select(Payment).where(Payment.booking_id == booking_id))
        if existing_payment is None:
            raise
        return existing_payment

    db.refresh(payment)
    return payment