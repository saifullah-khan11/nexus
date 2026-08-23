"""add transaction id to service requests

Revision ID: 7b3f9c21a4de
Revises: ac74f8e6576d
Create Date: 2026-08-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7b3f9c21a4de"
down_revision: Union[str, Sequence[str], None] = "ac74f8e6576d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "service_requests",
        sa.Column(
            "transaction_id",
            sa.String(length=100),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_service_requests_transaction_id",
        "service_requests",
        ["transaction_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_service_requests_transaction_id",
        table_name="service_requests",
    )

    op.drop_column(
        "service_requests",
        "transaction_id",
    )