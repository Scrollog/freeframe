"""Canonical resolution and lifecycle helpers for custom share-link URLs."""

import re
import unicodedata
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models.share import ShareLink, ShareLinkAlias


_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_RESERVED_SLUGS = {"api", "admin", "login", "setup", "share", "s"}


def normalize_share_slug(value: str | None) -> str | None:
    """Convert a human-entered link name into the canonical URL-safe slug."""
    if value is None or not value.strip():
        return None
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", ascii_value.lower())).strip("-")


def _validate_slug(slug: str) -> None:
    if not 3 <= len(slug) <= 64 or not _SLUG_PATTERN.fullmatch(slug):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Custom link names must contain 3 to 64 letters, numbers, or hyphens.",
        )
    if slug in _RESERVED_SLUGS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="This custom link name is reserved.")


def get_active_custom_slug(db: Session, share_link_id: uuid.UUID) -> str | None:
    alias = db.query(ShareLinkAlias).filter(
        ShareLinkAlias.share_link_id == share_link_id,
        ShareLinkAlias.is_active.is_(True),
        ShareLinkAlias.deleted_at.is_(None),
    ).first()
    return alias.slug if alias else None


def resolve_share_link(db: Session, identifier: str) -> ShareLink | None:
    """Resolve a long token, legacy short code, or active custom URL name."""
    link = db.query(ShareLink).filter(
        or_(ShareLink.token == identifier, ShareLink.short_code == identifier),
        ShareLink.deleted_at.is_(None),
    ).first()
    if link:
        return link

    return db.query(ShareLink).join(
        ShareLinkAlias,
        ShareLinkAlias.share_link_id == ShareLink.id,
    ).filter(
        ShareLink.deleted_at.is_(None),
        ShareLinkAlias.is_active.is_(True),
        ShareLinkAlias.deleted_at.is_(None),
        ShareLinkAlias.slug == identifier.lower(),
    ).first()


def set_custom_slug(db: Session, link: ShareLink, requested_slug: str | None) -> str | None:
    """Replace the active custom URL, retaining the former name as reserved history."""
    slug = normalize_share_slug(requested_slug)
    current = db.query(ShareLinkAlias).filter(
        ShareLinkAlias.share_link_id == link.id,
        ShareLinkAlias.is_active.is_(True),
        ShareLinkAlias.deleted_at.is_(None),
    ).first()
    if current and current.slug == slug:
        return slug

    if slug is None:
        if current:
            current.is_active = False
            current.deleted_at = datetime.now(timezone.utc)
        return None

    _validate_slug(slug)
    conflict = db.query(ShareLinkAlias).filter(ShareLinkAlias.slug == slug).first()
    if conflict and conflict.share_link_id != link.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This custom link name is already in use.")
    reserved_identifier = db.query(ShareLink).filter(
        ShareLink.deleted_at.is_(None),
        or_(ShareLink.token == slug, ShareLink.short_code == slug),
    ).first()
    if reserved_identifier:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This custom link name is already in use.")

    if current:
        current.is_active = False
        current.deleted_at = datetime.now(timezone.utc)
    if conflict:
        conflict.is_active = True
        conflict.deleted_at = None
        return slug
    db.add(ShareLinkAlias(share_link_id=link.id, slug=slug))
    return slug
