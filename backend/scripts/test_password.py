from app.core.database import SessionLocal
from app.core.security import verify_password
from app.models.user import User


DEMO_EMAIL = "demo@nexus.local"
DEMO_PASSWORD = "NexusDemo@123"


def test_password():
    db = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.email == DEMO_EMAIL)
            .first()
        )

        if not user:
            print("Demo user not found.")
            return

        valid = verify_password(
            DEMO_PASSWORD,
            user.password_hash,
        )

        print(f"Password verification: {valid}")

    finally:
        db.close()


if __name__ == "__main__":
    test_password()