from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.diagnostic_test import DiagnosticTest


def create_diagnostic_test(db: Session, name: str, description: str | None) -> DiagnosticTest:
    diagnostic_test = DiagnosticTest(name=name, description=description)
    db.add(diagnostic_test)
    db.commit()
    db.refresh(diagnostic_test)
    return diagnostic_test


def list_diagnostic_tests(db: Session) -> list[DiagnosticTest]:
    return list(db.scalars(select(DiagnosticTest).order_by(DiagnosticTest.id)).all())


def get_diagnostic_test(db: Session, test_id: int) -> DiagnosticTest | None:
    return db.get(DiagnosticTest, test_id)