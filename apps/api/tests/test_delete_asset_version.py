"""Regression tests for safe, soft version deletion."""
import uuid
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import apps.api.routers.assets as assets_module
from apps.api.models.asset import ProcessingStatus


def _rows():
    asset = MagicMock(project_id=uuid.uuid4())
    version = MagicMock(processing_status=ProcessingStatus.ready, deleted_at=None)
    return asset, version


def test_delete_asset_version_soft_deletes_terminal_version(monkeypatch, mock_db, test_user):
    asset, version = _rows()
    mock_db.first.side_effect = [asset, version]
    mock_db.count.return_value = 2
    monkeypatch.setattr(assets_module, "require_project_role", lambda *args: None)

    result = assets_module.delete_asset_version(uuid.uuid4(), uuid.uuid4(), mock_db, test_user)

    assert result is None
    assert version.deleted_at is not None
    mock_db.commit.assert_called_once()


def test_delete_asset_version_refuses_the_last_live_version(monkeypatch, mock_db, test_user):
    asset, version = _rows()
    mock_db.first.side_effect = [asset, version]
    mock_db.count.return_value = 1
    monkeypatch.setattr(assets_module, "require_project_role", lambda *args: None)

    with pytest.raises(HTTPException, match="last version") as exc:
        assets_module.delete_asset_version(uuid.uuid4(), uuid.uuid4(), mock_db, test_user)

    assert exc.value.status_code == 409
    assert version.deleted_at is None
    mock_db.commit.assert_not_called()


def test_delete_asset_version_refuses_a_processing_version(monkeypatch, mock_db, test_user):
    asset, version = _rows()
    version.processing_status = ProcessingStatus.processing
    mock_db.first.side_effect = [asset, version]
    monkeypatch.setattr(assets_module, "require_project_role", lambda *args: None)

    with pytest.raises(HTTPException, match="while it is processing") as exc:
        assets_module.delete_asset_version(uuid.uuid4(), uuid.uuid4(), mock_db, test_user)

    assert exc.value.status_code == 409
    mock_db.commit.assert_not_called()
