"""Download filenames are untrusted and must produce safe RFC 6266 headers."""
from apps.api.services.s3_service import build_content_disposition


def test_content_disposition_preserves_unicode_in_rfc5987_field():
    value = build_content_disposition("revisão final.mp4")

    assert 'filename="revis?o final.mp4"' in value
    assert "filename*=UTF-8''revis%C3%A3o%20final.mp4" in value


def test_content_disposition_removes_controls_bidi_and_paths():
    value = build_content_disposition('folder/evil\\name\r\n\u202epng.exe')

    assert "\r" not in value and "\n" not in value and "\u202e" not in value
    assert "folder_evil_namepng.exe" in value


def test_content_disposition_uses_a_safe_fallback_for_empty_names():
    assert 'filename="download"' in build_content_disposition("\x00\r\n")
