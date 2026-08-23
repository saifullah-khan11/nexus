import uuid

from app.core.database import SessionLocal
from app.models.user import User, StudentProfile
from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()

DEMO_USER_ID = uuid.UUID(
    "00000000-0000-0000-0000-000000000001"
)


def seed_user():
    db = SessionLocal()

    try:
        existing = db.get(User, DEMO_USER_ID)

        if existing:
            existing.password_hash = password_hash.hash("NexusDemo@123")
            db.commit()
            print("Development user password updated successfully.")
            return

        user = User(
            id=DEMO_USER_ID,
            name="Demo Student",
            email="demo@nexus.local",
            password_hash=password_hash.hash("NexusDemo@123"),
            role="STUDENT",
            is_active=True,
        )

        profile = StudentProfile(
            user_id=DEMO_USER_ID,
            student_number="NEXUS-DEMO-001",
            program="Computer Science",
            department="Computer Science",
            year=2,
            semester=4,
            enrollment_status="ACTIVE",
        )

        db.add(user)
        db.add(profile)
        db.commit()

        print("Development user created successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_user()