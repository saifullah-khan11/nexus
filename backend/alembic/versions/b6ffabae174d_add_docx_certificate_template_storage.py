"""add docx certificate template storage

Revision ID: b6ffabae174d
Revises: d6f1b2c8a904 
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b6ffabae174d"
down_revision: Union[str, Sequence[str], None] = "d6f1b2c8a904"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "certificate_templates",
        sa.Column(
            "template_type",
            sa.String(length=20),
            nullable=False,
            server_default="DOCX",
        ),
    )

    op.add_column(
        "certificate_templates",
        sa.Column(
            "storage_path",
            sa.String(length=500),
            nullable=True,
        ),
    )

    op.add_column(
        "certificate_templates",
        sa.Column(
            "mime_type",
            sa.String(length=120),
            nullable=True,
        ),
    )

    op.add_column(
        "certificate_templates",
        sa.Column(
            "original_file_name",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.alter_column(
        "certificate_templates",
        "template_type",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("certificate_templates", "original_file_name")
    op.drop_column("certificate_templates", "mime_type")
    op.drop_column("certificate_templates", "storage_path")
    op.drop_column("certificate_templates", "template_type")