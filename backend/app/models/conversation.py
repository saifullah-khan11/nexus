import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, Float, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class NexusConversation(Base):
    __tablename__ = "nexus_conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ACTIVE",
        index=True,
    )

    # Persistent NEXUS workflow state
    current_intent: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    awaiting: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    transaction_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    pending_user_input: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    ai_confidence: Mapped[float | None] = mapped_column(
        Float,
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