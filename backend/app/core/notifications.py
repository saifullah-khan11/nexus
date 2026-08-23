from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.request import ServiceRequest
from app.models.user import User


def create_request_notification(
    db: Session,
    request: ServiceRequest,
    notification_type: str,
    title: str,
    message: str,
) -> Notification:
    """Create a notification for the student who owns the request."""
    notification = Notification(
        user_id=request.user_id,
        request_id=request.id,
        title=title,
        message=message,
        notification_type=notification_type,
        is_read=False,
    )

    db.add(notification)
    return notification


def create_staff_notifications(
    db: Session,
    request: ServiceRequest,
    notification_type: str,
    title: str,
    message: str,
) -> None:
    """Create a notification for every active STAFF and ADMIN user."""
    staff_users = (
        db.query(User)
        .filter(
            User.role.in_(["STAFF", "ADMIN"]),
            User.is_active.is_(True),
        )
        .all()
    )

    for staff_user in staff_users:
        db.add(
            Notification(
                user_id=staff_user.id,
                request_id=request.id,
                title=title,
                message=message,
                notification_type=notification_type,
                is_read=False,
            )
        )