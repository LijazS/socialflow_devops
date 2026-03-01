from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_auth_db, get_post_db
from ..models import Follow, Post
from ..utils import get_current_user_id
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/feed", tags=["feed"])


class PostOut(BaseModel):
    id: int
    author_id: int
    content: str
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[PostOut])
def get_feed(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: int = Depends(get_current_user_id),
    auth_db: Session = Depends(get_auth_db),
    post_db: Session = Depends(get_post_db),
):
    """
    Returns a paginated timeline of posts from users the current user follows,
    ordered by newest first.
    """
    # 1. Get list of users the current user follows
    follows = auth_db.query(Follow).filter(Follow.follower_id == user_id).all()
    followee_ids = [f.followee_id for f in follows]

    # Also include the user's own posts in their feed
    followee_ids.append(user_id)

    if not followee_ids:
        return []

    # 2. Fetch posts from those users, paginated
    posts = (
        post_db.query(Post)
        .filter(Post.author_id.in_(followee_ids))
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return posts


@router.get("/user/{target_user_id}", response_model=List[PostOut])
def get_user_feed(
    target_user_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    post_db: Session = Depends(get_post_db),
):
    """Return posts by a specific user (public profile feed), paginated."""
    posts = (
        post_db.query(Post)
        .filter(Post.author_id == target_user_id)
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return posts
