import json
import re
from pathlib import Path
from typing import Any


KB_PATH = Path(__file__).resolve().parent.parent / "data" / "knowledge_base.json"

STOP_WORDS = {
    "a", "an", "and", "are", "am", "be", "can", "do", "does", "for",
    "from", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or",
    "the", "to", "what", "when", "where", "which", "with", "would",
    "you", "your", "this", "that", "about", "tell",
}


def load_knowledge_base() -> dict[str, Any]:
    with KB_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def _tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", value.lower())
        if len(token) > 1 and token not in STOP_WORDS
    }


def search_knowledge(query: str, limit: int = 4) -> list[dict[str, Any]]:
    db = load_knowledge_base()
    query_tokens = _tokens(query)
    if not query_tokens:
        return []

    ranked: list[tuple[float, dict[str, Any]]] = []

    for entry in db.get("entries", []):
        title_tokens = _tokens(str(entry.get("title", "")))
        content_tokens = _tokens(str(entry.get("content", "")))
        keywords = [str(item) for item in entry.get("keywords", [])]
        keyword_tokens = _tokens(" ".join(keywords))

        score = (
            len(query_tokens & title_tokens) * 4
            + len(query_tokens & keyword_tokens) * 3
            + len(query_tokens & content_tokens)
        )

        normalized_query = " ".join(query.lower().split())
        for keyword in keywords:
            if keyword.lower() in normalized_query:
                score += 5

        if score > 0:
            ranked.append((float(score), entry))

    ranked.sort(key=lambda item: item[0], reverse=True)

    return [
        {**entry, "score": score}
        for score, entry in ranked[:limit]
    ]


def build_knowledge_context(query: str, limit: int = 4) -> str:
    results = search_knowledge(query, limit)

    if not results:
        return (
            "No matching knowledge-base entry was found. "
            "Do not invent university-specific facts."
        )

    return "\n\n".join(
        [
            "\n".join(
                [
                    f"[Knowledge {index}]",
                    f"Category: {entry.get('category', 'GENERAL')}",
                    f"Title: {entry.get('title', '')}",
                    f"Content: {entry.get('content', '')}",
                ]
            )
            for index, entry in enumerate(results, start=1)
        ]
    )