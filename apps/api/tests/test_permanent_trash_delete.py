"""Regression coverage for the explicit second deletion step in Recently Deleted."""
import uuid
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

import apps.api.tasks.cleanup_tasks as cleanup_tasks
from apps.api.models.asset import Asset, AssetType, AssetVersion, FileType, MediaFile, ProcessingStatus
from apps.api.models.folder import Folder
from apps.api.models.project import Project, ProjectMember, ProjectRole, ProjectType
from apps.api.models.user import User
from apps.api.routers.folders import permanently_delete_asset, permanently_delete_folder


def _owner_with_project(db):
    owner = User(email=f"trash-{uuid.uuid4()}@test.local", name="Owner")
    db.add(owner)
    db.flush()
    project = Project(name="Trash", project_type=ProjectType.personal, created_by=owner.id)
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=owner.id, role=ProjectRole.owner))
    db.flush()
    return owner, project


def _trashed_asset(db, project, owner, folder_id=None):
    asset = Asset(
        project_id=project.id,
        name="Discarded clip",
        asset_type=AssetType.video,
        created_by=owner.id,
        folder_id=folder_id,
        deleted_at=datetime.now(timezone.utc),
    )
    db.add(asset)
    db.flush()
    version = AssetVersion(
        asset_id=asset.id,
        version_number=1,
        processing_status=ProcessingStatus.ready,
        created_by=owner.id,
    )
    db.add(version)
    db.flush()
    db.add(MediaFile(
        version_id=version.id,
        file_type=FileType.video,
        original_filename="discarded.mp4",
        mime_type="video/mp4",
        file_size_bytes=1024,
        s3_key_raw=f"raw/{version.id}/discarded.mp4",
        s3_key_processed=f"processed/{project.id}/{asset.id}/{version.id}/",
        s3_key_thumbnail=f"thumbnails/{version.id}.jpg",
    ))
    db.flush()
    return asset, version


def test_permanent_asset_delete_requires_trash_and_reclaims_its_media(real_db, monkeypatch):
    deleted = []
    monkeypatch.setattr(cleanup_tasks, "delete_object", deleted.append)
    monkeypatch.setattr(cleanup_tasks, "delete_prefix", deleted.append)
    owner, project = _owner_with_project(real_db)
    asset, version = _trashed_asset(real_db, project, owner)
    asset_id, version_id = asset.id, version.id

    result = permanently_delete_asset(asset_id, real_db, owner)

    assert result["ok"] is True
    assert result["reclaimed"] == {"assets": 1, "media_files": 1}
    assert real_db.query(Asset).filter_by(id=asset_id).count() == 0
    assert real_db.query(AssetVersion).filter_by(id=version_id).count() == 0
    assert set(deleted) == {
        f"raw/{version_id}/discarded.mp4",
        f"processed/{project.id}/{asset_id}/{version_id}/",
        f"thumbnails/{version_id}.jpg",
    }


def test_permanent_folder_delete_removes_its_trashed_contents(real_db, monkeypatch):
    monkeypatch.setattr(cleanup_tasks, "delete_object", lambda _: None)
    monkeypatch.setattr(cleanup_tasks, "delete_prefix", lambda _: None)
    owner, project = _owner_with_project(real_db)
    folder = Folder(
        project_id=project.id,
        name="Discarded folder",
        created_by=owner.id,
        deleted_at=datetime.now(timezone.utc),
    )
    real_db.add(folder)
    real_db.flush()
    asset, _ = _trashed_asset(real_db, project, owner, folder.id)
    folder_id, asset_id = folder.id, asset.id

    result = permanently_delete_folder(folder_id, real_db, owner)

    assert result["ok"] is True
    assert result["reclaimed"]["folders"] == 1
    assert result["reclaimed"]["assets"] == 1
    assert real_db.query(Folder).filter_by(id=folder_id).count() == 0
    assert real_db.query(Asset).filter_by(id=asset_id).count() == 0


def test_permanent_asset_delete_rejects_an_item_outside_the_trash(real_db):
    owner, project = _owner_with_project(real_db)
    asset = Asset(project_id=project.id, name="Live", asset_type=AssetType.video, created_by=owner.id)
    real_db.add(asset)
    real_db.flush()

    with pytest.raises(HTTPException, match="Deleted asset not found"):
        permanently_delete_asset(asset.id, real_db, owner)
