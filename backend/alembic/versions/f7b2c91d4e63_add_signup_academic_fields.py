"""add academic data to student signup requests

Revision ID: f7b2c91d4e63
Revises: e6a3c9f17b42
Create Date: 2026-08-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7b2c91d4e63"
down_revision: Union[str, Sequence[str], None] = "e6a3c9f17b42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "student_signup_requests",
        sa.Column("program", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "student_signup_requests",
        sa.Column("department", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "student_signup_requests",
        sa.Column("year", sa.Integer(), nullable=True),
    )
    op.add_column(
        "student_signup_requests",
        sa.Column("semester", sa.Integer(), nullable=True),
    )
    op.add_column(
        "student_signup_requests",
        sa.Column("academic_session", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("student_signup_requests", "academic_session")
    op.drop_column("student_signup_requests", "semester")
    op.drop_column("student_signup_requests", "year")
    op.drop_column("student_signup_requests", "department")
    op.drop_column("student_signup_requests", "program")