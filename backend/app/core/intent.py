INTENT_RULES = {
    "BONAFIDE_CERTIFICATE": [
        "bonafide",
        "bonafide certificate",
    ],
    "FEE_RECEIPT": [
        "fee receipt",
        "fees receipt",
        "payment receipt",
    ],
    "ID_CARD_REPLACEMENT": [
        "replacement id",
        "replace id",
        "new id card",
        "lost id",
        "lost my id",
    ],
    "LEAVE_APPLICATION": [
        "leave application",
        "apply for leave",
        "leave request",
    ],
    "TRANSCRIPT": [
        "transcript",
        "academic transcript",
        "official transcript",
    ],
}


def classify_intent(message: str) -> tuple[str, float]:
    message = message.lower().strip()

    for intent, keywords in INTENT_RULES.items():
        for keyword in keywords:
            if keyword in message:
                return intent, 0.95

    return "UNKNOWN", 0.30