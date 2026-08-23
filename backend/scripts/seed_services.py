from app.core.database import SessionLocal
from app.models.service import Service


SERVICES = [
    {
        "name": "BONAFIDE_CERTIFICATE",
        "description": "Generate a bonafide certificate for an enrolled student.",
        "risk_level": "LOW",
        "requires_approval": False,
    },
    {
        "name": "FEE_RECEIPT",
        "description": "Provide the student's university fee receipt.",
        "risk_level": "LOW",
        "requires_approval": False,
    },
    {
        "name": "ID_CARD_REPLACEMENT",
        "description": "Request a replacement university identity card.",
        "risk_level": "MEDIUM",
        "requires_approval": True,
    },
    {
        "name": "LEAVE_APPLICATION",
        "description": "Submit a university leave application.",
        "risk_level": "MEDIUM",
        "requires_approval": True,
    },
    {
        "name": "TRANSCRIPT",
        "description": "Request an official academic transcript.",
        "risk_level": "HIGH",
        "requires_approval": True,
    },
]


def seed_services():
    db = SessionLocal()

    try:
        for data in SERVICES:
            existing = (
                db.query(Service)
                .filter(Service.name == data["name"])
                .first()
            )

            if existing:
                existing.description = data["description"]
                existing.risk_level = data["risk_level"]
                existing.requires_approval = data["requires_approval"]
                existing.is_active = True
                continue

            service = Service(**data)
            db.add(service)

        db.commit()

        print("Service catalog seeded successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_services()