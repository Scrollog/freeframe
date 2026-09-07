import re

from pydantic import BaseModel, field_validator

from ..models.instance_branding import DEFAULT_INSTANCE_ORG_NAME


_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}\Z")


class InstanceBrandingUpdate(BaseModel):
    """Safe instance-branding values that do not reference storage objects.

    Logo and icon keys are deliberately introduced with the validated upload
    flow, rather than accepting arbitrary object-store paths in this endpoint.
    """

    org_name: str | None = None
    primary_color: str | None = None
    powered_by_freeframe: bool | None = None

    @field_validator("org_name", mode="before")
    @classmethod
    def validate_org_name(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("org_name must be a non-empty string")
        normalized = value.strip()
        if not 1 <= len(normalized) <= 255:
            raise ValueError("org_name must be between 1 and 255 characters")
        return normalized

    @field_validator("primary_color", mode="before")
    @classmethod
    def validate_primary_color(cls, value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str) or not _HEX_COLOR_RE.fullmatch(value):
            raise ValueError("primary_color must be a 6-digit hex value like '#7c3aed'")
        return value


class InstanceBrandingResponse(BaseModel):
    org_name: str = DEFAULT_INSTANCE_ORG_NAME
    primary_color: str | None = None
    powered_by_freeframe: bool = True
    logo_light_url: str | None = None
    logo_dark_url: str | None = None
    favicon_url: str | None = None
    apple_icon_url: str | None = None
    login_logo_url: str | None = None

    model_config = {"from_attributes": True}


class InstanceBrandingAssetUploadResponse(BaseModel):
    upload_url: str
    key: str


class InstanceBrandingAssetConfirm(BaseModel):
    key: str
