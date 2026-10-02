from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.report import ReportResponse
from app.services.report_service import get_user_report, list_user_reports


router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


def to_report_response(report) -> ReportResponse:
    return ReportResponse(
        id=report.id,
        user_id=report.user_id,
        booking_id=report.booking_id,
        status=report.status,
        summary=report.summary,
        findings=report.findings,
        metadata=report.report_metadata,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.get("", response_model=list[ReportResponse])
def get_reports(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ReportResponse]:
    reports = list_user_reports(db, current_user.id)
    return [to_report_response(report) for report in reports]


@router.get("/{report_id}", response_model=ReportResponse)
def get_report_by_id(
    report_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReportResponse:
    report = get_user_report(db, current_user.id, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return to_report_response(report)
