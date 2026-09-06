"""Shared rules for allocating immutable asset-version numbers."""

import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.asset import Asset, AssetVersion


def next_asset_version_number(db: Session, asset_id: uuid.UUID) -> int:
    """Reserve the next monotonically increasing version number for an asset.

    Soft-deleted versions remain in the database and are covered by the unique
    ``(asset_id, version_number)`` constraint, so they must remain part of the
    sequence. Locking the parent asset serializes concurrent upload initiations
    for that asset until the caller flushes the newly created version.
    """
    db.query(Asset.id).filter(Asset.id == asset_id).with_for_update().one()
    highest_version = db.query(func.max(AssetVersion.version_number)).filter(
        AssetVersion.asset_id == asset_id,
    ).scalar()
    return (highest_version or 0) + 1
