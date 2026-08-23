import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StudentSignupRequest(Base):
    __tablename__ = "student_signup_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    phone: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    registration_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    program: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    department: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    year: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    semester: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    academic_session: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    proof_storage_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    proof_original_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    proof_content_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    proof_size_bytes: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    review_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
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