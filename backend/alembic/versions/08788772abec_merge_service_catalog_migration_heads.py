"""merge service catalog migration heads

Revision ID: 08788772abec
Revises: 8595da720df8, b6ffabae174d
Create Date: 2026-08-24 00:19:08.126457

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '08788772abec'
down_revision: Union[str, Sequence[str], None] = ('8595da720df8', 'b6ffabae174d')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
