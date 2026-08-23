"""add editable service domains fields and certificate templates

Revision ID: d6f1b2c8a904
Revises: c92d6e1f4a70
Create Date: 2026-08-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d6f1b2c8a904"
down_revision: Union[str, Sequence[str], None] = "29f2153efe4d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "service_domains",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_service_domains_slug",
        "service_domains",
        ["slug"],
        unique=True,
    )
    op.create_unique_constraint(
        "uq_service_domains_name",
        "service_domains",
        ["name"],
    )

    op.add_column(
        "services",
        sa.Column(
            "domain_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_services_domain_id",
        "services",
        ["domain_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_services_domain_id",
        "services",
        "service_domains",
        ["domain_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "service_field_definitions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "service_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("field_key", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=150), nullable=False),
        sa.Column(
            "field_type",
            sa.String(length=30),
            nullable=False,
        ),
        sa.Column(
            "placeholder",
            sa.String(length=250),
            nullable=True,
        ),
        sa.Column("help_text", sa.Text(), nullable=True),
        sa.Column("is_required", sa.Boolean(), nullable=False),
        sa.Column(
            "is_student_editable",
            sa.Boolean(),
            nullable=False,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("options_json", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["service_id"],
            ["services.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "service_id",
            "field_key",
            name="uq_service_field_key",
        ),
    )
    op.create_index(
        "ix_service_field_definitions_service_id",
        "service_field_definitions",
        ["service_id"],
        unique=False,
    )

    op.create_table(
        "certificate_templates",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "service_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "template_name",
            sa.String(length=180),
            nullable=False,
        ),
        sa.Column(
            "version",
            sa.String(length=40),
            nullable=False,
        ),
        sa.Column(
            "body_template",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "footer_template",
            sa.Text(),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "updated_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["service_id"],
            ["services.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint(
            "service_id",
            name="uq_certificate_templates_service_id",
        ),
    )
    op.create_index(
        "ix_certificate_templates_service_id",
        "certificate_templates",
        ["service_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_certificate_templates_service_id",
        table_name="certificate_templates",
    )
    op.drop_table("certificate_templates")

    op.drop_index(
        "ix_service_field_definitions_service_id",
        table_name="service_field_definitions",
    )
    op.drop_table("service_field_definitions")

    op.drop_constraint(
        "fk_services_domain_id",
        "services",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_services_domain_id",
        table_name="services",
    )
    op.drop_column("services", "domain_id")

    op.drop_constraint(
        "uq_service_domains_name",
        "service_domains",
        type_="unique",
    )
    op.drop_index(
        "ix_service_domains_slug",
        table_name="service_domains",
    )
    op.drop_table("service_domains")