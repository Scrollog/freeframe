from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, field_validator, Field
import uuid
from ..models.user import UserStatus
from ..services.auth_service import BCRYPT_MAX_PASSWORD_BYTES


def _reject_bcrypt_overflow(password: str) -> str:
    if len(password.encode("utf-8")) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError(f"password must be at most {BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes")
    return password


NewPassword = Annotated[str, Field(min_length=8), AfterValidator(_reject_bcrypt_overflow)]
PreferenceString = Annotated[str, Field(max_length=64)]
NotificationPreferences = Annotated[
    dict[PreferenceString, PreferenceString], Field(max_length=50)
]

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    needs_password: bool = False  # True if user needs to set password

class RefreshRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None
    status: UserStatus
    email_verified: bool = False
    is_superadmin: bool = False
    preferences: dict = {}

    model_config = {"from_attributes": True}

    @field_validator("avatar_url", mode="after")
    @classmethod
    def resolve_avatar_url(cls, v: str | None) -> str | None:
        if v and not v.startswith("http"):
            from ..services import s3_service
            return s3_service.generate_presigned_get_url(v)
        return v

class AdminUserResponse(UserResponse):
    """UserResponse plus the pending invite token.

    Only for admin-gated endpoints: exposing invite_token to any authenticated
    caller lets them hijack a pending invite before the invitee accepts it.
    """
    invite_token: str | None = None

class InviteRequest(BaseModel):
    email: EmailStr
    name: str

# Magic code flow
class SendMagicCodeRequest(BaseModel):
    email: EmailStr

class SendMagicCodeResponse(BaseModel):
    message: str
    email: str

class VerifyMagicCodeRequest(BaseModel):
    email: EmailStr
    code: str

class SetPasswordRequest(BaseModel):
    password: NewPassword

# Invite flow
class AcceptInviteRequest(BaseModel):
    token: str
    password: NewPassword

class InviteInfoResponse(BaseModel):
    email: str
    name: str
    org_name: str | None = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: NewPassword


class PreferencesUpdate(BaseModel):
    """Bounded user preferences supported by the current settings screens."""
    model_config = {"extra": "forbid"}

    theme: Annotated[str | None, Field(max_length=16)] = None
    notifications: NotificationPreferences | None = None

class UpdateProfileRequest(BaseModel):
    name: str | None = None
    avatar_url: str | None = None

class UpdateUserRoleRequest(BaseModel):
    is_admin: bool

class DeactivateUserRequest(BaseModel):
    user_id: uuid.UUID

