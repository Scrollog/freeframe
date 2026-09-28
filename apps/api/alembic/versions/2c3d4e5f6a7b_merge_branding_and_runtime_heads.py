"""merge branding and runtime migration heads

Revision ID: 2c3d4e5f6a7b
Revises: 1b2c3d4e5f6a, c0a9b1d2e3f4
Create Date: 2026-09-28

"""

from typing import Sequence, Union


revision: str = "2c3d4e5f6a7b"
down_revision: Union[str, Sequence[str], None] = (
    "1b2c3d4e5f6a",
    "c0a9b1d2e3f4",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Join independent migration histories without changing schema."""


def downgrade() -> None:
    """Split the migration histories without changing schema."""
