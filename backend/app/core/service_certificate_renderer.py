from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.docx_document_generator import render_certificate_docx
from app.core.document_storage import upload_generated_docx
from app.models.service_catalog import CertificateTemplate
from app.models.service import Service


def build_document_context(
    *,
    collected_values: dict[str, Any],
    service: Service,
    request_id: UUID,
) -> dict[str, Any]:
    """
    Build the only values that are allowed into a certificate
    template.

    Student/profile fields are supplied by the workflow.
    System-controlled fields are added by the backend.
    """

    context = dict(collected_values)

    today = date.today()

    context.setdefault(
        "issue_date",
        today,
    )
    context.setdefault(
        "current_date",
        today,
    )
    context.setdefault(
        "certificate_number",
        f"NEXUS-{service.name}-{str(request_id)[:8].upper()}",
    )

    return context


def render_service_certificate(
    *,
    db: Session,
    service: Service,
    request_id: UUID,
    collected_values: dict[str, Any],
) -> tuple[bytes, CertificateTemplate]:
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
            "for this service."
        )

    if not template.storage_path:
        raise RuntimeError(
            "The certificate template has no storage path."
        )

    # Template download is deliberately isolated from generation.
    # Callers should provide the bytes fetched from private storage.
    raise NotImplementedError(
        "Fetch the private DOCX template bytes from Supabase, then "
        "pass them to render_certificate_docx()."
    )