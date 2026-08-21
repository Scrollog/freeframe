"""add secure short codes to share links

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
"""
import secrets
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("share_links", sa.Column("short_code", sa.String(length=16), nullable=True))

    connection = op.get_bind()
    links = connection.execute(sa.text("SELECT id FROM share_links WHERE short_code IS NULL")).fetchall()
    for link in links:
        connection.execute(
            sa.text("UPDATE share_links SET short_code = :code WHERE id = :id"),
            {"code": secrets.token_urlsafe(12), "id": link.id},
        )

    op.alter_column("share_links", "short_code", nullable=False)
    op.create_unique_constraint("uq_share_links_short_code", "share_links", ["short_code"])


def downgrade() -> None:
    op.drop_constraint("uq_share_links_short_code", "share_links", type_="unique")
    op.drop_column("share_links", "short_code")
