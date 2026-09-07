"""add instance branding table

Revision ID: c0a9b1d2e3f4
Revises: fb2c3d4e5f6a
Create Date: 2026-09-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c0a9b1d2e3f4"
down_revision: Union[str, Sequence[str], None] = "fb2c3d4e5f6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "instance_branding",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_name", sa.String(length=255), server_default="FreeFrame", nullable=False),
        sa.Column("logo_light_key", sa.String(length=512), nullable=True),
        sa.Column("logo_dark_key", sa.String(length=512), nullable=True),
        sa.Column("favicon_key", sa.String(length=512), nullable=True),
        sa.Column("apple_icon_key", sa.String(length=512), nullable=True),
        sa.Column("login_logo_key", sa.String(length=512), nullable=True),
        sa.Column("primary_color", sa.String(length=7), nullable=True),
        sa.Column("powered_by_freeframe", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("instance_branding")
