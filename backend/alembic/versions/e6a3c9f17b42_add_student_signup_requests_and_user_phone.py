"""add student signup requests and user phone

Revision ID: e6a3c9f17b42
Revises: c41e7d9a2f6b
Create Date: 2026-08-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e6a3c9f17b42"
down_revision: Union[str, Sequence[str], None] = "c41e7d9a2f6b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "phone",
            sa.String(length=30),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_users_phone",
        "users",
        ["phone"],
        unique=False,
    )

    op.create_table(
        "student_signup_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(length=150),
            nullable=False,
        ),
        sa.Column(
            "email",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "phone",
            sa.String(length=30),
            nullable=False,
        ),
        sa.Column(
            "registration_number",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "password_hash",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "proof_storage_path",
            sa.String(length=500),
            nullable=True,
        ),
        sa.Column(
            "proof_original_name",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "proof_content_type",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "proof_size_bytes",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
        ),
        sa.Column(
            "reviewed_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "review_reason",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            nullable=True,
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
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_student_signup_requests_email",
        "student_signup_requests",
        ["email"],
        unique=False,
    )

    op.create_index(
        "ix_student_signup_requests_registration_number",
        "student_signup_requests",
        ["registration_number"],
        unique=False,
    )

    op.create_index(
        "ix_student_signup_requests_status",
        "student_signup_requests",
        ["status"],
        unique=False,
    )

    op.create_index(
        "ix_student_signup_requests_reviewed_by",
        "student_signup_requests",
        ["reviewed_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_student_signup_requests_reviewed_by",
        table_name="student_signup_requests",
    )

    op.drop_index(
        "ix_student_signup_requests_status",
        table_name="student_signup_requests",
    )

    op.drop_index(
        "ix_student_signup_requests_registration_number",
        table_name="student_signup_requests",
    )

    op.drop_index(
        "ix_student_signup_requests_email",
        table_name="student_signup_requests",
    )

    op.drop_table("student_signup_requests")

    op.drop_index(
        "ix_users_phone",
        table_name="users",
    )

    op.drop_column("users", "phone")