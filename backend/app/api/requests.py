import json

from app.core.documents import generate_bonafide_certificate
from app.core.document_storage import (
    create_signed_document_url,
    upload_generated_pdf,
)
from app.models.document import GeneratedDocument
from app.models.user import StudentProfile
from app.core.dynamic_certificate_service import (
    generate_dynamic_certificate,
)

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.notifications import (
    create_request_notification,
    create_staff_notifications,
)
from app.models.request import ServiceRequest
from app.models.service import Service
from app.models.service_catalog import ServiceDomain
from app.models.user import User
from app.models.audit import AuditLog


router = APIRouter(
    prefix="/api/requests",
    tags=["Requests"],
)


def require_staff(current_user: User):
    """Allow only STAFF and ADMIN users to perform staff actions."""
    if current_user.role not in {"ADMIN", "STAFF"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or admin access required.",
        )


# =========================================================
# REQUEST SCHEMA
# =========================================================

class CreateRequest(BaseModel):
    service_id: UUID
    user_input: str = Field(
        min_length=1,
        max_length=5000,
    )
    priority: str = Field(
        default="NORMAL",
        max_length=20,
    )


# =========================================================
# CREATE REQUEST
# =========================================================

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_request(
    request_data: CreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # Find service
    # -----------------------------------------------------

    service = (
        db.query(Service)
        .filter(
            Service.id == request_data.service_id,
            Service.is_active.is_(True),
        )
        .first()
    )

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found or inactive.",
        )

    # -----------------------------------------------------
    # Validate priority
    # -----------------------------------------------------

    allowed_priorities = {
        "LOW",
        "NORMAL",
        "HIGH",
        "URGENT",
    }

    priority = request_data.priority.upper()

    if priority not in allowed_priorities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid priority. "
                "Allowed values: LOW, NORMAL, HIGH, URGENT."
            ),
        )

    # -----------------------------------------------------
    # Determine initial status
    # -----------------------------------------------------

    if service.requires_approval:
        initial_status = "APPROVAL_REQUIRED"
    else:
        initial_status = "PENDING"

    # -----------------------------------------------------
    # Create service request
    # -----------------------------------------------------

    new_request = ServiceRequest(
        user_id=current_user.id,
        service_id=service.id,
        status=initial_status,
        priority=priority,
        user_input=request_data.user_input.strip(),
        ai_confidence=None,
        risk_score=None,
    )

    db.add(new_request)
    db.flush()

    # -----------------------------------------------------
    # Create audit log
    # -----------------------------------------------------

    audit_log = AuditLog(
        request_id=new_request.id,
        actor_user_id=current_user.id,
        action="REQUEST_CREATED",
        previous_status=None,
        new_status=new_request.status,
        reason="Service request created by user.",
    )

    db.add(audit_log)

    create_request_notification(
        db=db,
        request=new_request,
        notification_type=(
            "APPROVAL_REQUIRED"
            if new_request.status == "APPROVAL_REQUIRED"
            else "REQUEST_CREATED"
        ),
        title=(
            "Approval required"
            if new_request.status == "APPROVAL_REQUIRED"
            else "Request submitted"
        ),
        message=(
            "Your request is waiting for university approval."
            if new_request.status == "APPROVAL_REQUIRED"
            else "Your service request has been submitted successfully."
        ),
    )

    create_staff_notifications(
        db=db,
        request=new_request,
        notification_type=(
            "APPROVAL_REQUIRED"
            if new_request.status == "APPROVAL_REQUIRED"
            else "NEW_REQUEST"
        ),
        title=(
            "Approval required"
            if new_request.status == "APPROVAL_REQUIRED"
            else "New service request"
        ),
        message=(
            "A student request is waiting for your approval."
            if new_request.status == "APPROVAL_REQUIRED"
            else "A new student service request has been submitted."
        ),
    )

    # -----------------------------------------------------
    # Commit
    # -----------------------------------------------------

    db.commit()

    db.refresh(new_request)

    return {
        "id": str(new_request.id),
        "service_id": str(service.id),
        "service_name": service.name,
        "status": new_request.status,
        "priority": new_request.priority,
        "transaction_id": new_request.transaction_id,
        "user_input": new_request.user_input,
        "ai_confidence": new_request.ai_confidence,
        "risk_score": new_request.risk_score,
        "created_at": new_request.created_at,
        "updated_at": new_request.updated_at,
        "message": "Service request created successfully.",
    }

