from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas
from ..utils import get_current_user_id
from ..ws_manager import manager

router = APIRouter(tags=["notifications"])


# ─── WebSocket endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    """
    Connect with: ws://localhost:8004/ws/{user_id}
    The client must pass the JWT as a query param: ?token=<jwt>
    Or the frontend can authenticate separately and then open the socket.
    """
    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep the connection alive; client can send pings
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)


# ─── REST endpoints ───────────────────────────────────────────────────────────

@router.post("/notifications", response_model=schemas.NotificationOut, status_code=201)
async def create_notification(
    payload: schemas.NotificationCreate,
    db: Session = Depends(get_db),
):
    """
    Internal endpoint called by other services (post-service, auth-service) to
    create a notification and push it to the target user via WebSocket.
    """
    notif = models.Notification(**payload.model_dump())
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Real-time push
    await manager.send_to_user(
        notif.user_id,
        {
            "id": notif.id,
            "type": notif.type,
            "message": notif.message,
            "actor_id": notif.actor_id,
            "reference_id": notif.reference_id,
            "is_read": notif.is_read,
            "created_at": notif.created_at.isoformat(),
        },
    )
    return notif


@router.get("/notifications", response_model=List[schemas.NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user_id)
        .order_by(models.Notification.created_at.desc())
        .limit(50)
        .all()
    )


@router.patch("/notifications/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    notif = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == user_id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.patch("/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}
