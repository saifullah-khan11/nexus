from datetime import datetime, timezone
import os
import urllib.parse
import urllib.request
from urllib.error import HTTPError, URLError
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.student_signup import StudentSignupRequest
from app.models.user import StudentProfile, User


router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
)


# =========================================================
# ADMIN AUTHORIZATION
# =========================================================

def require_admin(current_user: User):
    """
    Allow only ADMIN users to access administrator endpoints.
    """

    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )


def require_staff_or_admin(current_user: User):
    """
    Allow STAFF and ADMIN users to review student signups
    and inspect student information.
    """

    if current_user.role not in {"STAFF", "ADMIN"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or administrator access required.",
        )


# =========================================================
# SUPABASE STORAGE
# =========================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_STORAGE_BUCKET = os.getenv(
    "SUPABASE_STORAGE_BUCKET",
    "student-verification",
)


def create_proof_signed_url(
    storage_path: str,
    expires_in: int = 600,
) -> str:
    """
    Create a short-lived signed URL for a private Supabase Storage file.

    The service-role key stays on the backend and is never returned
    to the browser.
    """

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Student document storage is not configured.",
        )

    encoded_path = urllib.parse.quote(
        storage_path.lstrip("/"),
        safe="/",
    )

    url = (
        f"{SUPABASE_URL}/storage/v1/object/sign/"
        f"{SUPABASE_STORAGE_BUCKET}/{encoded_path}"
    )

    import json

    body = json.dumps(
        {
            "expiresIn": int(expires_in),
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=20,
        ) as response:
            import json

            payload = json.loads(
                response.read().decode("utf-8")
            )

    except HTTPError as exc:
        detail = "Unable to generate proof preview URL."

        try:
            raw = exc.read().decode("utf-8", errors="replace")
            parsed = json.loads(raw)
            detail = (
                parsed.get("message")
                or parsed.get("error")
                or parsed.get("statusCode")
                or detail
            )
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        ) from exc

    except (URLError, TimeoutError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to reach document storage.",
        ) from exc

    signed_url = payload.get("signedURL")

    if not signed_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Storage did not return a signed proof URL.",
        )

    if signed_url.startswith("http://") or signed_url.startswith("https://"):
        return signed_url

    return (
        f"{SUPABASE_URL}/storage/v1"
        f"{signed_url}"
    )


# =========================================================
# STAFF SCHEMAS
# =========================================================

class CreateStaffRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class StaffResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: object


class UpdateStaffStatusRequest(BaseModel):
    is_active: bool


class UpdateStaffProfileRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr


class ResetStaffPasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)


# =========================================================
# STUDENT SIGNUP SCHEMAS
# =========================================================

class StudentSignupReviewResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    registration_number: str
    proof_original_name: str | None
    proof_content_type: str | None
    proof_size_bytes: int | None
    status: str
    review_reason: str | None
    created_at: object
    reviewed_at: object


class ApproveStudentSignupRequest(BaseModel):
    program: str = Field(min_length=2, max_length=100)
    department: str = Field(min_length=2, max_length=100)
    year: int = Field(ge=1, le=10)
    semester: int = Field(ge=1, le=20)


class RejectStudentSignupRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class StudentResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str | None
    role: str
    is_active: bool
    student_number: str
    program: str
    department: str
    year: int
    semester: int
    enrollment_status: str
    created_at: object


# =========================================================
# GET ALL STAFF
# =========================================================

@router.get("/staff")
def get_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    staff_users = (
        db.query(User)
        .filter(User.role == "STAFF")
        .order_by(User.created_at.asc())
        .all()
    )

    return [
        {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at,
        }
        for user in staff_users
    ]


# =========================================================
# CREATE STAFF
# =========================================================

@router.post(
    "/staff",
    status_code=status.HTTP_201_CREATED,
)
def create_staff(
    request: CreateStaffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    email = request.email.strip().lower()

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )

    staff_user = User(
        name=request.name.strip(),
        email=email,
        password_hash=get_password_hash(
            request.password
        ),
        role="STAFF",
        is_active=True,
    )

    db.add(staff_user)
    db.commit()
    db.refresh(staff_user)

    return {
        "id": str(staff_user.id),
        "name": staff_user.name,
        "email": staff_user.email,
        "role": staff_user.role,
        "is_active": staff_user.is_active,
        "created_at": staff_user.created_at,
        "message": "Staff account created successfully.",
    }


# =========================================================
# UPDATE STAFF ACTIVE STATUS
# =========================================================

