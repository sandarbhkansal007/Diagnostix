from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.payment_service import InvalidPaymentStateError, process_payment


router = APIRouter(prefix="/api/v1/payments", tags=["payments"])


@router.post("", response_model=PaymentResponse)
def create_payment(
    payload: PaymentCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaymentResponse:
    try:
        payment = process_payment(
            db,
            current_user.id,
            payload.booking_id,
            payload.simulation_outcome,
        )
    except InvalidPaymentStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Booking is not payable in its current state",
        ) from None

    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return payment