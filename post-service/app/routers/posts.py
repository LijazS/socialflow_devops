import os, shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from .. import models, schemas
from ..utils import get_current_user_id

router = APIRouter(prefix="/posts", tags=["posts"])

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("", response_model=schemas.PostOut, status_code=201)
def create_post(
    payload: schemas.PostCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    post = models.Post(author_id=user_id, content=payload.content, image_url=payload.image_url)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    ext = file.filename.split(".")[-1]
    filename = f"{user_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"image_url": f"/uploads/{filename}"}


@router.get("/{post_id}", response_model=schemas.PostOut)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(post)
    db.commit()
    return {"message": "Post deleted"}


@router.get("/user/{author_id}", response_model=List[schemas.PostOut])
def get_user_posts(author_id: int, db: Session = Depends(get_db)):
    return db.query(models.Post).filter(models.Post.author_id == author_id).order_by(
        models.Post.created_at.desc()
    ).all()


@router.post("/{post_id}/like", response_model=schemas.LikeOut, status_code=201)
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = db.query(models.Like).filter_by(post_id=post_id, user_id=user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already liked")
    like = models.Like(post_id=post_id, user_id=user_id)
    db.add(like)
    db.commit()
    db.refresh(like)
    return like


@router.delete("/{post_id}/like")
def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    like = db.query(models.Like).filter_by(post_id=post_id, user_id=user_id).first()
    if not like:
        raise HTTPException(status_code=404, detail="Like not found")
    db.delete(like)
    db.commit()
    return {"message": "Unliked"}


@router.post("/{post_id}/comments", response_model=schemas.CommentOut, status_code=201)
def add_comment(
    post_id: int,
    payload: schemas.CommentCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    comment = models.Comment(post_id=post_id, author_id=user_id, content=payload.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/{post_id}/comments", response_model=List[schemas.CommentOut])
def get_comments(post_id: int, db: Session = Depends(get_db)):
    return db.query(models.Comment).filter(models.Comment.post_id == post_id).order_by(
        models.Comment.created_at.asc()
    ).all()


@router.get("/{post_id}/likes")
def get_likes(post_id: int, db: Session = Depends(get_db)):
    likes = db.query(models.Like).filter(models.Like.post_id == post_id).all()
    return {"post_id": post_id, "like_count": len(likes)}