# =========================================================
# APPROVE REQUEST
# =========================================================

@router.post(
    "/{request_id}/approve",
)
def approve_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # Only ADMIN and STAFF can approve requests
    # -----------------------------------------------------

    require_staff(current_user)

    # -----------------------------------------------------
    # Find request
    # -----------------------------------------------------

    request = (
        db.query(ServiceRequest)
        .filter(
            ServiceRequest.id == request_id,
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found.",
        )

    # -----------------------------------------------------
    # Request must require approval
    # -----------------------------------------------------

    if request.status != "APPROVAL_REQUIRED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Request cannot be approved because "
                f"its current status is {request.status}."
            ),
        )

    previous_status = request.status

    # -----------------------------------------------------
    # Approve request
    # -----------------------------------------------------

    request.status = "PENDING"

    # -----------------------------------------------------
    # Create audit log
    # -----------------------------------------------------

    audit_log = AuditLog(
        request_id=request.id,
        actor_user_id=current_user.id,
        action="REQUEST_APPROVED",
        previous_status=previous_status,
        new_status=request.status,
        reason="Request approved by authorized staff.",
    )

    db.add(audit_log)

    create_request_notification(
        db=db,
        request=request,
        notification_type="REQUEST_APPROVED",
        title="Request approved",
        message="Your request has been approved and is ready for processing.",
    )

    create_staff_notifications(
        db=db,
        request=request,
        notification_type="REQUEST_APPROVED",
        title="Request approved",
        message="A request has been approved and is ready for processing.",
    )

    # -----------------------------------------------------
    # Commit
    # -----------------------------------------------------

    db.commit()
    db.refresh(request)

    return {
        "id": str(request.id),
        "status": request.status,
        "previous_status": previous_status,
        "approved_by": str(current_user.id),
        "message": "Request approved successfully.",
    }


# =========================================================
# START REQUEST PROCESSING
# =========================================================

@router.post(
    "/{request_id}/process",
)
def process_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # Find request belonging to current user
    # -----------------------------------------------------

    request = (
        db.query(ServiceRequest)
        .filter(
            ServiceRequest.id == request_id,
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found.",
        )

    require_staff(current_user)

    # -----------------------------------------------------
    # Only PENDING requests can start processing
    # -----------------------------------------------------

    if request.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Request cannot be processed "
                f"because its current status is "
                f"{request.status}."
            ),
        )

    previous_status = request.status

    # -----------------------------------------------------
    # Change status
    # -----------------------------------------------------

    request.status = "PROCESSING"

    # -----------------------------------------------------
    # Create audit log
    # -----------------------------------------------------

    audit_log = AuditLog(
        request_id=request.id,
        actor_user_id=current_user.id,
        action="PROCESSING_STARTED",
        previous_status=previous_status,
        new_status=request.status,
        reason="Request processing started.",
    )

    db.add(audit_log)

    create_request_notification(
        db=db,
        request=request,
        notification_type="PROCESSING_STARTED",
        title="Request is being processed",
        message="Your request is now being processed by university staff.",
    )

    create_staff_notifications(
        db=db,
        request=request,
        notification_type="PROCESSING_STARTED",
        title="Request processing started",
        message="A request has entered the processing workflow.",
    )

    # -----------------------------------------------------
    # Commit
    # -----------------------------------------------------

    db.commit()
    db.refresh(request)

    return {
        "id": str(request.id),
        "status": request.status,
        "previous_status": previous_status,
        "message": "Request processing started successfully.",
    }

# =========================================================
# EVALUATE REQUEST
# =========================================================

