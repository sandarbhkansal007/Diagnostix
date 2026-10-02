from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class AuthCredentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class PasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr | None = None

    @model_validator(mode="after")
    def validate_email_is_present(self):
        if self.email is None:
            raise ValueError("At least one profile field must be provided")
        return self


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"