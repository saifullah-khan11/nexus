import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ServiceDomain(Base):
    __tablename__ = "service_domains"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        unique=True,
    )

    slug: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        unique=True,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    certificate_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ServiceFieldDefinition(Base):
    __tablename__ = "service_field_definitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    field_key: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    label: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    field_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="TEXT",
    )

    placeholder: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True,
    )

    help_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    is_student_editable: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    sort_order: Mapped[int] = mapped_column(
        nullable=False,
        default=0,
    )

    options_json: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "service_id",
            "field_key",
            name="uq_service_field_key",
        ),
    )


class CertificateTemplate(Base):
    __tablename__ = "certificate_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    template_name: Mapped[str] = mapped_column(
        String(180),
        nullable=False,
    )

    version: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="v1",
    )

    # DOCX or legacy text template.
    template_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="TEXT",
        server_default="TEXT",
    )

    # Private Supabase Storage path for DOCX templates.
    storage_path: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    mime_type: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    original_file_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Editable HTML-like document template.
    # Supported placeholders are derived from ServiceFieldDefinition.field_key.
    body_template: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    footer_template: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )