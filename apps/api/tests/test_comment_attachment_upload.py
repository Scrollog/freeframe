"""Comment attachment upload URLs must use the browser-reachable S3 endpoint."""

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from apps.api.routers.comments import create_attachment
from apps.api.schemas.comment import AttachmentUploadRequest


def test_attachment_upload_uses_public_presigned_url():
    comment_id = uuid.uuid4()
    attachment_id = uuid.uuid4()
    db = MagicMock()
    db.add.side_effect = lambda item: setattr(item, "id", attachment_id)
    comment = SimpleNamespace(id=comment_id, asset_id=uuid.uuid4())
    asset = SimpleNamespace(id=comment.asset_id)
    user = SimpleNamespace(id=uuid.uuid4())

    with patch("apps.api.routers.comments._get_comment", return_value=comment), \
         patch("apps.api.routers.comments._get_asset", return_value=asset), \
         patch("apps.api.routers.comments.require_asset_access"), \
         patch("apps.api.routers.comments.s3_service.generate_presigned_put_url", return_value="http://localhost:9000/upload") as presign:
        result = create_attachment(
            comment_id,
            AttachmentUploadRequest(file_name="notes.png", file_size=12, content_type="image/png"),
            db,
            user,
        )

    assert result.upload_url == "http://localhost:9000/upload"
    assert result.attachment_id == attachment_id
    presign.assert_called_once()
    assert presign.call_args.args[0].startswith(f"comment-attachments/{comment_id}/")
    assert presign.call_args.kwargs["content_type"] == "image/png"
