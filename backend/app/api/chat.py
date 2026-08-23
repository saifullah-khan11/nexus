import re
from uuid import UUID
from functools import wraps
import json


from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.workflow import decide_workflow
from app.core.intent import classify_intent
from app.core.llm import analyze_message, ask_nexus
from app.core.knowledge import build_knowledge_context
from app.core.dynamic_service_fields import (
    build_field_summary,
    build_request_payload,
    field_prompt,
    get_active_service_fields,
    validate_field_value,
)
from app.core.service_profile_autofill import (
    get_missing_required_fields,
    get_service_autofill_values,
    merge_profile_and_student_values,
)
from app.core.notifications import (
    create_request_notification,
    create_staff_notifications,
)

from app.models.request import ServiceRequest
from app.models.service import Service
from app.models.user import User
from app.models.audit import AuditLog
from app.models.conversation import NexusConversation
from app.models.chat_message import NexusChatMessage


router = APIRouter(
    prefix="/api",
    tags=["Chat"],
)


class ChatRequest(BaseModel):
    message: str
    conversation_id: UUID | None = None


class ChatResponse(BaseModel):
    message: str
    intent: str
    confidence: float
    request_id: UUID | None = None
    status: str | None = None
    conversation_id: UUID | None = None


# =========================================================
# TEMPORARY CHAT STATE
# =========================================================
#
# This remains a lightweight runtime cache; PostgreSQL now stores
# the persistent conversation state and messages.
#
# Key:
#   current user's UUID
#
# Value:
#   pending fee-receipt conversation information
#
# PostgreSQL persistence is now integrated below. The dictionary
# is retained as a runtime cache for the existing workflow.
#
# Example:
#
# {
#     user_id: {
#         "intent": "FEE_RECEIPT",
#         "transaction_id": "123456789012",
#         "awaiting": "CONFIRMATION"
#     }
# }
#
# =========================================================

pending_chat_state: dict[UUID, dict] = {}


# =========================================================
# HELPER FUNCTIONS
# =========================================================


def is_likely_transaction_id(message: str) -> bool:
    """
    Basic transaction/UTR validation for the current prototype.

    This is deliberately permissive because different payment
    systems can use different transaction/reference formats.

    We accept:
    - digits
    - letters + digits
    - hyphens
    - underscores
    - spaces

    The value must contain at least 6 characters and at least
    one digit.
    """

    value = message.strip()

    if len(value) < 6 or len(value) > 100:
        return False

    if not any(character.isdigit() for character in value):
        return False

    allowed_characters = set(
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789-_ "
    )

    return all(
        character in allowed_characters
        for character in value
    )


def is_confirmation(message: str) -> bool:
    """
    Detect common natural-language confirmations.

    This remains deterministic for the current prototype.
    The eventual LLM layer will handle broader conversational
    confirmation.
    """

    normalized = " ".join(message.lower().strip().split())

    exact_confirmations = {
        "yes",
        "y",
        "yeah",
        "yep",
        "yup",
        "sure",
        "okay",
        "ok",
        "confirm",
        "confirmed",
        "proceed",
        "go ahead",
        "do it",
        "please do",
        "please proceed",
        "that's correct",
        "that is correct",
        "thats correct",
        "correct",
        "sounds good",
        "looks good",
    }

    if normalized in exact_confirmations:
        return True

    confirmation_phrases = (
        "yes, go ahead",
        "yes go ahead",
        "yes please",
        "yes, please",
        "please create it",
        "please create the request",
        "create it",
        "create the request",
        "go ahead and create",
        "that's right",
        "that is right",
        "thats right",
    )

    return any(
        phrase in normalized
        for phrase in confirmation_phrases
    )


def is_rejection(message: str) -> bool:
    """
    Detect a negative/correction response without necessarily
    cancelling the entire conversation.
    """

    normalized = " ".join(message.lower().strip().split())

    rejection_phrases = {
        "no",
        "n",
        "nope",
        "nah",
        "not correct",
        "that's not correct",
        "that is not correct",
        "thats not correct",
        "wrong",
        "incorrect",
        "not right",
        "that's wrong",
        "that is wrong",
        "thats wrong",
    }

    return normalized in rejection_phrases


def is_cancellation(message: str) -> bool:
    """
    Detect an explicit request to abandon the current workflow.
    """

    normalized = " ".join(message.lower().strip().split())

    cancellation_words = {
        "cancel",
        "cancel it",
        "cancel this",
        "stop",
        "stop this",
        "abort",
        "never mind",
        "nevermind",
        "forget it",
        "don't create it",
        "do not create it",
        "not now",
    }

    return normalized in cancellation_words


def extract_transaction_id(message: str) -> str | None:
    """
    Extract a likely transaction/UTR value from a message.

    Supports messages such as:
      123456789012
      My UTR is 123456789012
      the correct UTR is ABC123456789
      I entered 123456789012 by mistake
    """

    import re

    matches = re.findall(
        r"\b[A-Za-z0-9][A-Za-z0-9_-]{5,99}\b",
        message.strip(),
    )

    for candidate in matches:
        if any(character.isdigit() for character in candidate):
            return candidate

    return None


