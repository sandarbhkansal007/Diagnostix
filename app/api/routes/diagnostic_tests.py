from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.diagnostic_test import DiagnosticTestCreate, DiagnosticTestResponse
from app.services.diagnostic_test_service import create_diagnostic_test, list_diagnostic_tests


router = APIRouter(prefix="/api/v1/tests", tags=["diagnostic-tests"])


@router.post("", response_model=DiagnosticTestResponse, status_code=status.HTTP_201_CREATED)
def create_test(
    payload: DiagnosticTestCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DiagnosticTestResponse:
    del current_user
    return create_diagnostic_test(db, payload.name, payload.description)


@router.get("", response_model=list[DiagnosticTestResponse])
def get_tests(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[DiagnosticTestResponse]:
    del current_user
    return list_diagnostic_tests(db)