from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.models.centre_test import CentreTest


class InvalidBookingTransitionError(Exception):
    pass


def create_booking(
    db: Session,
    user_id: int,
    centre_test_id: int,
    appointment_datetime: datetime,
) -> Booking | None:
    centre_test = db.get(CentreTest, centre_test_id)
    if centre_test is None:
        return None

    booking = Booking(
        user_id=user_id,
        centre_test_id=centre_test_id,
        appointment_datetime=appointment_datetime,
        amount=Decimal(centre_test.price),
        status=BookingStatus.PENDING,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def list_user_bookings(db: Session, user_id: int) -> list[Booking]:
    statement = (
        select(Booking)
        .where(Booking.user_id == user_id)
        .order_by(Booking.created_at.desc(), Booking.id.desc())
    )
    return list(db.scalars(statement).all())


def get_user_booking(db: Session, user_id: int, booking_id: int) -> Booking | None:
    statement = select(Booking).where(
        Booking.id == booking_id,
        Booking.user_id == user_id,
    )
    return db.scalar(statement)


def cancel_booking(db: Session, user_id: int, booking_id: int) -> Booking | None:
    booking = get_user_booking(db, user_id, booking_id)
    if booking is None:
        return None
    if booking.status is not BookingStatus.PENDING:
        raise InvalidBookingTransitionError

    booking.status = BookingStatus.CANCELLED
    db.commit()
    db.refresh(booking)
    return booking