@router.post(
    "/{request_id}/evaluate",
)
def evaluate_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # Find request belonging to current user
    # -----------------------------------------------------

    request = (
        db.query(ServiceRequest)
        .filter(
            ServiceRequest.id == request_id,
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found.",
        )

    require_staff(current_user)

    # -----------------------------------------------------
    # Only PROCESSING requests can be evaluated
    # -----------------------------------------------------

    if request.status != "PROCESSING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Request cannot be evaluated "
                f"because its current status is "
                f"{request.status}."
            ),
        )

    # -----------------------------------------------------
    # Get associated service/domain configuration
    # -----------------------------------------------------

    service = (
        db.query(Service)
        .filter(
            Service.id == request.service_id,
        )
        .first()
    )

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service associated with this request was not found.",
        )

    domain = (
        db.query(ServiceDomain)
        .filter(
            ServiceDomain.id == service.domain_id,
        )
        .first()
    )

    certificate_required = bool(
        getattr(domain, "certificate_required", False)
    )

    # -----------------------------------------------------
    # Simple rule-based evaluation
    # -----------------------------------------------------

    user_input = request.user_input.lower()

    ai_confidence = 0.95
    risk_score = 0.05

    # Example high-risk keywords
    high_risk_keywords = {
        "fake",
        "fraud",
        "forged",
        "bypass",
        "hack",
        "illegal",
    }

    if any(
        keyword in user_input
        for keyword in high_risk_keywords
    ):
        ai_confidence = 0.90
        risk_score = 0.90

    # -----------------------------------------------------
    # Store evaluation
    # -----------------------------------------------------

    request.ai_confidence = ai_confidence
    request.risk_score = risk_score

    previous_status = request.status

    # -----------------------------------------------------
    # Determine result
    # -----------------------------------------------------

    if risk_score >= 0.80:
        request.status = "REJECTED"
        action = "REQUEST_REJECTED"
        reason = (
            "Request rejected because the risk score "
            "exceeded the allowed threshold."
        )

    elif certificate_required:
        # Certificate-required requests must NOT be marked COMPLETED
        # during evaluation. The separate /complete endpoint is
        # responsible for rendering the DOCX template, converting it
        # to PDF, storing it, and only then changing the request to
        # COMPLETED. Keeping the request in PROCESSING allows staff
        # to perform that final document-generation step.
        request.status = "PROCESSING"
        action = "REQUEST_EVALUATED"
        reason = (
            "Request evaluation completed successfully with an "
            "acceptable risk score. Certificate generation is ready "
            "for the final completion step."
        )

    else:
        # Preserve the existing behavior for non-certificate services.
        request.status = "COMPLETED"
        action = "REQUEST_COMPLETED"
        reason = (
            "Request successfully evaluated "
            "with an acceptable risk score."
        )

    # -----------------------------------------------------
    # Create audit log
    # -----------------------------------------------------

    audit_log = AuditLog(
        request_id=request.id,
        actor_user_id=current_user.id,
        action=action,
        previous_status=previous_status,
        new_status=request.status,
        reason=reason,
    )

    db.add(audit_log)

    if request.status == "COMPLETED":
        create_request_notification(
            db=db,
            request=request,
            notification_type="REQUEST_COMPLETED",
            title="Request completed",
            message="Your request has been successfully completed.",
        )

        create_staff_notifications(
            db=db,
            request=request,
            notification_type="REQUEST_COMPLETED",
            title="Request completed",
            message="A request has been completed successfully.",
        )

    elif request.status == "REJECTED":
        create_request_notification(
            db=db,
            request=request,
            notification_type="REQUEST_REJECTED",
            title="Request rejected",
            message=reason,
        )

        create_staff_notifications(
            db=db,
            request=request,
            notification_type="REQUEST_REJECTED",
            title="Request rejected",
            message="A request has been rejected.",
        )

    else:
        create_request_notification(
            db=db,
            request=request,
            notification_type="PROCESSING_STARTED",
            title="Evaluation completed",
            message=(
                "Your request passed the evaluation successfully. "
                "The certificate is now ready for final processing."
            ),
        )

        create_staff_notifications(
            db=db,
            request=request,
            notification_type="PROCESSING_STARTED",
            title="Certificate ready for completion",
            message=(
                f"The {service.name.replace('_', ' ').title()} "
                "request passed evaluation and is ready for "
                "certificate generation."
            ),
        )

    # -----------------------------------------------------
    # Commit
    # -----------------------------------------------------

    db.commit()
    db.refresh(request)

    return {
        "id": str(request.id),
        "status": request.status,
        "previous_status": previous_status,
        "ai_confidence": request.ai_confidence,
        "risk_score": request.risk_score,
        "certificate_required": certificate_required,
        "ready_for_completion": (
            certificate_required
            and request.status == "PROCESSING"
        ),
        "message": (
            "Request evaluated successfully. "
            + (
                "The certificate is ready for final processing."
                if certificate_required and request.status == "PROCESSING"
                else ""
            )
        ),
    }



