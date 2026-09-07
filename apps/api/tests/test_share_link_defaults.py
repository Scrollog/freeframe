"""Defaults for public review links stay consistent across creation APIs."""
import uuid

from apps.api.models.share import SharePermission
from apps.api.schemas.share import (
    DirectShareCreate,
    MultiShareCreate,
    ShareLinkCreate,
    ShareLinkValidateResponse,
)


def test_new_single_item_share_link_allows_comments_without_downloads():
    link = ShareLinkCreate()

    assert link.permission == SharePermission.comment
    assert link.allow_download is False


def test_new_multi_item_share_link_matches_the_single_item_default():
    link = MultiShareCreate(asset_ids=[uuid.uuid4()])

    assert link.permission == SharePermission.comment
    assert link.allow_download is False


def test_share_validation_fallback_and_direct_shares_remain_read_only():
    """These are not public-link creation defaults and must fail closed."""
    validated = ShareLinkValidateResponse(
        valid=True, asset_id=uuid.uuid4(), requires_password=False,
    )

    assert validated.permission == SharePermission.view
    assert DirectShareCreate(user_id=uuid.uuid4()).permission == SharePermission.view
