from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..utils import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}", response_model=schemas.UserBase)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/me/profile", response_model=schemas.UserBase)
def get_my_profile(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.patch("/me/profile", response_model=schemas.UserBase)
def update_profile(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.bio is not None:
        current_user.bio = payload.bio
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/{user_id}/follow", status_code=201)
def follow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(models.Follow).filter_by(
        follower_id=current_user.id, followee_id=user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already following")
    follow = models.Follow(follower_id=current_user.id, followee_id=user_id)
    db.add(follow)
    db.commit()
    return {"message": "Followed successfully"}


@router.delete("/{user_id}/follow")
def unfollow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    follow = db.query(models.Follow).filter_by(
        follower_id=current_user.id, followee_id=user_id
    ).first()
    if not follow:
        raise HTTPException(status_code=404, detail="Not following this user")
    db.delete(follow)
    db.commit()
    return {"message": "Unfollowed successfully"}


@router.get("/{user_id}/followers")
def get_followers(user_id: int, db: Session = Depends(get_db)):
    follows = db.query(models.Follow).filter(models.Follow.followee_id == user_id).all()
    follower_ids = [f.follower_id for f in follows]
    users = db.query(models.User).filter(models.User.id.in_(follower_ids)).all()
    return users


@router.get("/{user_id}/following")
def get_following(user_id: int, db: Session = Depends(get_db)):
    follows = db.query(models.Follow).filter(models.Follow.follower_id == user_id).all()
    followee_ids = [f.followee_id for f in follows]
    users = db.query(models.User).filter(models.User.id.in_(followee_ids)).all()
    return users
