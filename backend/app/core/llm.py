import os

from dotenv import load_dotenv
from google import genai
from google.genai import types


load_dotenv()


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.1-flash-lite",
)


if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not configured."
    )


client = genai.Client(
    api_key=GEMINI_API_KEY,
)


SYSTEM_INSTRUCTION = """
You are NEXUS, an AI university assistant.

Your job is to understand what a student is asking and respond
helpfully and naturally.

You can:
- Answer general university-related questions.
- Explain university services.
- Help students understand which service they need.
- Help students start a service request.

Important rules:
- Never claim that a request has been created unless the backend
  explicitly creates it.
- Never invent university policies, fees, deadlines, documents,
  or procedures that are not provided to you.
- When the student appears to want a service request, identify
  the likely service clearly.
- Transaction-related services such as Fee Receipt require a
  Transaction ID / UTR number before the backend can create
  the request.
- Be concise, friendly, and conversational.
"""


def ask_nexus(message: str) -> str:
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=message,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
        ),
    )

    if not response.text:
        return (
            "I'm sorry, I couldn't generate a response right now."
        )

    return response.text.strip()

# =========================================================
# STRUCTURED MESSAGE UNDERSTANDING
# =========================================================

ANALYSIS_INSTRUCTION = """
You are the NEXUS understanding layer.

Analyze the student's latest message and return ONLY the
structured fields requested by the response schema.

Classify the message as one of:

GENERAL_QUESTION:
    The student is asking for information or an explanation,
    not asking NEXUS to create a service request.

SERVICE_REQUEST:
    The student is asking to obtain/apply/request a university
    service.

CONFIRMATION:
    The student is confirming a previously proposed action.

CANCELLATION:
    The student wants to cancel a previously proposed action.

CORRECTION:
    The student is correcting information or changing what they
    previously requested.

FOLLOW_UP:
    The student is continuing an existing conversation but the
    message is not itself a clear confirmation, cancellation,
    or new service request.

UNKNOWN:
    The intent cannot be determined reliably.

Supported service intents are:
- BONAFIDE_CERTIFICATE
- FEE_RECEIPT
- ID_CARD_REPLACEMENT
- LEAVE_APPLICATION
- TRANSCRIPT
- UNKNOWN

Rules:
- Do not invent a service intent.
- If the student asks a general question about a service,
  classify it as GENERAL_QUESTION unless they are actually
  asking to obtain that service.
- If the student clearly wants a service but uses different
  wording, infer the matching supported intent when reasonable.
- Do not claim that a request was created.
- Do not invent university-specific facts.
- Use recent conversation context to understand references such as "it", "that", or follow-up questions.
- Treat the latest student message as the message to classify.
- Do not confuse an older message with a new request.
- For GENERAL_QUESTION, make `response` the complete answer that can be shown directly to the student.
- Keep response concise and natural.
"""

ANALYSIS_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "type": {
            "type": "STRING",
            "enum": [
                "GENERAL_QUESTION",
                "SERVICE_REQUEST",
                "CONFIRMATION",
                "CANCELLATION",
                "CORRECTION",
                "FOLLOW_UP",
                "UNKNOWN",
            ],
        },
        "intent": {
            "type": "STRING",
            "enum": [
                "BONAFIDE_CERTIFICATE",
                "FEE_RECEIPT",
                "ID_CARD_REPLACEMENT",
                "LEAVE_APPLICATION",
                "TRANSCRIPT",
                "UNKNOWN",
            ],
        },
        "confidence": {
            "type": "NUMBER",
        },
        "response": {
            "type": "STRING",
        },
    },
    "required": [
        "type",
        "intent",
        "confidence",
        "response",
    ],
}


def analyze_message(
    message: str,
    conversation_history: list[dict[str, str]] | None = None,
    knowledge_context: str | None = None,
) -> dict:
    """
    Use Gemini to understand the student's latest message with
    optional recent conversation context.

    This function does NOT create requests or modify the database.
    """

    history = conversation_history or []
    history_lines: list[str] = []

    for item in history:
        role = str(item.get("role", "USER")).upper()
        content = str(item.get("content", "")).strip()

        if content:
            history_lines.append(f"{role}: {content}")

    if history_lines:
        prompt = (
            "Recent conversation context:\n"
            + "\n".join(history_lines)
            + "\n\nLatest student message:\n"
            + message
        )
    else:
        prompt = "Latest student message:\n" + message

    knowledge = knowledge_context or (
        "No matching NEXUS knowledge-base entry was found. "
        "Do not invent university-specific facts."
    )

    prompt = (
        prompt
        + "\n\nNEXUS KNOWLEDGE BASE:\n"
        + knowledge
        + "\n\nUse the knowledge base for university-specific facts. "
        "If the answer is not supported, say that the information is "
        "not currently configured rather than inventing it."
    )

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=ANALYSIS_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=ANALYSIS_SCHEMA,
        ),
    )

    if not response.text:
        return {
            "type": "UNKNOWN",
            "intent": "UNKNOWN",
            "confidence": 0.0,
            "response": (
                "I'm sorry, I couldn't understand that right now."
            ),
        }

    import json

    try:
        result = json.loads(response.text)
    except json.JSONDecodeError:
        return {
            "type": "UNKNOWN",
            "intent": "UNKNOWN",
            "confidence": 0.0,
            "response": (
                "I'm sorry, I couldn't understand that right now."
            ),
        }

    allowed_types = {
        "GENERAL_QUESTION",
        "SERVICE_REQUEST",
        "CONFIRMATION",
        "CANCELLATION",
        "CORRECTION",
        "FOLLOW_UP",
        "UNKNOWN",
    }

    allowed_intents = {
        "BONAFIDE_CERTIFICATE",
        "FEE_RECEIPT",
        "ID_CARD_REPLACEMENT",
        "LEAVE_APPLICATION",
        "TRANSCRIPT",
        "UNKNOWN",
    }

    result_type = result.get("type")
    result_intent = result.get("intent")

    if result_type not in allowed_types:
        result_type = "UNKNOWN"

    if result_intent not in allowed_intents:
        result_intent = "UNKNOWN"

    try:
        confidence = float(result.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0

    confidence = max(0.0, min(1.0, confidence))

    response_text = str(result.get("response", "")).strip()

    if not response_text:
        response_text = (
            "I'm sorry, I couldn't generate a response right now."
        )

    return {
        "type": result_type,
        "intent": result_intent,
        "confidence": confidence,
        "response": response_text,
    }
