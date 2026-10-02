from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.report import ReportStatus


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    booking_id: int
    status: ReportStatus
    summary: str | None = None
    findings: str | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime
