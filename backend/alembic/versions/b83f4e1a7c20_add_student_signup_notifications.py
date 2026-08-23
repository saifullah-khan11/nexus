"""add student signup notifications

Revision ID: b83f4e1a7c20
Revises: f7b2c91d4e63
Create Date: 2026-08-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b83f4e1a7c20"
down_revision: Union[str, Sequence[str], None] = "f7b2c91d4e63"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing service-request notifications remain valid.
    op.alter_column(
        "notifications",
        "request_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )

    op.add_column(
        "notifications",
        sa.Column(
            "signup_request_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_notifications_signup_request_id",
        "notifications",
        ["signup_request_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_notifications_signup_request_id_student_signup_requests",
        "notifications",
        "student_signup_requests",
        ["signup_request_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_notifications_signup_request_id_student_signup_requests",
        "notifications",
        type_="foreignkey",
    )

    op.drop_index(
        "ix_notifications_signup_request_id",
        table_name="notifications",
    )

    op.drop_column(
        "notifications",
        "signup_request_id",
    )

    op.alter_column(
        "notifications",
        "request_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )