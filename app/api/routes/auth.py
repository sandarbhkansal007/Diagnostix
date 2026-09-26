from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import AuthCredentials, AuthResponse, UserResponse
from app.services.auth_service import authenticate_user, create_user, get_user_by_email


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(credentials: AuthCredentials, db: Annotated[Session, Depends(get_db)]) -> AuthResponse:
    email = str(credentials.email).lower()
    if get_user_by_email(db, email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    try:
        user = create_user(db, email, credentials.password)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered") from None

    return AuthResponse(user=user, access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=AuthResponse)
def login(credentials: AuthCredentials, db: Annotated[Session, Depends(get_db)]) -> AuthResponse:
    email = str(credentials.email).lower()
    user = authenticate_user(db, email, credentials.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return AuthResponse(user=user, access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    return current_user