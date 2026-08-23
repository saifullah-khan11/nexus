from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.request import ServiceRequest
from app.models.service import Service
from app.models.user import StudentProfile, User

router = APIRouter(
    prefix="/api/student",
    tags=["Student"],
)


def require_student(current_user: User):
    if current_user.role != "STUDENT":
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required.",
        )


@router.get("/profile")
def get_student_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_student(current_user)

    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.user_id == current_user.id)
        .first()
    )

    if not profile:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found.",
        )

    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "student_number": profile.student_number,
        "program": profile.program,
        "department": profile.department,
        "year": profile.year,
        "semester": profile.semester,
        "academic_session": profile.academic_session,
        "enrollment_status": profile.enrollment_status,
        "created_at": current_user.created_at,
    }


@router.get("/requests")
def get_student_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_student(current_user)

    rows = (
        db.query(ServiceRequest, Service)
        .join(
            Service,
            Service.id == ServiceRequest.service_id,
        )
        .filter(
            ServiceRequest.user_id == current_user.id,
        )
        .order_by(
            ServiceRequest.created_at.desc(),
        )
        .all()
    )

    return [
        {
            "id": str(request.id),
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
        for request, service in rows
    ]