from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.diagnostic_centre import DiagnosticCentre


def create_centre(db: Session, name: str, location: str) -> DiagnosticCentre:
    centre = DiagnosticCentre(name=name, location=location)
    db.add(centre)
    db.commit()
    db.refresh(centre)
    return centre


def list_centres(db: Session) -> list[DiagnosticCentre]:
    return list(db.scalars(select(DiagnosticCentre).order_by(DiagnosticCentre.id)).all())


def get_centre(db: Session, centre_id: int) -> DiagnosticCentre | None:
    return db.get(DiagnosticCentre, centre_id)