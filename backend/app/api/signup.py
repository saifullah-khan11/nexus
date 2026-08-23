import os
import uuid
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.student_signup import StudentSignupRequest
from app.models.notification import Notification
from app.models.user import StudentProfile, User


router = APIRouter(
    prefix="/api/signup",
    tags=["Signup"],
)


SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_STORAGE_BUCKET = os.getenv(
    "SUPABASE_STORAGE_BUCKET",
    "student-verification",
)

MAX_PROOF_SIZE = 500 * 1024

ALLOWED_ACADEMIC_SESSIONS = {
    "2022-2026",
    "2023-2027",
    "2024-2028",
    "2026-2030",
}

ALLOWED_YEAR_SEMESTER = {
    (1, 1), (1, 2),
    (2, 3), (2, 4),
    (3, 5), (3, 6),
    (4, 7), (4, 8),
}

ALLOWED_PROOF_TYPES = {
    "image/jpeg",
    "image/png",
    "application/pdf",
}


def upload_proof_to_supabase(
    content: bytes,
    content_type: str,
    original_name: str,
) -> str:
    """
    Upload a private verification document to Supabase Storage.

    Only the generated storage path is stored in PostgreSQL.
    """

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Student document storage is not configured yet. "
                "Please contact the administrator."
            ),
        )

    extension = ""
    if "." in original_name:
        extension = "." + original_name.rsplit(".", 1)[1].lower()

    storage_path = (
        f"student-signups/"
        f"{uuid.uuid4()}{extension}"
    )

    url = (
        f"{SUPABASE_URL}/storage/v1/object/"
        f"{SUPABASE_STORAGE_BUCKET}/{storage_path}"
    )

    req = urllib_request.Request(
        url,
        data=content,
        method="POST",
        headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": content_type,
            "x-upsert": "false",
        },
    )

    try:
        with urllib_request.urlopen(req, timeout=30) as response:
            if response.status not in {200, 201}:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Supabase Storage returned an unexpected status.",
                )

    except HTTPError as exc:
        # Surface the provider error so a missing bucket, invalid key,
        # malformed URL, or other storage configuration issue can be
        # diagnosed immediately from the FastAPI response.
        provider_detail = "Unable to store admission proof."

        try:
            raw_body = exc.read().decode("utf-8", errors="replace")
            if raw_body:
                provider_detail = raw_body[:1000]
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase Storage upload failed: {provider_detail}",
        ) from exc

    except URLError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Unable to reach Supabase Storage. "
                f"{exc.reason}"
            ),
        ) from exc

    return storage_path


@router.post(
    "/student",
    status_code=status.HTTP_201_CREATED,
)
def submit_student_signup(
    name: str = Form(..., min_length=2, max_length=150),
    email: str = Form(..., max_length=255),
    phone: str = Form(..., min_length=7, max_length=30),
    registration_number: str = Form(..., min_length=2, max_length=50),
    program: str = Form(..., min_length=2, max_length=100),
    department: str = Form(..., min_length=2, max_length=100),
    year: int = Form(..., ge=1, le=4),
    semester: int = Form(..., ge=1, le=8),
    academic_session: str = Form(..., min_length=9, max_length=20),
    password: str = Form(..., min_length=8, max_length=128),
    proof: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    """
    Public student registration endpoint.

    Registration creates a PENDING signup request, not a login account.
    Staff/Admin approval is required before a User is created.
    """

    clean_name = name.strip()
    clean_email = email.strip().lower()
    clean_phone = phone.strip()
    clean_registration_number = registration_number.strip().upper()
    clean_program = program.strip()
    clean_department = department.strip()
    clean_academic_session = academic_session.strip()

    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Name is required.",
        )

    if not clean_program:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Program is required.",
        )

    if not clean_department:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Department is required.",
        )

    if clean_academic_session not in ALLOWED_ACADEMIC_SESSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid academic session.",
        )

    if (year, semester) not in ALLOWED_YEAR_SEMESTER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid year/semester selection.",
        )

    existing_user = (
        db.query(User)
        .filter(User.email == clean_email)
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
            == clean_registration_number
        )
        .first()
    )

    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This registration number is already registered.",
        )

    existing_pending = (
        db.query(StudentSignupRequest)
        .filter(
            StudentSignupRequest.email
            == clean_email,
            StudentSignupRequest.status == "PENDING",
        )
        .first()
    )

    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A registration request for this email is already "
                "awaiting verification."
            ),
        )

    existing_pending_registration = (
        db.query(StudentSignupRequest)
        .filter(
            StudentSignupRequest.registration_number
            == clean_registration_number,
            StudentSignupRequest.status == "PENDING",
        )
        .first()
    )

    if existing_pending_registration:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A registration request for this registration number "
                "is already awaiting verification."
            ),
        )

    proof_storage_path = None
    proof_original_name = None
    proof_content_type = None
    proof_size_bytes = None

    if proof is not None:
        content_type = (
            proof.content_type
            or "application/octet-stream"
        )

        if content_type not in ALLOWED_PROOF_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Proof must be a JPG, PNG, or PDF file."
                ),
            )

        content = proof.file.read()

        if len(content) > MAX_PROOF_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Proof file must be 500 KB or smaller.",
            )

        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded proof file is empty.",
            )

        proof_original_name = proof.filename or "proof"
        proof_content_type = content_type
        proof_size_bytes = len(content)

        proof_storage_path = upload_proof_to_supabase(
            content=content,
            content_type=content_type,
            original_name=proof_original_name,
        )

    signup = StudentSignupRequest(
        name=clean_name,
        email=clean_email,
        phone=clean_phone,
        registration_number=clean_registration_number,
        program=clean_program,
        department=clean_department,
        year=year,
        semester=semester,
        academic_session=clean_academic_session,
        password_hash=get_password_hash(password),
        proof_storage_path=proof_storage_path,
        proof_original_name=proof_original_name,
        proof_content_type=proof_content_type,
        proof_size_bytes=proof_size_bytes,
        status="PENDING",
    )

    db.add(signup)
    db.flush()

    # Notify every active STAFF/ADMIN account about the new
    # student registration. The notification points to the signup
    # request rather than a service request.
    reviewers = (
        db.query(User)
        .filter(
            User.role.in_(["STAFF", "ADMIN"]),
            User.is_active.is_(True),
        )
        .all()
    )

    for reviewer in reviewers:
        db.add(
            Notification(
                user_id=reviewer.id,
                signup_request_id=signup.id,
                request_id=None,
                title="New student registration",
                message=(
                    f"{signup.name} submitted a student registration "
                    f"for verification."
                ),
                notification_type="STUDENT_SIGNUP",
                is_read=False,
            )
        )

    db.commit()
    db.refresh(signup)

    return {
        "id": str(signup.id),
        "status": signup.status,
        "message": (
            "Registration submitted successfully. "
            "Your account is waiting for staff verification. "
            "You will be able to log in after approval."
        ),
    }