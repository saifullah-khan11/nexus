import uuid

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User


STAFF_USER_ID = uuid.UUID(
    "00000000-0000-0000-0000-000000000002"
)


def seed_staff():
    db = SessionLocal()

    try:
        existing = db.get(User, STAFF_USER_ID)

        if existing:
            existing.role = "STAFF"
            existing.password_hash = get_password_hash(
                "NexusStaff@123"
            )
            existing.is_active = True

            db.commit()

            print("Staff user updated successfully.")
            return

        staff = User(
            id=STAFF_USER_ID,
            name="NEXUS Staff",
            email="staff@nexus.local",
            password_hash=get_password_hash("NexusStaff@123"),
            role="STAFF",
            is_active=True,
        )

        db.add(staff)
        db.commit()

        print("Staff user created successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_staff()