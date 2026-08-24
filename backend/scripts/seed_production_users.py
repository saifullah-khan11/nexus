import os
import uuid

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, StudentProfile


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is not configured")
    return value


ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
STAFF_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def create_or_update_user(
    db,
    *,
    user_id: uuid.UUID,
    name: str,
    email: str,
    password: str,
    role: str,
) -> None:
    user = db.get(User, user_id)

    if user:
        user.name = name
        user.email = email
        user.password_hash = get_password_hash(password)
        user.role = role
        user.is_active = True
        return

    user = User(
        id=user_id,
        name=name,
        email=email,
        password_hash=get_password_hash(password),
        role=role,
        is_active=True,
    )

    db.add(user)


def seed_production_users() -> None:
    admin_email = require_env("NEXUS_ADMIN_EMAIL")
    admin_password = require_env("NEXUS_ADMIN_PASSWORD")

    staff_email = require_env("NEXUS_STAFF_EMAIL")
    staff_password = require_env("NEXUS_STAFF_PASSWORD")

    student_email = require_env("NEXUS_TEST_STUDENT_EMAIL")
    student_password = require_env("NEXUS_TEST_STUDENT_PASSWORD")

    db = SessionLocal()

    try:
        create_or_update_user(
            db,
            user_id=ADMIN_ID,
            name="NEXUS Administrator",
            email=admin_email,
            password=admin_password,
            role="ADMIN",
        )

        create_or_update_user(
            db,
            user_id=STAFF_ID,
            name="NEXUS Staff",
            email=staff_email,
            password=staff_password,
            role="STAFF",
        )

        create_or_update_user(
            db,
            user_id=STUDENT_ID,
            name="NEXUS Test Student",
            email=student_email,
            password=student_password,
            role="STUDENT",
        )

        profile = (
            db.query(StudentProfile)
            .filter(StudentProfile.user_id == STUDENT_ID)
            .first()
        )

        if not profile:
            profile = StudentProfile(
                user_id=STUDENT_ID,
                student_number="NEXUS-PROD-TEST-001",
                program="Computer Science",
                department="Computer Science",
                year=2,
                semester=4,
                enrollment_status="ACTIVE",
            )
            db.add(profile)
        else:
            profile.student_number = "NEXUS-PROD-TEST-001"
            profile.program = "Computer Science"
            profile.department = "Computer Science"
            profile.year = 2
            profile.semester = 4
            profile.enrollment_status = "ACTIVE"

        db.commit()

        print("Production users initialized successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_production_users()