def clear_pending_chat_state(user_id: UUID) -> None:
    """
    Remove temporary conversation state for a user.
    """

    pending_chat_state.pop(user_id, None)


def get_recent_conversation_context(
    db: Session,
    conversation: NexusConversation | None,
    limit: int = 12,
) -> list[dict[str, str]]:
    """
    Load a bounded recent message window for Gemini.
    """

    if conversation is None:
        return []

    recent_messages = (
        db.query(NexusChatMessage)
        .filter(
            NexusChatMessage.conversation_id == conversation.id,
        )
        .order_by(
            NexusChatMessage.created_at.desc(),
        )
        .limit(limit)
        .all()
    )

    recent_messages.reverse()

    return [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in recent_messages
        if message.content
    ]


def _normalize_service_text(value: str) -> str:
    """
    Normalize service names and user messages so the catalog can be
    used as a deterministic fallback when the classifier/LLM returns
    UNKNOWN.

    Examples:
      TRANSFER_CERTIFICATE -> transfer certificate
      "I need a transfer certificate" -> "i need a transfer certificate"
    """
    normalized = value.lower().strip()
    normalized = normalized.replace("_", " ")
    normalized = normalized.replace("-", " ")
    normalized = re.sub(r"[^a-z0-9\s]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def _resolve_catalog_service(
    db: Session,
    message: str,
) -> Service | None:
    """
    Resolve a service directly from the active service catalog.

    This is intentionally a fallback only. The normal LLM/classifier
    result remains authoritative when it identifies a known service.

    It allows newly-created catalog services such as
    TRANSFER_CERTIFICATE to work without requiring a new hard-coded
    branch in chat.py.
    """
    normalized_message = _normalize_service_text(message)

    if not normalized_message:
        return None

    services = (
        db.query(Service)
        .filter(Service.is_active.is_(True))
        .all()
    )

    # Prefer an exact normalized service-name match.
    for service in services:
        normalized_name = _normalize_service_text(service.name)

        if normalized_message == normalized_name:
            return service

    # Prefer a full service phrase appearing in the user's message.
    phrase_matches: list[tuple[int, Service]] = []

    for service in services:
        normalized_name = _normalize_service_text(service.name)

        if not normalized_name:
            continue

        if normalized_name in normalized_message:
            phrase_matches.append(
                (len(normalized_name), service)
            )

    if phrase_matches:
        phrase_matches.sort(
            key=lambda item: item[0],
            reverse=True,
        )
        return phrase_matches[0][1]

    # Last fallback: require every meaningful service token to appear
    # in the message. This helps with phrases such as:
    # "I want to apply for my transfer certificate".
    message_tokens = set(normalized_message.split())

    token_matches: list[tuple[int, Service]] = []

    for service in services:
        normalized_name = _normalize_service_text(service.name)
        service_tokens = {
            token
            for token in normalized_name.split()
            if len(token) >= 3
        }

        if not service_tokens:
            continue

        if service_tokens.issubset(message_tokens):
            token_matches.append(
                (len(service_tokens), service)
            )

    if token_matches:
        token_matches.sort(
            key=lambda item: item[0],
            reverse=True,
        )
        return token_matches[0][1]

    return None


def get_llm_analysis(
    message: str,
    conversation_history: list[dict[str, str]] | None = None,
    knowledge_context: str | None = None,
) -> dict | None:
    """
    Ask Gemini to understand the latest message with recent
    conversation context.
    """

    try:
        result = analyze_message(
            message,
            conversation_history=conversation_history,
            knowledge_context=knowledge_context,
        )

        if not isinstance(result, dict):
            return None

        if result.get("type") not in {
            "GENERAL_QUESTION",
            "SERVICE_REQUEST",
            "CONFIRMATION",
            "CANCELLATION",
            "CORRECTION",
            "FOLLOW_UP",
            "UNKNOWN",
        }:
            return None

        return result

    except Exception:
        return None



# =========================================================
# PERSISTENT NEXUS CONVERSATION HELPERS
# =========================================================


def _get_or_create_conversation(
    db: Session,
    user_id: UUID,
    first_message: str,
    conversation_id: UUID | None = None,
) -> NexusConversation:
    """
    Use the explicitly selected conversation when provided.

    A conversation can only be used by its owning user. When no
    conversation_id is supplied, create a new conversation for the
    new chat instead of accidentally appending to a different active
    conversation.
    """

    if conversation_id is not None:
        conversation = (
            db.query(NexusConversation)
            .filter(
                NexusConversation.id == conversation_id,
                NexusConversation.user_id == user_id,
                NexusConversation.status == "ACTIVE",
            )
            .first()
        )

        if conversation is None:
            from fastapi import HTTPException

            raise HTTPException(
                status_code=404,
                detail="NEXUS conversation not found.",
            )

        return conversation

    # conversation_id == None means this is an explicit NEW CHAT.
    # Never reuse another active conversation here.
    title = " ".join(first_message.split()).strip()

    if len(title) > 80:
        title = title[:77].rstrip() + "..."

    conversation = NexusConversation(
        user_id=user_id,
        title=title or "NEXUS Conversation",
        status="ACTIVE",
    )

    db.add(conversation)
    db.flush()

    return conversation


