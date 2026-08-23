from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.audit import AuditLog
from app.models.request import ServiceRequest
from app.models.user import User
from app.models.service import Service

router = APIRouter(
    prefix="/api/approvals",
    tags=["Approvals"],
)


class ApprovalAction(BaseModel):
    reason: str | None = None

@router.get("/pending")
def get_pending_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"ADMIN", "STAFF"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff can view approval requests",
        )

    requests = (
        db.query(ServiceRequest)
        .filter(ServiceRequest.status == "APPROVAL_REQUIRED")
        .order_by(ServiceRequest.created_at.desc())
        .all()
    )

    results = []

    for service_request in requests:
        service = db.get(Service, service_request.service_id)
        student = db.get(User, service_request.user_id)

        results.append(
            {
                "request_id": service_request.id,
                "student": student.name if student else "Unknown",
                "service": service.name if service else "Unknown",
                "status": service_request.status,
                "priority": service_request.priority,
                "risk_score": service_request.risk_score,
                "user_input": service_request.user_input,
                "created_at": service_request.created_at,
            }
        )

    return results

@router.post("/{request_id}/approve")
def approve_request(
    request_id: UUID,
    action: ApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"ADMIN", "STAFF"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff can approve requests",
        )

    service_request = db.get(ServiceRequest, request_id)

    if not service_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service request not found",
        )

    if service_request.status != "APPROVAL_REQUIRED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request is not waiting for approval",
        )

    previous_status = service_request.status

    service_request.status = "PROCESSING"

    audit = AuditLog(
        request_id=service_request.id,
        actor_user_id=current_user.id,
        action="APPROVED",
        previous_status=previous_status,
        new_status="PROCESSING",
        reason=action.reason,
    )

    db.add(audit)
    db.commit()
    db.refresh(service_request)

    return {
        "message": "Request approved successfully",
        "request_id": service_request.id,
        "status": service_request.status,
    }


@router.post("/{request_id}/reject")
def reject_request(
    request_id: UUID,
    action: ApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"ADMIN", "STAFF"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff can reject requests",
        )

    service_request = db.get(ServiceRequest, request_id)

    if not service_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service request not found",
        )

    if service_request.status != "APPROVAL_REQUIRED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request is not waiting for approval",
        )

    previous_status = service_request.status

    service_request.status = "REJECTED"

    audit = AuditLog(
        request_id=service_request.id,
        actor_user_id=current_user.id,
        action="REJECTED",
        previous_status=previous_status,
        new_status="REJECTED",
        reason=action.reason,
    )

    db.add(audit)
    db.commit()
    db.refresh(service_request)

    return {
        "message": "Request rejected",
        "request_id": service_request.id,
        "status": service_request.status,
    }