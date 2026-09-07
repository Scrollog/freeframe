"""Public reads and administrator-managed values for global instance branding."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.instance_branding import DEFAULT_INSTANCE_ORG_NAME, InstanceBranding
from ..models.user import User
from ..routers.users import require_admin
from ..schemas.instance_branding import (
    InstanceBrandingAssetConfirm,
    InstanceBrandingAssetUploadResponse,
    InstanceBrandingResponse,
    InstanceBrandingUpdate,
)
from ..services import s3_service
from ..services.branding_service import reset_org_name_cache
from ..config import settings


router = APIRouter(tags=["instance_branding"])

# A deterministic key makes concurrent first writes contend for one row instead
# of creating duplicate singleton settings.
_SINGLETON_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_ASSET_KEY_FIELDS = (
    "logo_light_key",
    "logo_dark_key",
    "favicon_key",
    "apple_icon_key",
    "login_logo_key",
)
_ASSET_SLOTS = {
    "logo-light": ("logo_light_key", {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}),
    "logo-dark": ("logo_dark_key", {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}),
    "favicon": ("favicon_key", {"image/png", "image/svg+xml", "image/x-icon"}),
    "apple-icon": ("apple_icon_key", {"image/png", "image/jpeg", "image/webp"}),
    "login-logo": ("login_logo_key", {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}),
}


def default_instance_branding() -> InstanceBranding:
    """Return built-in branding without writing a row during a public read."""
    return InstanceBranding(
        id=_SINGLETON_ID,
        org_name=DEFAULT_INSTANCE_ORG_NAME,
        powered_by_freeframe=True,
    )


def get_or_create_instance_branding(db: Session) -> InstanceBranding:
    branding = db.query(InstanceBranding).first()
    if branding:
        return branding

    branding = default_instance_branding()
    db.add(branding)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return db.query(InstanceBranding).first()
    db.refresh(branding)
    return branding


def branding_response(branding: InstanceBranding) -> InstanceBrandingResponse:
    response = InstanceBrandingResponse.model_validate(branding)
    for slot, (field, _) in _ASSET_SLOTS.items():
        key = getattr(branding, field)
        if key:
            setattr(response, f"{field.removesuffix('_key')}_url", s3_service.generate_presigned_get_url(key))
    return response


@router.get("/instance/branding", response_model=InstanceBrandingResponse)
def get_instance_branding(db: Session = Depends(get_db)):
    """Return the global visual defaults for authenticated and public pages.

    This remains read-only: opening a login or share page never creates state.
    """
    return branding_response(db.query(InstanceBranding).first() or default_instance_branding())


@router.put("/instance/branding", response_model=InstanceBrandingResponse)
def update_instance_branding(
    body: InstanceBrandingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update non-file global branding values as a superadministrator."""
    del current_user  # authorization is enforced by the dependency above
    branding = get_or_create_instance_branding(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(branding, field, value)
    db.commit()
    db.refresh(branding)
    reset_org_name_cache()
    return branding_response(branding)


@router.delete("/instance/branding", response_model=InstanceBrandingResponse)
def reset_instance_branding(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Restore database branding values to the built-in product defaults.

    Asset deletion happens only after the reset has committed, so a failed
    transaction never leaves a saved row pointing to a deleted object.
    """
    del current_user
    branding = get_or_create_instance_branding(db)
    branding.org_name = DEFAULT_INSTANCE_ORG_NAME
    branding.primary_color = None
    branding.powered_by_freeframe = True
    old_keys = [getattr(branding, field) for field in _ASSET_KEY_FIELDS if getattr(branding, field)]
    for field in _ASSET_KEY_FIELDS:
        setattr(branding, field, None)
    db.commit()
    db.refresh(branding)
    reset_org_name_cache()
    for key in old_keys:
        try:
            s3_service.delete_object(key)
        except Exception:
            pass
    return branding_response(branding)


@router.post("/instance/branding/{slot}-upload", response_model=InstanceBrandingAssetUploadResponse, status_code=status.HTTP_201_CREATED)
def create_branding_asset_upload(
    slot: str,
    content_type: str = Query(...),
    current_user: User = Depends(require_admin),
):
    """Create a short-lived, MIME-pinned upload URL for one known branding slot."""
    del current_user
    spec = _ASSET_SLOTS.get(slot)
    if not spec or content_type.lower() not in spec[1]:
        raise HTTPException(status_code=400, detail="Unsupported branding asset type")
    normalized_type = content_type.lower()
    key = f"branding/instance/{slot}/{uuid.uuid4()}"
    return InstanceBrandingAssetUploadResponse(
        key=key,
        upload_url=s3_service.generate_presigned_put_url(key, content_type=normalized_type, expires_in=3600),
    )


@router.post("/instance/branding/{slot}-confirm", response_model=InstanceBrandingResponse)
def confirm_branding_asset(
    slot: str,
    body: InstanceBrandingAssetConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Verify an uploaded object before making it visible in global branding."""
    del current_user
    spec = _ASSET_SLOTS.get(slot)
    if not spec or not body.key.startswith(f"branding/instance/{slot}/"):
        raise HTTPException(status_code=400, detail="Invalid branding asset key")
    try:
        metadata = s3_service.get_s3_client().head_object(Bucket=settings.s3_bucket, Key=body.key)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Uploaded branding asset was not found") from exc
    content_type = metadata.get("ContentType", "").split(";", 1)[0].lower()
    if content_type not in spec[1] or metadata.get("ContentLength", 0) > settings.instance_branding_max_asset_bytes:
        raise HTTPException(status_code=400, detail="Uploaded branding asset failed validation")
    branding = get_or_create_instance_branding(db)
    field = spec[0]
    old_key = getattr(branding, field)
    setattr(branding, field, body.key)
    db.commit()
    db.refresh(branding)
    if old_key and old_key != body.key:
        try:
            s3_service.delete_object(old_key)
        except Exception:
            pass
    return branding_response(branding)


@router.delete("/instance/branding/{slot}", response_model=InstanceBrandingResponse)
def remove_branding_asset(
    slot: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Clear one branding slot and reclaim its former object after commit."""
    del current_user
    spec = _ASSET_SLOTS.get(slot)
    if not spec:
        raise HTTPException(status_code=404, detail="Unknown branding asset slot")
    branding = get_or_create_instance_branding(db)
    field = spec[0]
    old_key = getattr(branding, field)
    setattr(branding, field, None)
    db.commit()
    db.refresh(branding)
    if old_key:
        try:
            s3_service.delete_object(old_key)
        except Exception:
            pass
    return branding_response(branding)