def _load_persistent_chat_state(
    db: Session,
    user_id: UUID,
    conversation: NexusConversation,
) -> None:
    """Restore workflow state from PostgreSQL into the existing cache."""

    if not conversation.awaiting:
        pending_chat_state.pop(user_id, None)
        return

    state = {
        "intent": conversation.current_intent or "UNKNOWN",
        "awaiting": conversation.awaiting,
        "transaction_id": conversation.transaction_id,
        "user_input": conversation.pending_user_input,
        "confidence": (
            conversation.ai_confidence
            if conversation.ai_confidence is not None
            else 0.95
        ),
    }

    if conversation.pending_user_input:
        try:
            parsed = json.loads(conversation.pending_user_input)
        except (TypeError, ValueError, json.JSONDecodeError):
            parsed = None

        if (
            isinstance(parsed, dict)
            and parsed.get("__nexus_workflow_state__") is True
        ):
            extra_state = parsed.get("state")
            original_message = parsed.get("original_message")

            if isinstance(extra_state, dict):
                state.update(extra_state)

            if isinstance(original_message, str):
                state["user_input"] = original_message

    pending_chat_state[user_id] = state


def _save_persistent_chat_state(
    db: Session,
    user_id: UUID,
    conversation: NexusConversation,
) -> None:
    """Persist the existing workflow state into PostgreSQL."""

    state = pending_chat_state.get(user_id)

    if not state:
        conversation.current_intent = None
        conversation.awaiting = None
        conversation.transaction_id = None
        conversation.pending_user_input = None
        conversation.ai_confidence = None
        return

    conversation.current_intent = state.get("intent")
    conversation.awaiting = state.get("awaiting")
    conversation.transaction_id = state.get("transaction_id")

    confidence = state.get("confidence")

    try:
        conversation.ai_confidence = (
            float(confidence) if confidence is not None else None
        )
    except (TypeError, ValueError):
        conversation.ai_confidence = None

    state_to_persist = {
        key: value
        for key, value in state.items()
        if key not in {
            "intent",
            "awaiting",
            "transaction_id",
            "confidence",
            "user_input",
        }
    }

    if state_to_persist:
        conversation.pending_user_input = json.dumps(
            {
                "__nexus_workflow_state__": True,
                "original_message": state.get("user_input"),
                "state": state_to_persist,
            },
            ensure_ascii=False,
        )
    else:
        conversation.pending_user_input = state.get("user_input")


def _persist_chat_exchange(
    db: Session,
    current_user: User,
    conversation: NexusConversation,
    user_message: str,
    response: ChatResponse,
) -> None:
    """Persist the user/assistant exchange and current workflow state."""

    user_chat_message = NexusChatMessage(
        conversation_id=conversation.id,
        user_id=current_user.id,
        role="USER",
        content=user_message,
        message_type="CHAT",
    )

    assistant_chat_message = NexusChatMessage(
        conversation_id=conversation.id,
        user_id=current_user.id,
        role="ASSISTANT",
        content=response.message,
        message_type="RESPONSE",
        intent=response.intent,
        ai_confidence=response.confidence,
        request_id=response.request_id,
    )

    db.add(user_chat_message)
    db.add(assistant_chat_message)

    _save_persistent_chat_state(
        db=db,
        user_id=current_user.id,
        conversation=conversation,
    )


def persist_nexus_conversation(endpoint):
    """
    Wrap /api/chat without changing the existing endpoint workflow.

    Before the existing chat logic:
      - create/reuse a database conversation
      - restore persistent workflow state
      - save the student's message

    After the existing chat logic:
      - save NEXUS's response
      - save the latest workflow state

    The existing pending_chat_state dictionary remains as a runtime
    cache, while PostgreSQL becomes the source of persistence.
    """

    @wraps(endpoint)
    def wrapper(*args, **kwargs):
        request = kwargs.get("request")
        db = kwargs.get("db")
        current_user = kwargs.get("current_user")

        if request is None or db is None or current_user is None:
            # This should never happen under FastAPI's normal invocation,
            # but leaving the original endpoint callable is safer than
            # failing because of the persistence wrapper.
            return endpoint(*args, **kwargs)

        try:
            conversation = _get_or_create_conversation(
                db=db,
                user_id=current_user.id,
                first_message=request.message,
                conversation_id=request.conversation_id,
            )

            _load_persistent_chat_state(
                db=db,
                user_id=current_user.id,
                conversation=conversation,
            )

            response = endpoint(*args, **kwargs)

            if isinstance(response, ChatResponse):
                _persist_chat_exchange(
                    db=db,
                    current_user=current_user,
                    conversation=conversation,
                    user_message=request.message.strip(),
                    response=response,
                )

                # Expose the exact conversation used by this response so the
                # frontend can keep subsequent messages in the same thread.
                response.conversation_id = conversation.id

                db.commit()

            return response

        except Exception:
            db.rollback()
            raise

    return wrapper


