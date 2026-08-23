from __future__ import annotations

import json
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.docx_template_validator import validate_docx_template
from app.core.service_template_storage import (
    DOCX_MIME,
    upload_docx_template,
)
from app.models.service import Service
from app.models.service_catalog import (
    CertificateTemplate,
    ServiceFieldDefinition,
)
from app.models.user import User


router = APIRouter(
    prefix="/api/admin/catalog",
    tags=["Service Templates"],
)

MAX_TEMPLATE_SIZE = 10 * 1024 * 1024


def require_catalog_manager(current_user: User):
    if current_user.role not in {"ADMIN", "STAFF"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or admin access required.",
        )


@router.post(
    "/services/{service_id}/template/upload",
    status_code=status.HTTP_201_CREATED,
)
async def upload_certificate_template(
    service_id: UUID,
    template_name: str = Form(...),
    version: str = Form(default="v1"),
    is_active: bool = Form(default=True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_catalog_manager(current_user)

    # ---------------------------------------------------------
    # Find service
    # ---------------------------------------------------------

    service = (
        db.query(Service)
        .filter(Service.id == service_id)
        .first()
    )

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found.",
        )

    # ---------------------------------------------------------
    # Validate uploaded file
    # ---------------------------------------------------------

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select a DOCX template.",
        )

    filename = file.filename.strip()

    if not filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .docx certificate templates are supported.",
        )

    if file.content_type not in {
        DOCX_MIME,
        "application/octet-stream",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file must be a DOCX document.",
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded DOCX file is empty.",
        )

    if len(file_bytes) > MAX_TEMPLATE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Certificate templates must be 10 MB or smaller.",
        )

    # ---------------------------------------------------------
    # Load the service's active field definitions
    # ---------------------------------------------------------

    service_fields = (
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

    # ---------------------------------------------------------
    # Validate DOCX placeholders BEFORE uploading it
    #
    # This prevents a broken template from being stored as an
    # active certificate template.
    # ---------------------------------------------------------

    validation = validate_docx_template(
        file_bytes=file_bytes,
        configured_field_keys=[
            field.field_key
            for field in service_fields
        ],
        required_field_keys=[
            field.field_key
            for field in service_fields
            if field.is_required
        ],
    )

    if not validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": (
                    "The DOCX template contains placeholders "
                    "that do not match the service configuration."
                ),
                "unknown_placeholders": (
                    validation.unknown_placeholders
                ),
                "missing_required_fields": (
                    validation.missing_required_fields
                ),
                "placeholders_found": (
                    validation.placeholders
                ),
                "duplicate_placeholders": (
                    validation.duplicate_placeholders
                ),
            },
        )

    # ---------------------------------------------------------
    # Build private Supabase Storage path
    # ---------------------------------------------------------

    clean_version = version.strip() or "v1"

    storage_path = (
        f"templates/"
        f"{service.id}/"
        f"{clean_version}/"
        f"template.docx"
    )

    # ---------------------------------------------------------
    # Upload validated DOCX to private Supabase Storage
    # ---------------------------------------------------------

    try:
        upload_docx_template(
            storage_path=storage_path,
            file_bytes=file_bytes,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    # ---------------------------------------------------------
    # Find existing template for this service
    # ---------------------------------------------------------

    template = (
        db.query(CertificateTemplate)
        .filter(
            CertificateTemplate.service_id == service_id,
        )
        .first()
    )

    validation_snapshot = {
        "placeholders": validation.placeholders,
        "known_placeholders": validation.known_placeholders,
        "duplicate_placeholders": (
            validation.duplicate_placeholders
        ),
    }

    # ---------------------------------------------------------
    # Update existing template
    # ---------------------------------------------------------

    if template:
        template.template_name = template_name.strip()
        template.version = clean_version
        template.template_type = "DOCX"
        template.storage_path = storage_path
        template.mime_type = DOCX_MIME
        template.original_file_name = filename
        template.is_active = is_active

        # Keep the existing body_template column populated with a
        # machine-readable validation snapshot for compatibility.
        template.body_template = (
            json.dumps(
                validation_snapshot,
                ensure_ascii=False,
            )
        )

        template.updated_by = current_user.id

    # ---------------------------------------------------------
    # Create new template
    # ---------------------------------------------------------

    else:
        template = CertificateTemplate(
            service_id=service_id,
            template_name=template_name.strip(),
            version=clean_version,
            body_template=(
                json.dumps(
                    validation_snapshot,
                    ensure_ascii=False,
                )
            ),
            footer_template=None,
            template_type="DOCX",
            storage_path=storage_path,
            mime_type=DOCX_MIME,
            original_file_name=filename,
            is_active=is_active,
            created_by=current_user.id,
            updated_by=current_user.id,
        )

        db.add(template)

    # ---------------------------------------------------------
    # Commit database record
    # ---------------------------------------------------------

    db.commit()
    db.refresh(template)

    return {
        "id": str(template.id),
        "service_id": str(template.service_id),
        "template_name": template.template_name,
        "version": template.version,
        "template_type": template.template_type,
        "storage_path": template.storage_path,
        "original_file_name": template.original_file_name,
        "is_active": template.is_active,
        "validation": validation_snapshot,
    }