from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class Post(Base):
    """Mirror of the post-service posts table (read-only in feed context)."""
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, index=True, nullable=False)
    content = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Follow(Base):
    """Mirror of the auth-service follows table (read-only in feed context)."""
    __tablename__ = "follows"

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, nullable=False)
    followee_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
