from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationOut(BaseModel):
    id: int
    user_id: int
    actor_id: Optional[int] = None
    type: str
    reference_id: Optional[int] = None
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    user_id: int
    actor_id: Optional[int] = None
    type: str
    reference_id: Optional[int] = None
    message: str
