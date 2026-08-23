"""merge migration heads

Revision ID: ea42ca279e73
Revises: 7b3f9c21a4de, 7c9e8a1d2b3c
Create Date: 2026-08-20 07:31:13.109145

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea42ca279e73'
down_revision: Union[str, Sequence[str], None] = ('7b3f9c21a4de', '7c9e8a1d2b3c')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
