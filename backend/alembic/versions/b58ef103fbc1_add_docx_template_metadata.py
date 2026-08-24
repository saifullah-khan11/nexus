"""add docx template metadata

Revision ID: b58ef103fbc1
Revises: 08788772abec
Create Date: 2026-08-24 00:20:14.337709

This migration is intentionally a no-op.

The DOCX template metadata columns were already introduced by
b6ffabae174d. Keeping this revision preserves the existing migration
history without applying the same schema changes twice.
"""

from typing import Sequence, Union


revision: str = "b58ef103fbc1"
down_revision: Union[str, Sequence[str], None] = "08788772abec"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass