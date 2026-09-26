from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.webhook import PaymentWebhookRequest, PaymentWebhookResponse
from app.services.webhook_service import (
    InvalidWebhookStateError,
    WebhookAmountMismatchError,
    WebhookPaymentNotFoundError,
    process_payment_webhook,
)


router = APIRouter(prefix="/api/v1/payments", tags=["payment-webhooks"])


@router.post("/webhook", response_model=PaymentWebhookResponse)
def payment_webhook(
    payload: PaymentWebhookRequest,
    db: Annotated[Session, Depends(get_db)],
) -> PaymentWebhookResponse:
    try:
        result = process_payment_webhook(db, payload)
    except WebhookPaymentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment or booking not found",
        ) from None
    except WebhookAmountMismatchError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Webhook amount does not match the stored payment amount",
        ) from None
    except InvalidWebhookStateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment or booking is not in a valid webhook state",
        ) from None

    return PaymentWebhookResponse(
        provider_event_id=result.event.provider_event_id,
        event_status=result.event.status,
        payment_status=result.payment.status if result.payment else None,
        booking_status=result.booking.status if result.booking else None,
        duplicate=result.duplicate,
    )