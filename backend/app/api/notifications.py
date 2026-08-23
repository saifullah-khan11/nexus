from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.notification import Notification
from app.models.user import User


router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
)


@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    return {
        "notifications": [
            {
                "id": str(item.id),
                "request_id": (
                    str(item.request_id)
                    if item.request_id
                    else None
                ),
                "signup_request_id": (
                    str(item.signup_request_id)
                    if item.signup_request_id
                    else None
                ),
                "title": item.title,
                "message": item.message,
                "notification_type": item.notification_type,
                "is_read": item.is_read,
                "created_at": item.created_at,
            }
            for item in notifications
        ],
        "unread_count": sum(
            1
            for item in notifications
            if not item.is_read
        ),
    }


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    notification.is_read = True
    db.commit()

    return {
        "id": str(notification.id),
        "is_read": True,
        "message": "Notification marked as read.",
    }


@router.patch("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .update(
            {"is_read": True},
            synchronize_session=False,
        )
    )

    db.commit()

    return {
        "message": "All notifications marked as read.",
    }