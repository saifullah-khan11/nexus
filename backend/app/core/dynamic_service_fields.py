from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.service_catalog import ServiceFieldDefinition


SUPPORTED_FIELD_TYPES = {
    "TEXT",
    "TEXTAREA",
    "DATE",
    "NUMBER",
    "SELECT",
    "EMAIL",
}


def get_active_service_fields(
    db: Session,
    service_id,
) -> list[ServiceFieldDefinition]:
    return (
        db.query(ServiceFieldDefinition)
        .filter(
            ServiceFieldDefinition.service_id == service_id,
            ServiceFieldDefinition.is_active.is_(True),
        )
        .order_by(
            ServiceFieldDefinition.sort_order.asc(),
            ServiceFieldDefinition.id.asc(),
        )
        .all()
    )


def normalize_field_type(value: str | None) -> str:
    normalized = (value or "TEXT").strip().upper()
    return normalized if normalized in SUPPORTED_FIELD_TYPES else "TEXT"


def validate_field_value(
    field: ServiceFieldDefinition,
    raw_value: str,
) -> tuple[bool, str, Any | None]:
    value = raw_value.strip()

    if field.is_required and not value:
        return False, f"{field.label} is required.", None

    if not value:
        return True, "", None

    field_type = normalize_field_type(field.field_type)

    if field_type == "EMAIL":
        if "@" not in value or "." not in value.rsplit("@", 1)[-1]:
            return (
                False,
                f"Please enter a valid email address for {field.label}.",
                None,
            )

    elif field_type == "NUMBER":
        try:
            number = float(value)
        except ValueError:
            return False, f"{field.label} must be a number.", None
        return True, "", number

    elif field_type == "DATE":
        parsed = None
        for date_format in (
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%Y/%m/%d",
        ):
            try:
                parsed = datetime.strptime(value, date_format)
                break
            except ValueError:
                continue

        if parsed is None:
            return (
                False,
                f"{field.label} must be a valid date. Use YYYY-MM-DD.",
                None,
            )

        return True, "", parsed.strftime("%Y-%m-%d")

    elif field_type == "SELECT":
        try:
            options = json.loads(field.options_json or "[]")
        except (TypeError, json.JSONDecodeError):
            options = []

        options = [
            str(option).strip()
            for option in options
            if str(option).strip()
        ]

        if options and value not in options:
            return (
                False,
                (
                    f"Please choose one of the available {field.label} "
                    f"options: {', '.join(options)}"
                ),
                None,
            )

    return True, "", value


def field_prompt(field: ServiceFieldDefinition) -> str:
    lines = [f"Please provide your {field.label}."]

    if field.help_text:
        lines.append(field.help_text.strip())

    if field.placeholder:
        lines.append(f"Example: {field.placeholder.strip()}")

    if normalize_field_type(field.field_type) == "SELECT":
        try:
            options = json.loads(field.options_json or "[]")
        except (TypeError, json.JSONDecodeError):
            options = []

        options = [
            str(option).strip()
            for option in options
            if str(option).strip()
        ]

        if options:
            lines.append("Available options: " + ", ".join(options))

    return "\n\n".join(lines)


def build_field_summary(
    fields: list[ServiceFieldDefinition],
    collected: dict[str, Any],
) -> str:
    lines: list[str] = []

    for field in fields:
        if field.field_key not in collected:
            continue

        value = collected[field.field_key]
        display_value = "Not provided" if value in (None, "") else str(value)
        lines.append(f"• {field.label}: {display_value}")

    return "\n".join(lines)


def build_request_payload(
    *,
    original_message: str,
    fields: list[ServiceFieldDefinition],
    collected: dict[str, Any],
) -> str:
    payload = {
        "original_message": original_message,
        "fields": {
            field.field_key: collected.get(field.field_key)
            for field in fields
            if field.field_key in collected
        },
    }

    encoded = json.dumps(payload, ensure_ascii=False)

    if len(encoded) <= 5000:
        return encoded

    compact_payload = {
        "original_message": original_message[:1000],
        "fields": payload["fields"],
    }

    return json.dumps(compact_payload, ensure_ascii=False)[:5000]
