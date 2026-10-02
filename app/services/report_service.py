from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.report import Report


def list_user_reports(db: Session, user_id: int) -> list[Report]:
    statement = (
        select(Report)
        .where(Report.user_id == user_id)
        .order_by(Report.created_at.desc(), Report.id.desc())
    )
    return list(db.scalars(statement).all())


def get_user_report(db: Session, user_id: int, report_id: int) -> Report | None:
    statement = select(Report).where(
        Report.id == report_id,
        Report.user_id == user_id,
    )
    return db.scalar(statement)