@router.patch("/staff/{staff_id}")
def update_staff_status(
    staff_id: UUID,
    request: UpdateStaffStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    staff_user = (
        db.query(User)
        .filter(
            User.id == staff_id,
            User.role == "STAFF",
        )
        .first()
    )

    if not staff_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff account not found.",
        )

    staff_user.is_active = request.is_active

    db.commit()
    db.refresh(staff_user)

    return {
        "id": str(staff_user.id),
        "name": staff_user.name,
        "email": staff_user.email,
        "role": staff_user.role,
        "is_active": staff_user.is_active,
        "message": (
            "Staff account activated successfully."
            if staff_user.is_active
            else "Staff account deactivated successfully."
        ),
    }


# =========================================================
# UPDATE STAFF PROFILE
# =========================================================

@router.patch("/staff/{staff_id}/profile")
def update_staff_profile(
    staff_id: UUID,
    request: UpdateStaffProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    staff_user = (
        db.query(User)
        .filter(
            User.id == staff_id,
            User.role == "STAFF",
        )
        .first()
    )

    if not staff_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff account not found.",
        )

    email = request.email.strip().lower()

    existing_user = (
        db.query(User)
        .filter(
            User.email == email,
            User.id != staff_id,
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered to another account.",
        )

    staff_user.name = request.name.strip()
    staff_user.email = email

    db.commit()
    db.refresh(staff_user)

    return {
        "id": str(staff_user.id),
        "name": staff_user.name,
        "email": staff_user.email,
        "role": staff_user.role,
        "is_active": staff_user.is_active,
        "message": "Staff profile updated successfully.",
    }


# =========================================================
# RESET STAFF PASSWORD
# =========================================================

@router.post("/staff/{staff_id}/password")
def reset_staff_password(
    staff_id: UUID,
    request: ResetStaffPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    staff_user = (
        db.query(User)
        .filter(
            User.id == staff_id,
            User.role == "STAFF",
        )
        .first()
    )

    if not staff_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff account not found.",
        )

    staff_user.password_hash = get_password_hash(
        request.password
    )

    db.commit()

    return {
        "id": str(staff_user.id),
        "name": staff_user.name,
        "email": staff_user.email,
        "message": "Staff password reset successfully.",
    }


# =========================================================
# STUDENT SIGNUP REQUESTS
# =========================================================

@router.get("/student-signups")
def get_student_signups(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return student signup applications for staff/admin review.
    """

    require_staff_or_admin(current_user)

    query = db.query(StudentSignupRequest)

    if status_filter:
        normalized = status_filter.strip().upper()

        if normalized not in {
            "PENDING",
            "APPROVED",
            "REJECTED",
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid signup status filter.",
            )

        query = query.filter(
            StudentSignupRequest.status == normalized
        )

    requests = (
        query.order_by(
            StudentSignupRequest.created_at.desc()
        )
        .all()
    )

    return [
        {
            "id": str(item.id),
            "name": item.name,
            "email": item.email,
            "phone": item.phone,
            "registration_number": item.registration_number,
            "proof_original_name": item.proof_original_name,
            "proof_content_type": item.proof_content_type,
            "proof_size_bytes": item.proof_size_bytes,
            "status": item.status,
            "review_reason": item.review_reason,
            "created_at": item.created_at,
            "reviewed_at": item.reviewed_at,
        }
        for item in requests
    ]


@router.get("/student-signups/{signup_id}")
def get_student_signup(
    signup_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return one signup application plus a short-lived private proof URL.
    """

    require_staff_or_admin(current_user)

    signup = (
        db.query(StudentSignupRequest)
        .filter(
            StudentSignupRequest.id == signup_id,
        )
        .first()
    )

    if not signup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student signup request not found.",
        )

    proof_url = None

    if signup.proof_storage_path:
        proof_url = create_proof_signed_url(
            signup.proof_storage_path
        )

    return {
        "id": str(signup.id),
        "name": signup.name,
        "email": signup.email,
        "phone": signup.phone,
        "registration_number": signup.registration_number,
        "program": signup.program,
        "department": signup.department,
        "year": signup.year,
        "semester": signup.semester,
        "academic_session": signup.academic_session,
        "proof_original_name": signup.proof_original_name,
        "proof_content_type": signup.proof_content_type,
        "proof_size_bytes": signup.proof_size_bytes,
        "proof_url": proof_url,
        "status": signup.status,
        "review_reason": signup.review_reason,
        "created_at": signup.created_at,
        "reviewed_at": signup.reviewed_at,
    }


@router.post(
    "/student-signups/{signup_id}/approve",
)
def approve_student_signup(
    signup_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve a PENDING student signup and atomically create:
    1) User
    2) StudentProfile
    3) APPROVED signup status

    The submitted password hash is transferred from the pending
    application to the real student account.
    """

    require_staff_or_admin(current_user)

    signup = (
        db.query(StudentSignupRequest)
        .filter(
            StudentSignupRequest.id == signup_id,
        )
        .first()
    )

    if not signup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student signup request not found.",
        )

    if signup.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Signup cannot be approved because its current "
                f"status is {signup.status}."
            ),
        )

    existing_user = (
        db.query(User)
        .filter(User.email == signup.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    existing_student = (
        db.query(StudentProfile)
        .filter(
            StudentProfile.student_number
            == signup.registration_number
        )
        .first()
    )

    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This registration number is already registered.",
        )

    try:
        student_user = User(
            name=signup.name,
            email=signup.email,
            phone=signup.phone,
            password_hash=signup.password_hash,
            role="STUDENT",
            is_active=True,
        )

        db.add(student_user)
        db.flush()

        if not (
            signup.program
            and signup.department
            and signup.year
            and signup.semester
            and signup.academic_session
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "This signup request is missing academic information "
                    "and cannot be approved."
                ),
            )

        student_profile = StudentProfile(
            user_id=student_user.id,
            student_number=signup.registration_number,
            program=signup.program.strip(),
            department=signup.department.strip(),
            year=signup.year,
            semester=signup.semester,
            academic_session=signup.academic_session,
            enrollment_status="ACTIVE",
        )

        db.add(student_profile)

        signup.status = "APPROVED"
        signup.reviewed_by = current_user.id
        signup.review_reason = (
            "Student registration approved."
        )
        signup.reviewed_at = datetime.now(
            timezone.utc
        )

        db.commit()
        db.refresh(student_user)
        db.refresh(student_profile)
        db.refresh(signup)

    except Exception:
        db.rollback()
        raise

    return {
        "id": str(signup.id),
        "status": signup.status,
        "student_id": str(student_user.id),
        "student_number": student_profile.student_number,
        "message": (
            "Student registration approved successfully. "
            "The student can now log in."
        ),
    }


@router.post(
    "/student-signups/{signup_id}/reject",
)
def reject_student_signup(
    signup_id: UUID,
    request: RejectStudentSignupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reject a PENDING student signup request.
    """

    require_staff_or_admin(current_user)

    signup = (
        db.query(StudentSignupRequest)
        .filter(
            StudentSignupRequest.id == signup_id,
        )
        .first()
    )

    if not signup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student signup request not found.",
        )

    if signup.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Signup cannot be rejected because its current "
                f"status is {signup.status}."
            ),
        )

    signup.status = "REJECTED"
    signup.reviewed_by = current_user.id
    signup.review_reason = request.reason.strip()
    signup.reviewed_at = datetime.now(
        timezone.utc
    )

    db.commit()
    db.refresh(signup)

    return {
        "id": str(signup.id),
        "status": signup.status,
        "message": "Student registration rejected.",
    }


# =========================================================
# STUDENT USER MANAGEMENT
# =========================================================

@router.get("/students")
def get_students(
    search: str | None = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return student accounts and their student profiles.
    """

    require_staff_or_admin(current_user)

    query = (
        db.query(User, StudentProfile)
        .join(
            StudentProfile,
            StudentProfile.user_id == User.id,
        )
        .filter(
            User.role == "STUDENT",
        )
    )

    if active_only:
        query = query.filter(
            User.is_active.is_(True),
        )

    if search and search.strip():
        term = f"%{search.strip()}%"

        from sqlalchemy import or_

        query = query.filter(
            or_(
                User.name.ilike(term),
                User.email.ilike(term),
                User.phone.ilike(term),
                StudentProfile.student_number.ilike(term),
                StudentProfile.program.ilike(term),
                StudentProfile.department.ilike(term),
            )
        )

    rows = (
        query.order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "is_active": user.is_active,
            "student_number": profile.student_number,
            "program": profile.program,
            "department": profile.department,
            "year": profile.year,
            "semester": profile.semester,
            "enrollment_status": profile.enrollment_status,
            "created_at": user.created_at,
        }
        for user, profile in rows
    ]