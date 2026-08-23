import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context


config = context.config
load_dotenv()

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


from app.core.database import Base
from app.models.user import User, StudentProfile
from app.models.service import Service
from app.models.request import ServiceRequest
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.conversation import NexusConversation
from app.models.chat_message import NexusChatMessage
from app.models.knowledge import KnowledgeArticle
from app.models.student_signup import StudentSignupRequest
from app.models.document import GeneratedDocument

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = os.getenv("DATABASE_URL")

    if not url:
        raise RuntimeError("DATABASE_URL is not configured")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    connectable = engine_from_config(
        {"sqlalchemy.url": database_url},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()