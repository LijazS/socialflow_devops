from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from datetime import datetime
from .database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)  # recipient
    actor_id = Column(Integer, nullable=True)              # who triggered it
    type = Column(String(50), nullable=False)               # like | comment | follow
    reference_id = Column(Integer, nullable=True)          # post_id or user_id
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
