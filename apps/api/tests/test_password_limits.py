"""Passwords must never be silently truncated by bcrypt."""
import pytest
from pydantic import ValidationError

from apps.api.schemas.auth import AcceptInviteRequest, ChangePasswordRequest, SetPasswordRequest
from apps.api.services.auth_service import BCRYPT_MAX_PASSWORD_BYTES, bcrypt_password_bytes


def test_new_password_schemas_reject_utf8_values_bcrypt_would_truncate():
    password = "é" * 37  # 74 UTF-8 bytes, despite only 37 characters

    with pytest.raises(ValidationError):
        SetPasswordRequest(password=password)
    with pytest.raises(ValidationError):
        AcceptInviteRequest(token="invite", password=password)
    with pytest.raises(ValidationError):
        ChangePasswordRequest(current_password="current-password", new_password=password)


def test_new_password_schemas_allow_exactly_72_utf8_bytes():
    password = "é" * 36

    assert SetPasswordRequest(password=password).password == password


def test_bcrypt_input_is_limited_by_bytes_not_characters():
    assert len(bcrypt_password_bytes("é" * 40)) == BCRYPT_MAX_PASSWORD_BYTES
