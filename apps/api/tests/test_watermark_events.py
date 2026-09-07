"""Watermark completion must use the shared SSE event publisher."""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import uuid

from apps.api.tasks import watermark_tasks


def _query_with(row):
    query = MagicMock()
    query.filter.return_value = query
    query.order_by.return_value = query
    query.first.return_value = row
    return query


def test_watermark_completion_publishes_through_shared_event_service(tmp_path):
    asset_id = uuid.uuid4()
    asset = SimpleNamespace(id=asset_id, project_id="project-1")
    version = SimpleNamespace(id=uuid.uuid4())
    source = SimpleNamespace(original_filename="clip.mp4", s3_key_raw="raw/clip.mp4")
    db = MagicMock()
    db.query.side_effect = [_query_with(asset), _query_with(version), _query_with(source)]
    s3 = MagicMock()

    def download_file(_bucket, _key, destination):
        with open(destination, "wb") as file:
            file.write(b"source")

    s3.download_file.side_effect = download_file

    with patch.object(watermark_tasks, "SessionLocal", return_value=db), \
         patch("apps.api.services.s3_service.get_s3_client", return_value=s3), \
         patch("apps.api.services.s3_service.put_object") as put_object, \
         patch.object(watermark_tasks.event_service, "publish_sync") as publish:
        watermark_tasks.apply_watermark.run(str(asset_id), "", "corner", 0.5, None)

    put_object.assert_called_once()
    publish.assert_called_once_with(
        "project-1",
        "watermark_complete",
        {"asset_id": str(asset_id), "key": f"watermarked/{asset_id}/output.mp4"},
    )
    db.close.assert_called_once()
