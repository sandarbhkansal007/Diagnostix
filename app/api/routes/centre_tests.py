from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.centre_test import CentreTestCreate, CentreTestResponse
from app.services.centre_service import get_centre
from app.services.centre_test_service import (
    create_centre_test,
    get_centre_test,
    list_tests_for_centre,
)
from app.services.diagnostic_test_service import get_diagnostic_test


router = APIRouter(prefix="/api/v1", tags=["centre-tests"])


@router.post("/centre-tests", response_model=CentreTestResponse, status_code=status.HTTP_201_CREATED)
def create_centre_test_endpoint(
    payload: CentreTestCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CentreTestResponse:
    del current_user
    if get_centre(db, payload.centre_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Centre not found")
    if get_diagnostic_test(db, payload.test_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found")
    if get_centre_test(db, payload.centre_id, payload.test_id) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Centre-test association already exists")

    try:
        centre_test = create_centre_test(db, payload.centre_id, payload.test_id, payload.price)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Centre-test association already exists") from None

    diagnostic_test = get_diagnostic_test(db, payload.test_id)
    return CentreTestResponse(
        id=centre_test.id,
        test_id=diagnostic_test.id,
        test_name=diagnostic_test.name,
        description=diagnostic_test.description,
        price=centre_test.price,
    )


@router.get("/centres/{centre_id}/tests", response_model=list[CentreTestResponse])
def get_centre_tests(
    centre_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[CentreTestResponse]:
    del current_user
    if get_centre(db, centre_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Centre not found")

    return [
        CentreTestResponse(
            id=centre_test.id,
            test_id=diagnostic_test.id,
            test_name=diagnostic_test.name,
            description=diagnostic_test.description,
            price=centre_test.price,
        )
        for diagnostic_test, centre_test in list_tests_for_centre(db, centre_id)
    ]