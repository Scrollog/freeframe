"""The visible status must match the Celery retry lifecycle."""
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from celery.exceptions import Reject, Retry

from apps.api.models.asset import ProcessingStatus
from apps.api.tasks import transcode_tasks


def _run_failed_task(retries: int, retry_exception: BaseException):
    asset = SimpleNamespace(
        id=uuid.uuid4(), project_id=uuid.uuid4(), asset_type=transcode_tasks.AssetType.video,
    )
    version = SimpleNamespace(id=uuid.uuid4(), processing_status=ProcessingStatus.uploading)
    media_file = SimpleNamespace(version_id=version.id, s3_key_raw="raw/clip")
    db = MagicMock()
    db.query.return_value = db
    db.filter.return_value = db
    db.first.side_effect = [version, asset, media_file]

    published = []
    task = getattr(transcode_tasks.process_asset, "_get_current_object", lambda: transcode_tasks.process_asset)()
    task.push_request(retries=retries, called_directly=False)
    try:
        with patch.object(transcode_tasks, "SessionLocal", return_value=db), \
             patch.object(transcode_tasks, "get_s3_client", return_value=MagicMock()), \
             patch.object(transcode_tasks, "_process_video", side_effect=RuntimeError("ffmpeg failed")), \
             patch.object(transcode_tasks.event_service, "publish_sync", side_effect=lambda _p, event, _d: published.append(event)), \
             patch.object(task, "retry", side_effect=retry_exception) as retry:
            try:
                task.run(str(asset.id), str(version.id))
            except Exception:
                pass
            return version, published, retry.call_count
    finally:
        task.pop_request()


def test_scheduled_retry_keeps_version_processing():
    version, events, retries = _run_failed_task(0, Retry())

    assert version.processing_status == ProcessingStatus.processing
    assert events == []
    assert retries == 1


def test_final_attempt_marks_version_failed_once():
    task = getattr(transcode_tasks.process_asset, "_get_current_object", lambda: transcode_tasks.process_asset)()
    version, events, retries = _run_failed_task(task.max_retries, Retry())

    assert version.processing_status == ProcessingStatus.failed
    assert events == ["transcode_failed"]
    assert retries == 0


def test_broker_refusal_marks_version_failed():
    version, events, retries = _run_failed_task(0, Reject("broker unavailable", requeue=False))

    assert version.processing_status == ProcessingStatus.failed
    assert events == ["transcode_failed"]
    assert retries == 1
