"""Schemas for the simulated provider callback.

The assumed payload format is provider_event_id, event_type
(payment.succeeded or payment.failed), provider_payment_id, booking_id,
payment_outcome (SUCCESS or FAILED), and an optional Decimal amount.
"""

from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.booking import BookingStatus
from app.models.payment import PaymentStatus
from app.models.webhook_event import WebhookEventStatus


class WebhookEventType(str, Enum):
    PAYMENT_SUCCEEDED = "payment.succeeded"
    PAYMENT_FAILED = "payment.failed"


class WebhookPaymentOutcome(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class PaymentWebhookRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider_event_id: str = Field(min_length=1, max_length=255)
    event_type: WebhookEventType
    provider_payment_id: str = Field(min_length=1, max_length=255)
    booking_id: int = Field(gt=0)
    payment_outcome: WebhookPaymentOutcome
    amount: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)

    @model_validator(mode="after")
    def validate_event_outcome(self) -> "PaymentWebhookRequest":
        expected_event_type = (
            WebhookEventType.PAYMENT_SUCCEEDED
            if self.payment_outcome is WebhookPaymentOutcome.SUCCESS
            else WebhookEventType.PAYMENT_FAILED
        )
        if self.event_type is not expected_event_type:
            raise ValueError("event_type and payment_outcome do not match")
        return self


class PaymentWebhookResponse(BaseModel):
    provider_event_id: str
    event_status: WebhookEventStatus
    payment_status: PaymentStatus | None
    booking_status: BookingStatus | None
    duplicate: bool = False