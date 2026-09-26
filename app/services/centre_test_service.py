from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.centre_test import CentreTest
from app.models.diagnostic_test import DiagnosticTest


def create_centre_test(db: Session, centre_id: int, test_id: int, price: Decimal) -> CentreTest:
    centre_test = CentreTest(centre_id=centre_id, test_id=test_id, price=price)
    db.add(centre_test)
    db.commit()
    db.refresh(centre_test)
    return centre_test


def get_centre_test(db: Session, centre_id: int, test_id: int) -> CentreTest | None:
    return db.scalar(
        select(CentreTest).where(
            CentreTest.centre_id == centre_id,
            CentreTest.test_id == test_id,
        )
    )


def list_tests_for_centre(db: Session, centre_id: int) -> list[tuple[DiagnosticTest, CentreTest]]:
    statement = (
        select(DiagnosticTest, CentreTest)
        .join(CentreTest, CentreTest.test_id == DiagnosticTest.id)
        .where(CentreTest.centre_id == centre_id)
        .order_by(DiagnosticTest.id)
    )
    return list(db.execute(statement).all())