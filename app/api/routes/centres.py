from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.centre import CentreCreate, CentreResponse
from app.services.centre_service import create_centre, get_centre, list_centres


router = APIRouter(prefix="/api/v1/centres", tags=["centres"])


@router.post("", response_model=CentreResponse, status_code=status.HTTP_201_CREATED)
def create_centre_endpoint(
    payload: CentreCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CentreResponse:
    del current_user
    return create_centre(db, payload.name, payload.location)


@router.get("", response_model=list[CentreResponse])
def get_centres(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[CentreResponse]:
    del current_user
    return list_centres(db)


@router.get("/{centre_id}", response_model=CentreResponse)
def get_centre_by_id(
    centre_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CentreResponse:
    del current_user
    centre = get_centre(db, centre_id)
    if centre is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Centre not found")
    return centre