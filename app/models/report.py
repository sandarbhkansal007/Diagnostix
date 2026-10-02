from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReportStatus(str, Enum):
    PENDING = "PENDING"
    READY = "READY"
    ARCHIVED = "ARCHIVED"


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[ReportStatus] = mapped_column(
        SQLEnum(ReportStatus, name="report_status"),
        nullable=False,
        default=ReportStatus.PENDING,
        index=True,
    )
    summary: Mapped[str | None] = mapped_column(String(255), nullable=True)
    findings: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __init__(self, **kwargs):
        metadata = kwargs.pop("metadata", None)
        super().__init__(**kwargs)
        if metadata is not None:
            self.report_metadata = metadata
