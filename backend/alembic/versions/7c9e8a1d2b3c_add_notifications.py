"""add notifications

Revision ID: 7c9e8a1d2b3c
Revises: ac74f8e6576d
Create Date: 2026-08-18 06:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7c9e8a1d2b3c"
down_revision: Union[str, Sequence[str], None] = "ac74f8e6576d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("request_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.String(length=50), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["request_id"],
            ["service_requests.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_notifications_user_id",
        "notifications",
        ["user_id"],
    )
    op.create_index(
        "ix_notifications_request_id",
        "notifications",
        ["request_id"],
    )
    op.create_index(
        "ix_notifications_notification_type",
        "notifications",
        ["notification_type"],
    )
    op.create_index(
        "ix_notifications_is_read",
        "notifications",
        ["is_read"],
    )


def downgrade() -> None:
    op.drop_table("notifications", if_exists=True)