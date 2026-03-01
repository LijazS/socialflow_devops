from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PostCreate(BaseModel):
    content: str
    image_url: Optional[str] = None


class CommentCreate(BaseModel):
    content: str


class CommentOut(BaseModel):
    id: int
    post_id: int
    author_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class PostOut(BaseModel):
    id: int
    author_id: int
    content: str
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LikeOut(BaseModel):
    id: int
    post_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
