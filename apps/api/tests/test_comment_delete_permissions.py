import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock


def test_instance_admin_can_delete_another_users_comment(mock_db):
    """Moderation by an instance admin is allowed even outside their projects."""
    from apps.api.routers.comments import delete_comment

    comment = MagicMock()
    comment.id = uuid.uuid4()
    comment.author_id = uuid.uuid4()
    comment.deleted_at = None
    mock_db.first.return_value = comment

    admin = MagicMock()
    admin.id = uuid.uuid4()
    admin.is_superadmin = True

    delete_comment(comment.id, db=mock_db, current_user=admin)

    assert isinstance(comment.deleted_at, datetime)
    assert comment.deleted_at.tzinfo == timezone.utc
    mock_db.commit.assert_called_once()
