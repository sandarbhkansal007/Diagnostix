from datetime import datetime, timezone
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.booking import BookingStatus


class BookingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    centre_test_id: int = Field(gt=0)
    appointment_datetime: datetime

    @field_validator("appointment_datetime")
    @classmethod
    def validate_appointment_datetime(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("appointment_datetime must include a timezone")
        if value <= datetime.now(timezone.utc):
            raise ValueError("appointment_datetime must be in the future")
        return value


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    centre_test_id: int
    appointment_datetime: datetime
    amount: Decimal
    status: BookingStatus
    created_at: datetime
    updated_at: datetime