"""Share-link header banner serialization tests."""

from unittest.mock import patch


@patch("apps.api.routers.share.generate_presigned_get_url")
def test_share_banner_key_is_exposed_as_temporary_url(mock_presign):
    from apps.api.routers.share import _share_appearance_with_banner_url

    mock_presign.return_value = "https://s3.example/banner?signature=temporary"
    appearance = _share_appearance_with_banner_url(
        {"layout": "grid", "header_banner_key": "share-banners/link/banner.webp"}
    )

    assert appearance["header_banner_key"] == "share-banners/link/banner.webp"
    assert appearance["header_banner_url"] == "https://s3.example/banner?signature=temporary"
    mock_presign.assert_called_once_with("share-banners/link/banner.webp")


def test_share_without_banner_has_no_banner_url():
    from apps.api.routers.share import _share_appearance_with_banner_url

    appearance = _share_appearance_with_banner_url({"layout": "grid"})

    assert appearance["header_banner_url"] is None
