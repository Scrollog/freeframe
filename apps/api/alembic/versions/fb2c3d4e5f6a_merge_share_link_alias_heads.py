"""merge share-link alias and metadata migration heads

Revision ID: fb2c3d4e5f6a
Revises: e5f6a7b8c9d0, fa1b2c3d4e5f
Create Date: 2026-09-05
"""

from typing import Sequence, Union


revision: str = "fb2c3d4e5f6a"
down_revision: Union[str, Sequence[str], None] = ("e5f6a7b8c9d0", "fa1b2c3d4e5f")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