# =========================================================
# CHAT ENDPOINT
# =========================================================


@router.post(
    "/chat",
    response_model=ChatResponse,
)
@persist_nexus_conversation
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = request.message.strip()

    # ---------------------------------------------------------
    # Basic validation
    # ---------------------------------------------------------

    if not message:
        return ChatResponse(
            message="Please tell me what service you need.",
            intent="UNKNOWN",
            confidence=0.30,
        )

    # ---------------------------------------------------------
    # Check whether this user already has a pending
    # Fee Receipt conversation.
    #
    # This must happen BEFORE normal intent classification,
    # because messages such as:
    #
    # "123456789012"
    # "yes"
    #
    # will naturally be classified as UNKNOWN by the current
    # keyword-based intent classifier.
    # ---------------------------------------------------------

    conversation = None

    if request.conversation_id is not None:
        conversation = (
            db.query(NexusConversation)
            .filter(
                NexusConversation.id == request.conversation_id,
                NexusConversation.user_id == current_user.id,
                NexusConversation.status == "ACTIVE",
            )
            .first()
        )
    else:
        conversation = (
            db.query(NexusConversation)
            .filter(
                NexusConversation.user_id == current_user.id,
                NexusConversation.status == "ACTIVE",
            )
            .order_by(
                desc(NexusConversation.updated_at),
            )
            .first()
        )

    conversation_history = get_recent_conversation_context(
        db=db,
        conversation=conversation,
        limit=12,
    )

    knowledge_context = build_knowledge_context(
        query=message,
        limit=4,
    )

    user_state = pending_chat_state.get(
        current_user.id
    )

    # =========================================================
    # STAGE 1:
    # We are waiting for the student's UTR / transaction ID.
    # =========================================================

    if (
        user_state
        and user_state.get("intent") == "FEE_RECEIPT"
        and user_state.get("awaiting") == "TRANSACTION_ID"
    ):
        if is_cancellation(message):
            clear_pending_chat_state(current_user.id)

            return ChatResponse(
                message=(
                    "No problem. I cancelled the Fee Receipt "
                    "request process. Nothing has been created."
                ),
                intent="FEE_RECEIPT",
                confidence=0.95,
            )

        if not is_likely_transaction_id(message):
            return ChatResponse(
                message=(
                    "Please provide a valid transaction ID or "
                    "UTR number. It should contain at least "
                    "6 characters and include a number."
                ),
                intent="FEE_RECEIPT",
                confidence=0.95,
            )

        # Store the UTR temporarily.
        user_state["transaction_id"] = message
        user_state["awaiting"] = "CONFIRMATION"

        return ChatResponse(
            message=(
                f"I have received the transaction ID / UTR "
                f"number **{message}**.\n\n"
                "Please confirm: should I create your "
                "Fee Receipt request using this transaction ID?"
            ),
            intent="FEE_RECEIPT",
            confidence=0.95,
        )

    # =========================================================
    # STAGE 2:
    # We have the UTR and are waiting for confirmation.
    # =========================================================

    if (
        user_state
        and user_state.get("intent") == "FEE_RECEIPT"
        and user_state.get("awaiting") == "CONFIRMATION"
    ):
        if is_cancellation(message):
            clear_pending_chat_state(current_user.id)

            return ChatResponse(
                message=(
                    "No problem. I cancelled the Fee Receipt "
                    "request process. Nothing has been created."
                ),
                intent="FEE_RECEIPT",
                confidence=0.95,
            )

        # If the student says the UTR is wrong, let them replace it.
        if is_rejection(message):
            user_state["awaiting"] = "TRANSACTION_ID"
            user_state["transaction_id"] = None

            return ChatResponse(
                message=(
                    "No problem. I won't create the request yet. "
                    "Please enter the correct transaction ID / UTR number."
                ),
                intent="FEE_RECEIPT",
                confidence=0.95,
            )

        # If the student corrects the UTR in the same message,
        # accept the new value and ask for confirmation again.
        replacement_utr = extract_transaction_id(message)

        if (
            replacement_utr
            and replacement_utr != user_state.get("transaction_id")
        ):
            user_state["transaction_id"] = replacement_utr

            return ChatResponse(
                message=(
                    f"Thanks. I've updated the transaction ID / UTR "
                    f"to **{replacement_utr}**.\n\n"
                    "Is this correct? If yes, I'll create the "
                    "Fee Receipt request."
                ),
                intent="FEE_RECEIPT",
                confidence=0.95,
            )

        if is_confirmation(message):
            transaction_id = user_state.get(
                "transaction_id"
            )

            if not transaction_id:
                clear_pending_chat_state(current_user.id)

                return ChatResponse(
                    message=(
                        "I lost the transaction information "
                        "for this conversation. Please start "
                        "the Fee Receipt request again."
                    ),
                    intent="FEE_RECEIPT",
                    confidence=0.30,
                )

            # We now allow the request to be created.
            intent = "FEE_RECEIPT"
            confidence = 0.95

            service = (
                db.query(Service)
                .filter(
                    Service.name == intent,
                    Service.is_active.is_(True),
                )
                .first()
            )

            if not service:
                clear_pending_chat_state(
                    current_user.id
                )

                return ChatResponse(
                    message=(
                        "I identified the Fee Receipt request, "
                        "but this service is currently unavailable."
                    ),
                    intent=intent,
                    confidence=confidence,
                )

            # -------------------------------------------------
            # Determine workflow
            # -------------------------------------------------

            decision = decide_workflow(service)

            # -------------------------------------------------
            # Create service request WITH UTR
            # -------------------------------------------------

            service_request = ServiceRequest(
                user_id=current_user.id,
                service_id=service.id,
                status=decision.status,
                priority="NORMAL",
                user_input=(
                    "Fee Receipt request. "
                    f"Transaction ID / UTR: {transaction_id}"
                ),
                transaction_id=transaction_id,
                ai_confidence=confidence,
                risk_score=decision.risk_score,
            )

            db.add(service_request)

            # Flush so service_request.id is available for:
            # - audit log
            # - notifications
            db.flush()

            # -------------------------------------------------
            # Create audit log
            # -------------------------------------------------

            audit_log = AuditLog(
                request_id=service_request.id,
                actor_user_id=current_user.id,
                action="REQUEST_CREATED",
                previous_status=None,
                new_status=service_request.status,
                reason=(
                    "Fee Receipt request created through "
                    "NEXUS chat after student confirmed "
                    "the transaction ID / UTR number."
                ),
            )

            db.add(audit_log)

            # -------------------------------------------------
            # Student notification
            # -------------------------------------------------

            if service_request.status == "APPROVAL_REQUIRED":
                student_title = "Approval required"
                student_message = (
                    "Your Fee Receipt request has been received "
                    "and is waiting for the required approval."
                )

            elif service_request.status == "PENDING":
                student_title = "Request received"
                student_message = (
                    "Your Fee Receipt request has been received "
                    "and is waiting to be processed."
                )

            else:
                student_title = "Request received"
                student_message = (
                    "Your Fee Receipt request has been "
                    "received successfully."
                )

            create_request_notification(
                db=db,
                request=service_request,
                notification_type="REQUEST_CREATED",
                title=student_title,
                message=student_message,
            )

            # -------------------------------------------------
            # STAFF + ADMIN notifications
            # -------------------------------------------------

            create_staff_notifications(
                db=db,
                request=service_request,
                notification_type="REQUEST_CREATED",
                title="New service request",
                message=(
                    f"New {service.name.replace('_', ' ').title()} "
                    f"request received from {current_user.name}."
                ),
            )

            # -------------------------------------------------
            # Commit everything together
            # -------------------------------------------------

            db.commit()
            db.refresh(service_request)

            # -------------------------------------------------
            # Clear temporary conversation state
            # -------------------------------------------------

            clear_pending_chat_state(
                current_user.id
            )

            # -------------------------------------------------
            # Return response
            # -------------------------------------------------

            return ChatResponse(
                message=(
                    f"Your Fee Receipt request has been "
                    f"successfully created.\n\n"
                    f"Transaction ID / UTR: {transaction_id}"
                ),
                intent=intent,
                confidence=confidence,
                request_id=service_request.id,
                status=service_request.status,
            )

        if is_cancellation(message):
            clear_pending_chat_state(current_user.id)

            return ChatResponse(
                message=(
                    "Understood. I have not created the "
                    "Fee Receipt request."
                ),
                intent="FEE_RECEIPT",
                confidence=0.95,
            )

        # The student sent something other than yes/no.
        # Keep the UTR and ask for explicit confirmation again.

        transaction_id = user_state.get(
            "transaction_id",
            "",
        )

        return ChatResponse(
            message=(
                f"I still have the transaction ID / UTR as "
                f"**{transaction_id}**.\n\n"
                "Please confirm whether I should create the "
                "Fee Receipt request with this transaction ID."
            ),
            intent="FEE_RECEIPT",
            confidence=0.95,
        )

    # =========================================================
    # DYNAMIC SERVICE FIELD COLLECTION
    # =========================================================
    #
    # Services configured through the Staff/Admin Service Catalog
    # can define their own required fields.
    #
    # NEXUS first checks verified User + StudentProfile data and
    # automatically reuses fields that already exist. It asks the
    # student only for required information that is missing.
    # =========================================================

    if (
        user_state
        and user_state.get("awaiting") == "SERVICE_FIELD"
        and user_state.get("intent") != "FEE_RECEIPT"
    ):
        pending_intent = user_state.get("intent", "UNKNOWN")
        service_id = user_state.get("service_id")

        if not service_id:
            clear_pending_chat_state(current_user.id)

            return ChatResponse(
                message=(
                    "I lost the pending service details. "
                    "Please start the request again."
                ),
                intent="UNKNOWN",
                confidence=0.0,
            )

        dynamic_fields = get_active_service_fields(
            db=db,
            service_id=service_id,
        )

        autofilled_values = dict(
            user_state.get("autofilled_fields", {})
        )

        missing_required_fields = get_missing_required_fields(
            dynamic_fields,
            autofilled_values,
        )

        if not missing_required_fields:
            merged_values = merge_profile_and_student_values(
                autofilled_values=autofilled_values,
                collected_values=user_state.get(
                    "collected_fields",
                    {},
                ),
            )

            user_state["awaiting"] = "CONFIRMATION"

            summary = build_field_summary(
                dynamic_fields,
                merged_values,
            )

            service_label = (
                pending_intent.replace("_", " ").title()
            )

            return ChatResponse(
                message=(
                    f"All required information for your "
                    f"{service_label} is already available.\n\n"
                    f"{summary}\n\n"
                    "Would you like me to create this request?\n\n"
                    "Reply **Yes** to proceed or **No** to cancel."
                ),
                intent=pending_intent,
                confidence=float(
                    user_state.get("confidence", 0.95)
                ),
            )

        field_index = int(
            user_state.get("field_index", 0)
        )

        if field_index >= len(missing_required_fields):
            field_index = len(missing_required_fields) - 1

        current_field = missing_required_fields[field_index]

        valid, validation_message, normalized_value = (
            validate_field_value(
                current_field,
                message,
            )
        )

        if not valid:
            return ChatResponse(
                message=(
                    f"{validation_message}\n\n"
                    f"{field_prompt(current_field)}"
                ),
                intent=pending_intent,
                confidence=float(
                    user_state.get("confidence", 0.95)
                ),
            )

        collected_fields = dict(
            user_state.get("collected_fields", {})
        )

        collected_fields[current_field.field_key] = normalized_value
        user_state["collected_fields"] = collected_fields

        next_index = field_index + 1
        user_state["field_index"] = next_index

        if next_index < len(missing_required_fields):
            next_field = missing_required_fields[next_index]

            return ChatResponse(
                message=(
                    f"Got it — {current_field.label} saved.\n\n"
                    f"{field_prompt(next_field)}"
                ),
                intent=pending_intent,
                confidence=float(
                    user_state.get("confidence", 0.95)
                ),
            )

        merged_values = merge_profile_and_student_values(
            autofilled_values=autofilled_values,
            collected_values=collected_fields,
        )

        user_state["awaiting"] = "CONFIRMATION"

        summary = build_field_summary(
            dynamic_fields,
            merged_values,
        )

        return ChatResponse(
            message=(
                "I've collected the additional information I need.\n\n"
                f"{summary}\n\n"
                "Would you like me to create this request?\n\n"
                "Reply **Yes** to proceed or **No** to cancel."
            ),
            intent=pending_intent,
            confidence=float(
                user_state.get("confidence", 0.95)
            ),
        )

    # =========================================================
    # GENERIC CONFIRMATION FLOW
    # =========================================================
    #
    # All non-Fee-Receipt service requests now require an
    # explicit confirmation before a ServiceRequest is created.
    # This prevents NEXUS from creating a request immediately
    # after the student's first message.
    # =========================================================

    if (
        user_state
        and user_state.get("awaiting") == "CONFIRMATION"
        and user_state.get("intent") != "FEE_RECEIPT"
    ):
        pending_intent = user_state.get("intent", "UNKNOWN")
        pending_message = user_state.get("user_input", message)
        pending_confidence = float(
            user_state.get("confidence", 0.95)
        )

        # Resolve common confirmation/cancellation replies locally first.
        # This avoids a Gemini request for simple messages such as:
        # "yes", "yes go ahead", "no", "cancel it", etc.
        confirmation = is_confirmation(message)
        cancellation = is_cancellation(message)

        if cancellation:
            clear_pending_chat_state(current_user.id)

            return ChatResponse(
                message=(
                    "Understood. I have not created the request. "
                    "You can start again whenever you're ready."
                ),
                intent=pending_intent,
                confidence=pending_confidence,
            )

        if confirmation:
            # A direct confirmation needs no intent re-analysis.
            new_intent = "UNKNOWN"
            new_confidence = pending_confidence
            llm_analysis = None
        else:
            # Only ambiguous responses/corrections need Gemini.
            llm_analysis = get_llm_analysis(
                message,
                conversation_history=conversation_history,
                knowledge_context=knowledge_context,
            )

            if llm_analysis:
                new_intent = llm_analysis.get("intent", "UNKNOWN")
                new_confidence = float(
                    llm_analysis.get("confidence", 0.0)
                )
            else:
                new_intent, new_confidence = classify_intent(message)

        if (
            new_intent != "UNKNOWN"
            and new_intent != pending_intent
            and (
                llm_analysis is None
                or llm_analysis.get("type") in {
                    "SERVICE_REQUEST",
                    "CORRECTION",
                }
            )
        ):
            new_service = (
                db.query(Service)
                .filter(
                    Service.name == new_intent,
                    Service.is_active.is_(True),
                )
                .first()
            )

            if new_service:
                pending_chat_state[current_user.id] = {
                    "intent": new_intent,
                    "service_id": str(new_service.id),
                    "awaiting": "CONFIRMATION",
                    "user_input": message,
                    "confidence": new_confidence,
                }

                new_service_label = (
                    new_service.name.replace("_", " ").title()
                )

                return ChatResponse(
                    message=(
                        f"Understood. I've switched your request to "
                        f"{new_service_label}.\n\n"
                        "Would you like me to proceed with this request?\n\n"
                        "Reply **Yes** to create it or **No** to cancel."
                    ),
                    intent=new_intent,
                    confidence=new_confidence,
                )

        if llm_analysis:
            confirmation = (
                llm_analysis.get("type") == "CONFIRMATION"
                or confirmation
            )
            cancellation = (
                llm_analysis.get("type") == "CANCELLATION"
                or cancellation
            )

        if cancellation:
            clear_pending_chat_state(current_user.id)

            return ChatResponse(
                message=(
                    "Understood. I have not created the request. "
                    "You can start again whenever you're ready."
                ),
                intent=pending_intent,
                confidence=pending_confidence,
            )

        if not confirmation:
            return ChatResponse(
                message=(
                    "I just need your confirmation before I create "
                    "this request. You can say something like "
                    "**Yes, go ahead** or **No, cancel it**."
                ),
                intent=pending_intent,
                confidence=pending_confidence,
            )

        service = (
            db.query(Service)
            .filter(
                Service.name == pending_intent,
                Service.is_active.is_(True),
            )
            .first()
        )

        if not service:
            clear_pending_chat_state(current_user.id)

            return ChatResponse(
                message=(
                    "This service is currently unavailable, so "
                    "I did not create the request."
                ),
                intent=pending_intent,
                confidence=pending_confidence,
            )

        decision = decide_workflow(service)

        dynamic_fields = get_active_service_fields(
            db=db,
            service_id=service.id,
        )

        autofilled_values = dict(
            user_state.get("autofilled_fields", {})
        )

        collected_fields = dict(
            user_state.get("collected_fields", {})
        )

        merged_values = merge_profile_and_student_values(
            autofilled_values=autofilled_values,
            collected_values=collected_fields,
        )

        request_user_input = (
            build_request_payload(
                original_message=pending_message,
                fields=dynamic_fields,
                collected=merged_values,
            )
            if dynamic_fields
            else pending_message
        )

        service_request = ServiceRequest(
            user_id=current_user.id,
            service_id=service.id,
            status=decision.status,
            priority="NORMAL",
            user_input=request_user_input,
            ai_confidence=pending_confidence,
            risk_score=decision.risk_score,
        )

        db.add(service_request)

        # Flush so service_request.id is available for:
        # - audit log
        # - notifications
        db.flush()

        audit_log = AuditLog(
            request_id=service_request.id,
            actor_user_id=current_user.id,
            action="REQUEST_CREATED",
            previous_status=None,
            new_status=service_request.status,
            reason=(
                "Service request created through NEXUS chat "
                "after student confirmation."
                + (
                    " Verified profile data and dynamic service "
                    "fields were included."
                    if dynamic_fields
                    else ""
                )
            ),
        )

        db.add(audit_log)

        if service_request.status == "APPROVAL_REQUIRED":
            student_title = "Approval required"
            student_message = (
                "Your request has been received and is waiting "
                "for the required approval."
            )
        elif service_request.status == "PENDING":
            student_title = "Request received"
            student_message = (
                "Your request has been received and is waiting "
                "to be processed."
            )
        else:
            student_title = "Request received"
            student_message = (
                f"Your {service.name.replace('_', ' ').title()} "
                "request has been received."
            )

        create_request_notification(
            db=db,
            request=service_request,
            notification_type="REQUEST_CREATED",
            title=student_title,
            message=student_message,
        )

        create_staff_notifications(
            db=db,
            request=service_request,
            notification_type="REQUEST_CREATED",
            title="New service request",
            message=(
                f"New {service.name.replace('_', ' ').title()} "
                f"request received from {current_user.name}."
            ),
        )

        db.commit()
        db.refresh(service_request)

        clear_pending_chat_state(current_user.id)

        return ChatResponse(
            message=(
                f"Your {service.name.replace('_', ' ').title()} "
                "request has been successfully created."
                + (
                    " The required service information was attached."
                    if dynamic_fields
                    else ""
                )
            ),
            intent=pending_intent,
            confidence=pending_confidence,
            request_id=service_request.id,
            status=service_request.status,
        )

    # =========================================================
    # LLM MESSAGE UNDERSTANDING
    # =========================================================

    llm_analysis = get_llm_analysis(
                message,
                conversation_history=conversation_history,
                knowledge_context=knowledge_context,
            )

    if llm_analysis:
        message_type = llm_analysis.get("type", "UNKNOWN")
        intent = llm_analysis.get("intent", "UNKNOWN")
        confidence = float(llm_analysis.get("confidence", 0.0))

        # General questions are answered by NEXUS and never create
        # a service request.
        if message_type == "GENERAL_QUESTION":
            # analyze_message() already returns the complete natural-language
            # answer in the "response" field. Returning it directly avoids a
            # second Gemini round trip.
            return ChatResponse(
                message=(
                    llm_analysis.get(
                        "response",
                        "I'm here to help. What would you like to know?",
                    )
                ),
                intent=intent,
                confidence=confidence,
            )

        # Only a service request should enter the request workflow.
        # For other message types, use the existing classifier as
        # a safety fallback.
        if message_type not in {"SERVICE_REQUEST", "FOLLOW_UP"}:
            intent, confidence = classify_intent(message)
    else:
        # Gemini unavailable/rate-limited/etc. -> old workflow.
        intent, confidence = classify_intent(message)

    # ---------------------------------------------------------
    # Resolve the service from the active catalog.
    #
    # The normal LLM/classifier result is used first. If it returns
    # UNKNOWN, use the configured service catalog as a deterministic
    # fallback so newly-added services do not require a new hard-coded
    # workflow branch in this file.
    # ---------------------------------------------------------

    service = None

    if intent != "UNKNOWN":
        service = (
            db.query(Service)
            .filter(
                Service.name == intent,
                Service.is_active.is_(True),
            )
            .first()
        )

    if service is None:
        catalog_service = _resolve_catalog_service(
            db=db,
            message=message,
        )

        if catalog_service is not None:
            service = catalog_service
            intent = catalog_service.name
            confidence = max(
                float(confidence),
                0.90,
            )

    if service is None:
        return ChatResponse(
            message=(
                "I understand your request, but I don't have "
                "a matching service in the current service catalog."
            ),
            intent="UNKNOWN",
            confidence=confidence,
        )


    # =========================================================
    # FEE RECEIPT SPECIAL FLOW
    # =========================================================
    #
    # Do NOT create the request yet.
    #
    # First collect the transaction ID / UTR.
    # Then ask for confirmation.
    # Only after confirmation do we create ServiceRequest.
    # =========================================================

    if intent == "FEE_RECEIPT":
        pending_chat_state[current_user.id] = {
            "intent": "FEE_RECEIPT",
            "awaiting": "TRANSACTION_ID",
            "transaction_id": None,
        }

        return ChatResponse(
            message=(
                "Sure. I can help you request your Fee Receipt.\n\n"
                "Before I create the request, please provide "
                "your transaction ID / UTR number."
            ),
            intent="FEE_RECEIPT",
            confidence=confidence,
        )

    # =========================================================
    # DYNAMIC SERVICE FIELD COLLECTION / PROFILE AUTO-FILL
    # =========================================================
    #
    # Do not create the request yet.
    # Reuse verified profile information first, then ask only for
    # required service-specific fields that are missing.
    # =========================================================

    dynamic_fields = get_active_service_fields(
        db=db,
        service_id=service.id,
    )

    autofilled_values = get_service_autofill_values(
        db=db,
        user_id=current_user.id,
        fields=dynamic_fields,
    )

    missing_required_fields = get_missing_required_fields(
        dynamic_fields,
        autofilled_values,
    )

    pending_chat_state[current_user.id] = {
        "intent": intent,
        "service_id": str(service.id),
        "awaiting": (
            "SERVICE_FIELD"
            if missing_required_fields
            else "CONFIRMATION"
        ),
        "field_index": 0,
        "field_ids": [
            str(field.id)
            for field in missing_required_fields
        ],
        "autofilled_fields": autofilled_values,
        "collected_fields": {},
        "user_input": request.message.strip(),
        "confidence": confidence,
    }

    service_label = service.name.replace("_", " ").title()

    if not missing_required_fields:
        summary = build_field_summary(
            dynamic_fields,
            autofilled_values,
        )

        return ChatResponse(
            message=(
                f"You're requesting a {service_label}.\n\n"
                "I already have all required information from "
                "your verified student profile.\n\n"
                f"{summary}\n\n"
                "Would you like me to create this request?\n\n"
                "Reply **Yes** to proceed or **No** to cancel."
            ),
            intent=intent,
            confidence=confidence,
        )

    first_missing_field = missing_required_fields[0]

    profile_count = len(autofilled_values)

    profile_note = (
        f"I already have {profile_count} relevant detail"
        + ("." if profile_count == 1 else "s.")
    )

    return ChatResponse(
        message=(
            f"You're requesting a {service_label}.\n\n"
            f"{profile_note} "
            "from your verified student profile. "
            "I only need the remaining information that "
            "isn't already available.\n\n"
            f"{field_prompt(first_missing_field)}"
        ),
        intent=intent,
        confidence=confidence,
    )