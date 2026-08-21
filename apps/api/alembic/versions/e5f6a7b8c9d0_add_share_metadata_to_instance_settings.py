"""add configurable share preview metadata

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "instance_settings",
        sa.Column("share_metadata_title", sa.String(length=255), server_default="FreeFrame", nullable=False),
    )
    op.add_column(
        "instance_settings",
        sa.Column(
            "share_metadata_description",
            sa.Text(),
            server_default="Collaborative media review and approval platform",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("instance_settings", "share_metadata_description")
    op.drop_column("instance_settings", "share_metadata_title")