# =========================================================
# COMPLETE REQUEST
# =========================================================



# =========================================================
# REPLACE ONLY complete_request() WITH THIS VERSION
# =========================================================

@router.post(
    "/{request_id}/complete",
)
def complete_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # Find request
    # -----------------------------------------------------

    request = (
        db.query(ServiceRequest)
        .filter(
            ServiceRequest.id == request_id,
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found.",
        )

    require_staff(current_user)

    # -----------------------------------------------------
    # Only PROCESSING requests can be completed
    # -----------------------------------------------------

    if request.status != "PROCESSING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Request cannot be completed "
                f"because its current status is "
                f"{request.status}."
            ),
        )

    # -----------------------------------------------------
    # Get service
    # -----------------------------------------------------

    service = (
        db.query(Service)
        .filter(
            Service.id == request.service_id,
        )
        .first()
    )

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service associated with this request was not found.",
        )

    previous_status = request.status
    generated_document = None

    # -----------------------------------------------------
    # DYNAMIC DOCX CERTIFICATE AUTOMATION
    # -----------------------------------------------------
    #
    # If this service has an active DOCX template, use the
    # existing dynamic certificate service. This makes the
    # workflow reusable for Transfer Certificate and every
    # future certificate-based service.
    #
    # If no DOCX template is configured, preserve the legacy
    # Bonafide Certificate flow below and keep non-certificate
    # services on their existing completion path.
    # -----------------------------------------------------

    try:
        generated_document = generate_dynamic_certificate(
            db=db,
            request=request,
            service=service,
        )

    except RuntimeError as exc:
        error_message = str(exc)

        # The dynamic generator uses this message when the service
        # has no active DOCX template. That is a normal condition
        # for legacy/non-certificate services, so fall back.
        if "No active DOCX certificate template is configured" not in error_message:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "The request could not be completed because "
                    "the certificate could not be generated. "
                    f"Reason: {error_message}"
                ),
            ) from exc

        generated_document = None

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "The request could not be completed because "
                "certificate generation failed. "
                f"Reason: {exc}"
            ),
        ) from exc

    # -----------------------------------------------------
    # LEGACY BONAFIDE CERTIFICATE FALLBACK
    # -----------------------------------------------------
    #
    # Preserve the existing Bonafide generator when a DOCX
    # template has not been configured for that service yet.
    # This allows existing Bonafide functionality to continue
    # working while the new dynamic system is rolled out.
    # -----------------------------------------------------

    if generated_document is None and service.name == "BONAFIDE_CERTIFICATE":
        student = (
            db.query(User)
            .filter(
                User.id == request.user_id,
            )
            .first()
        )

        profile = (
            db.query(StudentProfile)
            .filter(
                StudentProfile.user_id == request.user_id,
            )
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
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "The Bonafide Certificate could not be generated. "
                    f"Reason: {exc}"
                ),
            ) from exc

        storage_path = (
            f"generated-documents/"
            f"{request.user_id}/"
            f"{request.id}/"
            f"bonafide.pdf"
        )

        file_name = (
            f"Bonafide_{profile.student_number}.pdf"
        )

        try:
            upload_generated_pdf(
                storage_path=storage_path,
                pdf_bytes=pdf_bytes,
            )
        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "The Bonafide Certificate was generated, "
                    "but could not be stored securely. "
                    f"Reason: {exc}"
                ),
            ) from exc

        generated_document = (
            db.query(GeneratedDocument)
            .filter(
                GeneratedDocument.request_id == request.id,
            )
            .first()
        )

        metadata = {
            "student_id": str(request.user_id),
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
        }

        if generated_document:
            generated_document.document_type = (
                "BONAFIDE_CERTIFICATE"
            )
            generated_document.title = (
                "Bonafide Certificate"
            )
            generated_document.storage_path = storage_path
            generated_document.mime_type = (
                "application/pdf"
            )
            generated_document.file_name = file_name
            generated_document.generation_version = "v1"
            generated_document.metadata_json = json.dumps(
                metadata,
                ensure_ascii=False,
            )
        else:
            generated_document = GeneratedDocument(
                request_id=request.id,
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

            db.add(generated_document)

        db.flush()

    # -----------------------------------------------------
    # Change status only after document generation/storage
    # succeeds, or after normal processing for non-certificate
    # services.
    # -----------------------------------------------------

    request.status = "COMPLETED"

    document_title = (
        generated_document.title
        if generated_document
        else ""
    )

    # -----------------------------------------------------
    # Create audit log
    # -----------------------------------------------------

    audit_log = AuditLog(
        request_id=request.id,
        actor_user_id=current_user.id,
        action="PROCESSING_COMPLETED",
        previous_status=previous_status,
        new_status=request.status,
        reason=(
            "Request processing completed successfully."
            + (
                f" {document_title} generated and securely stored."
                if generated_document
                else ""
            )
        ),
    )

    db.add(audit_log)

    # -----------------------------------------------------
    # Student notification
    # -----------------------------------------------------

    create_request_notification(
        db=db,
        request=request,
        notification_type="REQUEST_COMPLETED",
        title="Request completed",
        message=(
            "Your request has been successfully completed."
            + (
                f" Your {document_title} is now available."
                if generated_document
                else ""
            )
        ),
    )

    # -----------------------------------------------------
    # Staff/Admin notification
    # -----------------------------------------------------

    create_staff_notifications(
        db=db,
        request=request,
        notification_type="REQUEST_COMPLETED",
        title="Request completed",
        message=(
            "A request has been completed successfully."
            + (
                f" {document_title} was generated and stored."
                if generated_document
                else ""
            )
        ),
    )

    # -----------------------------------------------------
    # Commit everything together
    # -----------------------------------------------------

    db.commit()
    db.refresh(request)

    return {
        "id": str(request.id),
        "status": request.status,
        "previous_status": previous_status,
        "document": (
            {
                "id": str(generated_document.id),
                "type": generated_document.document_type,
                "title": generated_document.title,
                "file_name": generated_document.file_name,
            }
            if generated_document
            else None
        ),
        "message": (
            "Request completed successfully."
            + (
                " Certificate generated and securely stored."
                if generated_document
                else ""
            )
        ),
    }


# =========================================================
# REJECT REQUEST
# =========================================================

class RejectRequest(BaseModel):
    reason: str = Field(
        min_length=1,
        max_length=1000,
    )


@router.post(
    "/{request_id}/reject",
)
def reject_request(
    request_id: UUID,
    rejection_data: RejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # Find request belonging to current user
    # -----------------------------------------------------

    request = (
        db.query(ServiceRequest)
        .filter(
            ServiceRequest.id == request_id,
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found.",
        )

    require_staff(current_user)

    # -----------------------------------------------------
    # Only PROCESSING requests can be rejected
    # -----------------------------------------------------

    if request.status != "PROCESSING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Request cannot be rejected "
                f"because its current status is "
                f"{request.status}."
            ),
        )

    previous_status = request.status

    # -----------------------------------------------------
    # Change status
    # -----------------------------------------------------

    request.status = "REJECTED"

    # -----------------------------------------------------
    # Create audit log
    # -----------------------------------------------------

    audit_log = AuditLog(
        request_id=request.id,
        actor_user_id=current_user.id,
        action="PROCESSING_REJECTED",
        previous_status=previous_status,
        new_status=request.status,
        reason=rejection_data.reason.strip(),
    )

    db.add(audit_log)

    create_request_notification(
        db=db,
        request=request,
        notification_type="REQUEST_REJECTED",
        title="Request rejected",
        message=rejection_data.reason.strip(),
    )

    create_staff_notifications(
        db=db,
        request=request,
        notification_type="REQUEST_REJECTED",
        title="Request rejected",
        message="A request has been rejected.",
    )

    # -----------------------------------------------------
    # Commit
    # -----------------------------------------------------

    db.commit()
    db.refresh(request)

    return {
        "id": str(request.id),
        "status": request.status,
        "previous_status": previous_status,
        "reason": rejection_data.reason.strip(),
        "message": "Request rejected successfully.",
    }


# =========================================================
# GET STAFF REQUEST QUEUE
# =========================================================

@router.get("/staff/all")
def get_staff_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # Only ADMIN and STAFF can view the staff queue
    # -----------------------------------------------------

    require_staff(current_user)

    requests = (
        db.query(ServiceRequest, Service, User)
        .join(
            Service,
            ServiceRequest.service_id == Service.id,
        )
        .join(
            User,
            ServiceRequest.user_id == User.id,
        )
        .order_by(
            ServiceRequest.created_at.desc()
        )
        .all()
    )

    return [
        {
            "id": str(request.id),
            "user_id": str(request.user_id),
            "student_name": user.name,
            "student_email": user.email,
            "service_id": str(request.service_id),
            "service_name": service.name,
            "status": request.status,
            "priority": request.priority,
            "user_input": request.user_input,
            "transaction_id": request.transaction_id,
            "ai_confidence": request.ai_confidence,
            "risk_score": request.risk_score,
            "created_at": request.created_at,
            "updated_at": request.updated_at,
        }
        for request, service, user in requests
    ]


# =========================================================
# GET MY REQUESTS
# =========================================================

@router.get("")
def get_my_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    requests = (
        db.query(ServiceRequest, Service)
        .join(
            Service,
            ServiceRequest.service_id == Service.id,
        )
        .filter(
            ServiceRequest.user_id == current_user.id
        )
        .order_by(
            ServiceRequest.created_at.desc()
        )
        .all()
    )

    return [
        {
            "id": str(request.id),
            "service_name": service.name,
            "status": request.status,
            "priority": request.priority,
            "created_at": request.created_at,
        }
        for request, service in requests
    ]


# =========================================================
# GET SINGLE REQUEST
# =========================================================

@router.get("/{request_id}")
def get_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = (
        db.query(ServiceRequest, Service, ServiceDomain)
        .join(
            Service,
            ServiceRequest.service_id == Service.id,
        )
        .join(
            ServiceDomain,
            Service.domain_id == ServiceDomain.id,
        )
        .filter(
            ServiceRequest.id == request_id,
        )
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found.",
        )

    request, service, domain = result

    if (
        current_user.role not in {"ADMIN", "STAFF"}
        and request.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this request.",
        )

    certificate_required = bool(
        getattr(domain, "certificate_required", False)
    )

    ready_for_completion = bool(
        certificate_required
        and request.status == "PROCESSING"
        and request.risk_score is not None
        and request.risk_score < 0.80
    )

    generated_document = (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.request_id == request.id,
        )
        .order_by(
            GeneratedDocument.updated_at.desc(),
        )
        .first()
    )

    document_payload = None

    if generated_document and generated_document.storage_path:
        try:
            signed_url = create_signed_document_url(
                storage_path=generated_document.storage_path,
                expires_in=900,
            )
            document_payload = {
                "id": str(generated_document.id),
                "type": generated_document.document_type,
                "title": generated_document.title,
                "file_name": generated_document.file_name,
                "mime_type": generated_document.mime_type,
                "download_url": signed_url,
                "view_url": signed_url,
            }
        except RuntimeError:
            # Keep request details available even when a fresh
            # signed URL cannot currently be created.
            document_payload = {
                "id": str(generated_document.id),
                "type": generated_document.document_type,
                "title": generated_document.title,
                "file_name": generated_document.file_name,
                "mime_type": generated_document.mime_type,
                "download_url": None,
                "view_url": None,
            }

    return {
        "id": str(request.id),
        "service_name": service.name,
        "status": request.status,
        "priority": request.priority,
        "user_input": request.user_input,
        "transaction_id": request.transaction_id,
        "ai_confidence": request.ai_confidence,
        "risk_score": request.risk_score,
        "certificate_required": certificate_required,
        "ready_for_completion": ready_for_completion,
        "document": document_payload,
        "created_at": request.created_at,
        "updated_at": request.updated_at,
    }


# =========================================================
# GET REQUEST AUDIT LOGS
# =========================================================

@router.get("/{request_id}/audit-logs")
def get_request_audit_logs(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = (
        db.query(ServiceRequest)
        .filter(
            ServiceRequest.id == request_id,
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found.",
        )

    if (
        current_user.role not in {"ADMIN", "STAFF"}
        and request.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this audit log.",
        )

    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.request_id == request_id
        )
        .order_by(
            AuditLog.created_at.asc()
        )
        .all()
    )

    return [
        {
            "id": str(log.id),
            "action": log.action,
            "previous_status": log.previous_status,
            "new_status": log.new_status,
            "reason": log.reason,
            "created_at": log.created_at,
        }
        for log in logs
    ]