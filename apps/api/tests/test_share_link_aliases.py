"""Regression tests for human-friendly public share-link names."""

from fastapi import HTTPException
import pytest

from apps.api.services.share_link_aliases import _validate_slug, normalize_share_slug


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("Review Client", "review-client"),
        ("Revisão do Cliente", "revisao-do-cliente"),
        ("  final__cut!!!  ", "final-cut"),
        ("", None),
        (None, None),
    ],
)
def test_normalize_share_slug(value, expected):
    assert normalize_share_slug(value) == expected


@pytest.mark.parametrize("slug", ["ab", "a" * 65, "admin", "contains spaces"])
def test_invalid_custom_slug_is_rejected(slug):
    with pytest.raises(HTTPException):
        _validate_slug(slug)
