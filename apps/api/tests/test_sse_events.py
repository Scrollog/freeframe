"""Regression coverage for synchronous real-time event publication."""
import json
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from apps.api.services import event_service
from apps.api.models.asset import AssetType
from apps.api.tasks import transcode_tasks
from packages.transcoder.base import TranscodeResult


def test_publish_sync_sends_the_event_envelope_to_its_project_channel():
    redis = MagicMock()
    with patch.object(event_service, "_get_sync_redis", return_value=redis):
        assert event_service.publish_sync("project-1", "new_comment", {"comment_id": "comment-1"})

    channel, envelope = redis.publish.call_args.args
    assert channel == "project:project-1"
    assert json.loads(envelope) == {
        "type": "new_comment",
        "payload": {"comment_id": "comment-1"},
    }


def test_publish_sync_keeps_a_completed_request_successful_when_redis_is_down():
    redis = MagicMock()
    redis.publish.side_effect = ConnectionError("Redis unavailable")
    with patch.object(event_service, "_get_sync_redis", return_value=redis):
        assert not event_service.publish_sync("project-1", "new_comment", {})


def test_resolving_a_comment_publishes_its_resulting_state():
    from apps.api.routers import comments

    project_id, asset_id, comment_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    comment = SimpleNamespace(id=comment_id, asset_id=asset_id, resolved=False)
    asset = SimpleNamespace(id=asset_id, project_id=project_id)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = comment

    with patch.object(comments, "_get_asset", return_value=asset), \
         patch.object(comments, "require_asset_access"), \
         patch.object(comments, "_build_comment_response", return_value={}), \
         patch.object(comments.event_service, "publish_sync") as publish:
        comments.resolve_comment(comment_id, db=db, current_user=MagicMock())

    assert publish.call_args.args == (
        project_id,
        "comment_resolved",
        {
            "asset_id": str(asset_id),
            "comment_id": str(comment_id),
            "resolved": True,
        },
    )


def test_approval_event_matches_the_declared_client_contract():
    from apps.api.routers import approvals

    project_id, asset_id, user_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    asset = SimpleNamespace(
        id=asset_id,
        project_id=project_id,
        name="clip",
        created_by=user_id,
    )
    user = SimpleNamespace(id=user_id, name="Alice", email="alice@example.test")
    body = SimpleNamespace(version_id=uuid.uuid4(), note=None)

    with patch.object(approvals, "_get_asset", return_value=asset), \
         patch.object(approvals, "require_project_role"), \
         patch.object(approvals, "_upsert_approval", return_value=SimpleNamespace()), \
         patch.object(approvals.event_service, "publish_sync") as publish:
        approvals.approve_asset(asset_id, body, db=MagicMock(), current_user=user)

    assert publish.call_args.args == (
        project_id,
        "approval_updated",
        {"asset_id": str(asset_id), "user_id": str(user_id), "status": "approved"},
    )


def test_transcode_progress_event_matches_the_declared_client_contract():
    asset = SimpleNamespace(
        id=uuid.uuid4(), project_id=uuid.uuid4(), asset_type=AssetType.video,
    )
    version = SimpleNamespace(id=uuid.uuid4())
    media_file = SimpleNamespace(
        s3_key_raw="raw/clip.mp4",
        s3_key_processed=None,
        s3_key_thumbnail=None,
        duration_seconds=None,
        width=None,
        height=None,
        fps=None,
    )
    result = TranscodeResult(success=True, hls_prefix="processed/clip")

    async def transcode(_job, progress_callback):
        progress_callback(12.34)
        return result

    with patch("packages.transcoder.ffmpeg_transcoder.FFmpegTranscoder") as transcoder, \
         patch.object(transcode_tasks.event_service, "publish_sync") as publish:
        transcoder.return_value.transcode = transcode
        transcode_tasks._process_video(
            MagicMock(), asset, version, media_file, MagicMock(), "processed/clip"
        )

    assert publish.call_args.args == (
        str(asset.project_id),
        "transcode_progress",
        {"asset_id": str(asset.id), "version_id": str(version.id), "percent": 12.3},
    )
