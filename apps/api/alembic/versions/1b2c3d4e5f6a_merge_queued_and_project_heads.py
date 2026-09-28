"""merge queued processing and project schema heads

Revision ID: 1b2c3d4e5f6a
Revises: 0a1b2c3d4e5f, c8d9e2f1a3b4
Create Date: 2026-09-28

"""

from typing import Sequence, Union


revision: str = "1b2c3d4e5f6a"
down_revision: Union[str, Sequence[str], None] = (
    "0a1b2c3d4e5f",
    "c8d9e2f1a3b4",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Join independent migration histories without changing schema."""


def downgrade() -> None:
    """Split the migration histories without changing schema."""

