from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from pydantic import BaseModel, EmailStr, Field

from app.core.database import get_db
from app.core.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.models.user import User, StudentProfile


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    student_number: str = Field(min_length=2, max_length=50)
    program: str = Field(min_length=2, max_length=100)
    department: str = Field(min_length=2, max_length=100)

    year: int = Field(ge=1, le=6)
    semester: int = Field(ge=1, le=12)

class RegisterResponse(BaseModel):
    id: str
    name: str
    email: str
    student_number: str
    message: str

@router.post(
    "/register",
    response_model=RegisterResponse,
)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    existing_email = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    existing_student = (
        db.query(StudentProfile)
        .filter(
            StudentProfile.student_number == request.student_number
        )
        .first()
    )

    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Student number is already registered",
        )
    user = User(
        name=request.name,
        email=request.email,
        password_hash=get_password_hash(request.password),
        role="STUDENT",
        is_active=True,
    )

    db.add(user)
    db.flush()

    profile = StudentProfile(
        user_id=user.id,
        student_number=request.student_number,
        program=request.program,
        department=request.department,
        year=request.year,
        semester=request.semester,
        enrollment_status="ACTIVE",
    )

    db.add(profile)
    db.commit()
    db.refresh(user)

    return RegisterResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        student_number=profile.student_number,
        message="Student registered successfully",
    )

@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == form_data.username)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    if not verify_password(
        form_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role,
        },
        expires_delta=timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
    }
