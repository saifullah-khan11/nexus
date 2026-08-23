"""add academic session to student profiles

Revision ID: c92d6e1f4a70
Revises: f7b2c91d4e63
Create Date: 2026-08-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c92d6e1f4a70"
down_revision: Union[str, Sequence[str], None] = "b83f4e1a7c20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "student_profiles",
        sa.Column(

            "academic_session",
            sa.String(length=20),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column(
        "student_profiles",
        "academic_session",
    )