from app.core.database import SessionLocal
from app.models.service import Service


services = [
    {
        "name": "BONAFIDE_CERTIFICATE",
        "description": "Request an official bonafide certificate from the university.",
        "risk_level": "LOW",
        "requires_approval": False,
    },
    {
        "name": "LAB_BOOKING",
        "description": "Request access to a university laboratory.",
        "risk_level": "MEDIUM",
        "requires_approval": True,
    },
    {
        "name": "MAINTENANCE",
        "description": "Report a maintenance issue on campus.",
        "risk_level": "LOW",
        "requires_approval": False,
    },
    {
        "name": "GRIEVANCE",
        "description": "Submit an official university grievance.",
        "risk_level": "HIGH",
        "requires_approval": True,
    },
]


def seed_services():
    db = SessionLocal()

    try:
        for service_data in services:
            existing = (
                db.query(Service)
                .filter(Service.name == service_data["name"])
                .first()
            )

            if not existing:
                db.add(Service(**service_data))

        db.commit()

        print("NEXUS services seeded successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_services()