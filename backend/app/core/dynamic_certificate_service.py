from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.document_storage import (
    download_template_docx,
    upload_generated_pdf,
)
from app.core.docx_document_generator import (
    convert_docx_to_pdf,
    render_certificate_docx,
)
from app.models.document import GeneratedDocument
from app.models.request import ServiceRequest
from app.models.service import Service
from app.models.service_catalog import CertificateTemplate
from app.models.user import StudentProfile, User


USER_MAP = {
    "name": "name",
    "student_name": "name",
    "email": "email",
    "phone": "phone",
}

PROFILE_MAP = {
    "registration_number": "student_number",
    "regd_no": "student_number",
    "student_number": "student_number",
    "program": "program",
    "department": "department",
    "year": "year",
    "semester": "semester",
    "academic_session": "academic_session",
    "session": "academic_session",
}


def _read_value(
    obj: object | None,
    attribute: str | None,
) -> Any | None:
    if obj is None or not attribute:
        return None

    value = getattr(obj, attribute, None)

    if isinstance(value, str):
        value = value.strip()

    return value if value not in (None, "") else None


def _stringify(value: Any | None) -> str:
    """
    Convert values into safe document-template strings.

    None/empty values become an empty string.
    Dates/datetimes are rendered in a human-readable format.
    """
    if value is None:
        return ""

    if isinstance(value, datetime):
        return value.strftime("%d %B %Y")

    if isinstance(value, date):
        return value.strftime("%d %B %Y")

    return str(value).strip()


def _extract_explicit_fields(
    request: ServiceRequest,
) -> dict[str, Any]:
    """
    Dynamic chat requests may store structured answers in
    request.user_input as:

        {
            "fields": {
                "field_key": "value"
            }
        }

    Preserve this workflow while safely supporting ordinary text
    requests as well.
    """
    try:
        decoded = json.loads(request.user_input or "")
    except (TypeError, json.JSONDecodeError):
        return {}

    if not isinstance(decoded, dict):
        return {}

    fields = decoded.get("fields")

    if not isinstance(fields, dict):
        return {}

    return {
        str(key): value
        for key, value in fields.items()
        if value not in (None, "")
    }


def _template_placeholder_keys(
    template: CertificateTemplate,
) -> list[str]:
    """
    The upload endpoint stores the validated placeholder snapshot
    in CertificateTemplate.body_template for DOCX templates.

    Keep this helper tolerant of older records that may not contain
    that JSON snapshot.
    """
    raw = template.body_template

    if not raw:
        return []

    try:
        decoded = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return []

    if not isinstance(decoded, dict):
        return []

    placeholders = decoded.get("placeholders")

    if not isinstance(placeholders, list):
        return []

    return [
        str(value).strip()
        for value in placeholders
        if str(value).strip()
    ]


def _validate_required_template_values(
    *,
    template: CertificateTemplate,
    context: dict[str, Any],
) -> None:
    """
    Stop generation when a validated DOCX placeholder has no value.

    This prevents NEXUS from producing a certificate containing
    unresolved Jinja placeholders such as {{reason_for_transfer}}.
    """
    placeholder_keys = _template_placeholder_keys(template)

    if not placeholder_keys:
        return

    missing = sorted(
        {
            key
            for key in placeholder_keys
            if _stringify(context.get(key)).strip() == ""
        }
    )

    if missing:
        raise RuntimeError(
            "The certificate cannot be generated because these "
            "template fields are missing: "
            + ", ".join(missing)
        )


def build_request_document_context(
    *,
    db: Session,
    request: ServiceRequest,
    service: Service,
) -> dict[str, Any]:
    student = (
        db.query(User)
        .filter(User.id == request.user_id)
        .first()
    )

    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.user_id == request.user_id)
        .first()
    )

    context: dict[str, Any] = {}

    # ---------------------------------------------------------
    # Verified user/profile data
    # ---------------------------------------------------------

    for field_key, attribute in USER_MAP.items():
        value = _read_value(student, attribute)

        if value is not None:
            context[field_key] = value

    for field_key, attribute in PROFILE_MAP.items():
        value = _read_value(profile, attribute)

        if value is not None:
            context[field_key] = value

    # ---------------------------------------------------------
    # Request data
    # ---------------------------------------------------------

    raw_user_input = (
        request.user_input.strip()
        if isinstance(request.user_input, str)
        else ""
    )

    context.update(
        {
            "request_id": str(request.id),
            "service_name": service.name,
            "service": service.name.replace("_", " ").title(),
            "priority": _stringify(request.priority),
            "status": _stringify(request.status),
            "transaction_id": _stringify(
                getattr(request, "transaction_id", None)
            ),
            "utr": _stringify(
                getattr(request, "transaction_id", None)
            ),
            "user_input": raw_user_input,
            "request_date": _stringify(
                getattr(request, "created_at", None)
            ),
        }
    )

    # ---------------------------------------------------------
    # Dynamic chat workflow fields
    # ---------------------------------------------------------

    explicit_fields = _extract_explicit_fields(request)

    context.update(explicit_fields)

    # ---------------------------------------------------------
    # Helpful aliases for common service fields
    # ---------------------------------------------------------

    context.setdefault(
        "reason_for_transfer",
        raw_user_input,
    )

    context.setdefault(
        "reason",
        raw_user_input,
    )

    # Prefer explicitly supplied values where available.
    if explicit_fields.get("reason_for_transfer") not in (
        None,
        "",
    ):
        context["reason_for_transfer"] = explicit_fields[
            "reason_for_transfer"
        ]

    if explicit_fields.get("reason") not in (None, ""):
        context["reason"] = explicit_fields["reason"]

    # Keep UTR/transaction aliases synchronized.
    explicit_transaction = explicit_fields.get(
        "transaction_id"
    )

    explicit_utr = explicit_fields.get("utr")

    if explicit_transaction not in (None, ""):
        context["transaction_id"] = explicit_transaction
        context["utr"] = explicit_transaction
    elif explicit_utr not in (None, ""):
        context["transaction_id"] = explicit_utr
        context["utr"] = explicit_utr

    # ---------------------------------------------------------
    # Automatically generated document values
    # ---------------------------------------------------------

    today = date.today().strftime("%d %B %Y")

    context.setdefault("issue_date", today)
    context.setdefault("current_date", today)
    context.setdefault("date", today)

    context.setdefault(
        "certificate_number",
        f"NEXUS-{service.name}-{str(request.id)[:8].upper()}",
    )

    return context


