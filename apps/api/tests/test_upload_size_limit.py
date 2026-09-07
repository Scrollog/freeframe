"""Tests for the configurable per-file upload size limit (issue #64).

The 10 GB per-file cap used to be hardcoded. It is now driven by
`settings.max_upload_bytes`, where 0 means unlimited (no per-file cap).
"""
import pytest

from apps.api.config import settings
from pydantic import ValidationError

from apps.api.schemas.upload import (
    InitiateUploadRequest, MAX_MULTIPART_BYTES, upload_size_error,
)


def test_unlimited_when_zero(monkeypatch):
    """max_upload_bytes == 0 disables the cap — no error even for huge files."""
    monkeypatch.setattr(settings, "max_upload_bytes", 0)
    assert upload_size_error(50 * 1024 * 1024 * 1024) is None  # 50 GB


def test_rejects_file_over_limit(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 2 * 1024 * 1024 * 1024)  # 2 GB cap
    err = upload_size_error(3 * 1024 * 1024 * 1024)  # 3 GB
    assert err is not None
    assert "2 GB" in err  # message reports the configured cap, not a hardcoded 10 GB


def test_allows_file_at_or_under_limit(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 2 * 1024 * 1024 * 1024)  # 2 GB cap
    assert upload_size_error(2 * 1024 * 1024 * 1024) is None  # exactly at the cap
    assert upload_size_error(1 * 1024 * 1024 * 1024) is None  # under the cap


def _upload_request(size: int) -> dict:
    return {
        "project_id": "00000000-0000-0000-0000-000000000001",
        "asset_name": "clip",
        "original_filename": "clip.mp4",
        "mime_type": "video/mp4",
        "file_size_bytes": size,
    }


def test_initiate_upload_rejects_non_positive_file_sizes():
    for size in (0, -1):
        with pytest.raises(ValidationError):
            InitiateUploadRequest(**_upload_request(size))


def test_initiate_upload_rejects_size_beyond_multipart_ceiling():
    with pytest.raises(ValidationError):
        InitiateUploadRequest(**_upload_request(MAX_MULTIPART_BYTES + 1))


def test_initiate_upload_accepts_multipart_ceiling():
    request = InitiateUploadRequest(**_upload_request(MAX_MULTIPART_BYTES))
    assert request.file_size_bytes == MAX_MULTIPART_BYTES
