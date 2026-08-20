"""add per-comment guest edit token hash

Revision ID: c3d4e5f6a7b8
Revises: b2c4d6e8f0a1
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c4d6e8f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("comments", sa.Column("guest_edit_token_hash", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("comments", "guest_edit_token_hash")
