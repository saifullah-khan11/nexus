import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.document_storage import create_signed_document_url, upload_generated_pdf
from app.core.documents import generate_bonafide_certificate
from app.models.document import GeneratedDocument
from app.models.request import ServiceRequest
from app.models.service import Service
from app.models.user import StudentProfile, User


router = APIRouter(
    prefix="/api/documents",
    tags=["Documents"],
)


def _get_authorized_request(
    request_id: UUID,
    db: Session,
    current_user: User,
) -> ServiceRequest:
    request_row = (
        db.query(ServiceRequest)
        .filter(ServiceRequest.id == request_id)
        .first()
    )

    if not request_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service request not found.",
        )

    if (
        current_user.role not in {"STAFF", "ADMIN"}
        and request_row.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this document.",
        )

    return request_row


def _generate_missing_bonafide_document(
    *,
    request_row: ServiceRequest,
    service: Service,
    db: Session,
) -> GeneratedDocument:
    if service.name != "BONAFIDE_CERTIFICATE":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No generated document is available for this "
                "service request."
            ),
        )

    if request_row.status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A document is not available because this request "
                "has not been completed."
            ),
        )

    # ---------------------------------------------------------
    # Load the verified student profile used for the document.
    # ---------------------------------------------------------

    student = (
        db.query(User)
        .filter(User.id == request_row.user_id)
        .first()
    )

    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.user_id == request_row.user_id)
        .first()
    )

    if not student or not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Verified student profile could not be found. "
                "The Bonafide Certificate cannot be generated."
            ),
        )

    # ---------------------------------------------------------
    # Generate the same NEXUS-owned Bonafide PDF template.
    # ---------------------------------------------------------

    try:
        pdf_bytes = generate_bonafide_certificate(
            student_name=student.name,
            registration_number=profile.student_number,
            program=profile.program,
            department=profile.department,
            year=profile.year,
            semester=profile.semester,
            academic_session=getattr(
                profile,
                "academic_session",
                None,
            ),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "The Bonafide Certificate could not be generated. "
                f"Reason: {exc}"
            ),
        ) from exc

    storage_path = (
        f"generated-documents/"
        f"{request_row.user_id}/"
        f"{request_row.id}/"
        f"bonafide.pdf"
    )

    file_name = (
        f"Bonafide_{profile.student_number}.pdf"
    )

    # ---------------------------------------------------------
    # Upload to private Supabase Storage.
    # ---------------------------------------------------------

    try:
        upload_generated_pdf(
            storage_path=storage_path,
            pdf_bytes=pdf_bytes,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "The Bonafide Certificate was generated, "
                "but could not be stored securely. "
                f"Reason: {exc}"
            ),
        ) from exc

    metadata = {
        "student_id": str(request_row.user_id),
        "registration_number": profile.student_number,
        "program": profile.program,
        "department": profile.department,
        "year": profile.year,
        "semester": profile.semester,
        "academic_session": getattr(
            profile,
            "academic_session",
            None,
        ),
        "backfilled": True,
    }

    document = GeneratedDocument(
        request_id=request_row.id,
        document_type="BONAFIDE_CERTIFICATE",
        title="Bonafide Certificate",
        storage_path=storage_path,
        mime_type="application/pdf",
        file_name=file_name,
        generation_version="v1",
        metadata_json=json.dumps(
            metadata,
            ensure_ascii=False,
        ),
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return document


@router.get("/requests/{request_id}")
def get_generated_document(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request_row = _get_authorized_request(
        request_id=request_id,
        db=db,
        current_user=current_user,
    )

    document = (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.request_id == request_id,
        )
        .first()
    )

    # ---------------------------------------------------------
    # Backward compatibility:
    #
    # Older completed Bonafide requests may have been completed
    # before document automation existed. Generate the missing
    # document transparently on first access.
    # ---------------------------------------------------------

    if not document:
        service = (
            db.query(Service)
            .filter(Service.id == request_row.service_id)
            .first()
        )

        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service associated with this request was not found.",
            )

        document = _generate_missing_bonafide_document(
            request_row=request_row,
            service=service,
            db=db,
        )

    try:
        signed_url = create_signed_document_url(
            storage_path=document.storage_path,
            expires_in=600,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return {
        "id": str(document.id),
        "request_id": str(document.request_id),
        "document_type": document.document_type,
        "title": document.title,
        "file_name": document.file_name,
        "mime_type": document.mime_type,
        "expires_in": 600,
        "url": signed_url,
        "generated_on_demand": False,
    }