def generate_dynamic_certificate(
    *,
    db: Session,
    request: ServiceRequest,
    service: Service,
) -> GeneratedDocument:
    """
    Generate a PDF from the active DOCX template for a service.

    Flow:
        active DOCX template
            -> private Supabase download
            -> student/profile/request context
            -> placeholder validation
            -> DOCX rendering
            -> LibreOffice PDF conversion
            -> private Supabase upload
            -> GeneratedDocument metadata
    """
    template = (
        db.query(CertificateTemplate)
        .filter(
            CertificateTemplate.service_id == service.id,
            CertificateTemplate.is_active.is_(True),
            CertificateTemplate.template_type == "DOCX",
        )
        .first()
    )

    if not template:
        raise RuntimeError(
            "No active DOCX certificate template is configured "
            f"for {service.name}."
        )

    if not template.storage_path:
        raise RuntimeError(
            "The active certificate template has no storage path."
        )

    template_bytes = download_template_docx(
        storage_path=template.storage_path,
    )

    if not template_bytes:
        raise RuntimeError(
            "The certificate template could not be downloaded "
            "or was empty."
        )

    context = build_request_document_context(
        db=db,
        request=request,
        service=service,
    )

    # Validate against the exact placeholder snapshot captured
    # when the DOCX template was uploaded.
    _validate_required_template_values(
        template=template,
        context=context,
    )

    try:
        rendered_docx = render_certificate_docx(
            template_bytes=template_bytes,
            values=context,
        )
    except Exception as exc:
        raise RuntimeError(
            "The DOCX certificate could not be rendered: "
            f"{exc}"
        ) from exc

    if not rendered_docx:
        raise RuntimeError(
            "DOCX rendering returned an empty document."
        )

    try:
        pdf_bytes = convert_docx_to_pdf(
            docx_bytes=rendered_docx,
        )
    except Exception as exc:
        raise RuntimeError(
            "The rendered DOCX could not be converted to PDF: "
            f"{exc}"
        ) from exc

    if not pdf_bytes:
        raise RuntimeError(
            "PDF conversion returned an empty document."
        )

    storage_path = (
        f"{request.user_id}/"
        f"{request.id}/"
        f"{service.name.lower()}.pdf"
    )

    file_name = (
        f"{service.name.replace('_', ' ').title().replace(' ', '_')}_"
        f"{str(request.id)[:8]}.pdf"
    )

    try:
        upload_generated_pdf(
            storage_path=storage_path,
            pdf_bytes=pdf_bytes,
        )
    except Exception as exc:
        raise RuntimeError(
            "The certificate PDF was generated, but could not "
            "be stored securely: "
            f"{exc}"
        ) from exc

    generated = (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.request_id == request.id,
        )
        .first()
    )

    metadata = {
        "service_id": str(service.id),
        "template_id": str(template.id),
        "template_version": template.version,
        "template_file": template.original_file_name,
        "field_values": context,
    }

    if generated:
        generated.document_type = service.name
        generated.title = service.name.replace(
            "_",
            " ",
        ).title()
        generated.storage_path = storage_path
        generated.mime_type = "application/pdf"
        generated.file_name = file_name
        generated.generation_version = template.version
        generated.metadata_json = json.dumps(
            metadata,
            ensure_ascii=False,
            default=str,
        )
    else:
        generated = GeneratedDocument(
            request_id=request.id,
            document_type=service.name,
            title=service.name.replace(
                "_",
                " ",
            ).title(),
            storage_path=storage_path,
            mime_type="application/pdf",
            file_name=file_name,
            generation_version=template.version,
            metadata_json=json.dumps(
                metadata,
                ensure_ascii=False,
                default=str,
            ),
        )
        db.add(generated)

    db.flush()

    return generated