"""create knowledge_articles table

Revision ID: c41e7d9a2f6b
Revises: 9d4f8e7f3dbf
Create Date: 2026-08-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c41e7d9a2f6b"
down_revision: Union[str, Sequence[str], None] = "9d4f8e7f3dbf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "knowledge_articles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.String(length=200),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "content",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "keywords",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_knowledge_articles_category",
        "knowledge_articles",
        ["category"],
        unique=False,
    )

    op.create_index(
        "ix_knowledge_articles_is_active",
        "knowledge_articles",
        ["is_active"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_knowledge_articles_is_active",
        table_name="knowledge_articles",
    )

    op.drop_index(
        "ix_knowledge_articles_category",
        table_name="knowledge_articles",
    )

    op.drop_table("knowledge_articles")
