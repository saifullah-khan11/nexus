from app.core.security import get_password_hash
from app.core.database import SessionLocal
from app.models.user import User


db = SessionLocal()

try:
    email = "admin@nexus.local"

    existing = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing:
        existing.name = "NEXUS Administrator"
        existing.role = "ADMIN"
        existing.is_active = True

        print("Existing account updated to ADMIN.")

    else:
        admin = User(
            name="NEXUS Administrator",
            email=email,
            password_hash=get_password_hash(
                "NexusAdmin@123"
            ),
            role="ADMIN",
            is_active=True,
        )

        db.add(admin)

        print("ADMIN account created.")

    db.commit()

finally:
    db.close()