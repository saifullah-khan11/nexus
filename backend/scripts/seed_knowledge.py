import json
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.knowledge import KnowledgeArticle


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not configured.")


KB_PATH = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "data"
    / "knowledge_base.json"
)


def main() -> None:
    if not KB_PATH.exists():
        raise FileNotFoundError(
            f"Knowledge base file not found: {KB_PATH}"
        )

    with KB_PATH.open(
        "r",
        encoding="utf-8",
    ) as file:
        knowledge_base = json.load(file)

    entries = knowledge_base.get("entries", [])

    if not isinstance(entries, list):
        raise RuntimeError(
            "knowledge_base.json must contain an 'entries' list."
        )

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )

    SessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )

    db = SessionLocal()

    try:
        created = 0
        updated = 0

        for entry in entries:
            title = str(entry.get("title", "")).strip()
            category = str(
                entry.get("category", "GENERAL")
            ).strip()
            content = str(
                entry.get("content", "")
            ).strip()

            keywords = entry.get("keywords", [])

            if not title or not content:
                continue

            article = (
                db.query(KnowledgeArticle)
                .filter(
                    KnowledgeArticle.title == title,
                    KnowledgeArticle.category == category,
                )
                .first()
            )

            if article is None:
                article = KnowledgeArticle(
                    title=title,
                    category=category,
                    content=content,
                    keywords=keywords,
                    is_active=True,
                )
                db.add(article)
                created += 1
            else:
                article.content = content
                article.keywords = keywords
                article.is_active = True
                updated += 1

        db.commit()

        print(
            f"Knowledge seed complete: "
            f"{created} created, {updated} updated."
        )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    main()