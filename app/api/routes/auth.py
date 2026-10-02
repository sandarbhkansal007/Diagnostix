from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import bearer_scheme, get_current_user, get_db
from app.core.security import create_access_token, decode_access_token
from app.models.revoked_token import RevokedToken
from app.models.user import User
from app.schemas.auth import (
    AuthCredentials,
    AuthResponse,
    PasswordChangeRequest,
    ProfileUpdate,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_user,
    change_user_password,
    create_user,
    get_user_by_email,
)


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

    return AuthResponse(user=user, access_token=create_access_token(str(user.id), token_version=user.token_version))


@router.post("/login", response_model=AuthResponse)
def login(credentials: AuthCredentials, db: Annotated[Session, Depends(get_db)]) -> AuthResponse:
    email = str(credentials.email).lower()
    user = authenticate_user(db, email, credentials.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return AuthResponse(user=user, access_token=create_access_token(str(user.id), token_version=user.token_version))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    return current_user


@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    return current_user


@router.put("/profile", response_model=UserResponse)
def update_profile(
    payload: ProfileUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    normalized_email = str(payload.email).lower() if payload.email is not None else current_user.email
    if payload.email is not None and normalized_email != current_user.email and get_user_by_email(db, normalized_email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    if payload.email is not None:
        current_user.email = normalized_email

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=dict[str, str])
def change_password(
    payload: PasswordChangeRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    try:
        change_user_password(db, current_user, payload.current_password, payload.new_password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    return {"message": "Password updated successfully"}


@router.post("/logout", response_model=dict[str, str])
def logout(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if payload is None or payload.get("jti") is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    jti = str(payload["jti"])
    if db.scalar(select(RevokedToken).where(RevokedToken.jti == jti)) is None:
        db.add(RevokedToken(user_id=current_user.id, jti=jti))
        db.commit()

    return {"message": "Logged out successfully"}