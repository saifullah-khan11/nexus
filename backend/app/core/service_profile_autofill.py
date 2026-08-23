from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.user import User, StudentProfile
from app.models.service_catalog import ServiceFieldDefinition


# ---------------------------------------------------------
# Canonical service-field keys and where their values come from.
#
# These are intentionally explicit. NEXUS should never guess
# that a random profile attribute corresponds to a certificate
# field.
# ---------------------------------------------------------

USER_FIELD_MAP = {
    "name": "name",
    "student_name": "name",
    "email": "email",
    "phone": "phone",
    "phone_number": "phone",
}

PROFILE_FIELD_MAP = {
    "registration_number": "student_number",
    "regd_no": "student_number",
    "student_number": "student_number",
    "program": "program",
    "department": "department",
    "year": "year",
    "semester": "semester",
    "year_semester": None,
    "academic_session": "academic_session",
    "session": "academic_session",
}


def _read_attribute(
    obj: object | None,
    attribute_name: str | None,
) -> Any | None:
    if obj is None or not attribute_name:
        return None

    value = getattr(obj, attribute_name, None)

    if value is None:
        return None

    if isinstance(value, str):
        value = value.strip()

    return value if value != "" else None


def build_verified_profile_values(
    *,
    user: User,
    profile: StudentProfile | None,
) -> dict[str, Any]:
    """
    Build ONLY values that are actually present in the verified
    User / StudentProfile records.

    No LLM inference happens here.
    """

    values: dict[str, Any] = {}

    for field_key, model_attribute in USER_FIELD_MAP.items():
        value = _read_attribute(
            user,
            model_attribute,
        )
        if value is not None:
            values[field_key] = value

    for field_key, model_attribute in PROFILE_FIELD_MAP.items():
        if field_key == "year_semester":
            continue

        value = _read_attribute(
            profile,
            model_attribute,
        )
        if value is not None:
            values[field_key] = value

    # A catalog field may be configured as year_semester even though
    # the profile stores year and semester separately.
    year = values.get("year")
    semester = values.get("semester")

    if year is not None and semester is not None:
        values["year_semester"] = (
            f"Year {year} / Semester {semester}"
        )

    return values


def get_service_autofill_values(
    db: Session,
    *,
    user_id,
    fields: list[ServiceFieldDefinition],
) -> dict[str, Any]:
    """
    Return values that can be safely pre-filled from the verified
    student's account/profile.

    Only fields explicitly known to the mapping above are filled.
    """

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        return {}

    profile = (
        db.query(StudentProfile)
        .filter(
            StudentProfile.user_id == user_id
        )
        .first()
    )

    profile_values = build_verified_profile_values(
        user=user,
        profile=profile,
    )

    return {
        field.field_key: profile_values[field.field_key]
        for field in fields
        if field.field_key in profile_values
        and profile_values[field.field_key] is not None
    }


def get_missing_required_fields(
    fields: list[ServiceFieldDefinition],
    autofilled_values: dict[str, Any],
) -> list[ServiceFieldDefinition]:
    """
    Required + active fields that are not already present
    in verified profile data.
    """

    return [
        field
        for field in fields
        if field.is_active
        and field.is_required
        and field.field_key not in autofilled_values
    ]


def merge_profile_and_student_values(
    *,
    autofilled_values: dict[str, Any],
    collected_values: dict[str, Any],
) -> dict[str, Any]:
    """
    Student-provided values override auto-filled profile values
    only when the student explicitly supplies a value.
    """

    merged = dict(autofilled_values)
    merged.update(
        {
            key: value
            for key, value in collected_values.items()
            if value not in (None, "")
        }
    )
    return merged