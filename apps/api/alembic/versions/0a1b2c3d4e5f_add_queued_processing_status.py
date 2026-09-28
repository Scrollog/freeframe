"""add queued processing status

Revision ID: 0a1b2c3d4e5f
Revises: fb2c3d4e5f6a
Create Date: 2026-09-28
"""

from alembic import op


revision = "0a1b2c3d4e5f"
down_revision = "fb2c3d4e5f6a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL enum values must be added outside Alembic's transaction before
    # application code can write them. IF NOT EXISTS makes a resumed deployment
    # safe after a network interruption.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE processingstatus ADD VALUE IF NOT EXISTS 'queued' BEFORE 'processing'")


def downgrade() -> None:
    # PostgreSQL cannot remove enum values safely. Leaving the unused value is
    # backwards-compatible and avoids rewriting live asset_versions rows.
    pass
