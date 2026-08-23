from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.chat_message import NexusChatMessage
from app.models.conversation import NexusConversation
from app.models.user import User


router = APIRouter(
    prefix="/api/nexus",
    tags=["NEXUS"],
)


class ConversationResponse(BaseModel):
    id: UUID
    title: str | None
    status: str
    created_at: object
    updated_at: object

    model_config = ConfigDict(
        from_attributes=True,
    )


class MessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    message_type: str
    intent: str | None
    ai_confidence: float | None
    request_id: UUID | None
    created_at: object

    model_config = ConfigDict(
        from_attributes=True,
    )


class ConversationDetailResponse(BaseModel):
    id: UUID
    title: str | None
    status: str
    created_at: object
    updated_at: object
    messages: list[MessageResponse]

    model_config = ConfigDict(
        from_attributes=True,
    )


@router.get(
    "/conversations",
    response_model=list[ConversationResponse],
)
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(NexusConversation)
        .filter(
            NexusConversation.user_id == current_user.id,
        )
        .order_by(
            NexusConversation.updated_at.desc(),
        )
        .all()
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
)
def get_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = (
        db.query(NexusConversation)
        .filter(
            NexusConversation.id == conversation_id,
            NexusConversation.user_id == current_user.id,
        )
        .first()
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    messages = (
        db.query(NexusChatMessage)
        .filter(
            NexusChatMessage.conversation_id == conversation.id,
            NexusChatMessage.user_id == current_user.id,
        )
        .order_by(
            NexusChatMessage.created_at.asc(),
        )
        .all()
    )

    return ConversationDetailResponse(
        id=conversation.id,
        title=conversation.title,
        status=conversation.status,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=messages,
    )