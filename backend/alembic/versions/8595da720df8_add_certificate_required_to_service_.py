"""add certificate_required to service domains

Revision ID: 8595da720df8
Revises: d6f1b2c8a904
"""

from alembic import op
import sqlalchemy as sa


revision = "8595da720df8"
down_revision = "d6f1b2c8a904"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "service_domains",
        sa.Column(
            "certificate_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # Remove the server default after existing rows have been populated.
    # The SQLAlchemy model itself can continue to define its own default.
    op.alter_column(
        "service_domains",
        "certificate_required",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column(
        "service_domains",
        "certificate_required",
    )