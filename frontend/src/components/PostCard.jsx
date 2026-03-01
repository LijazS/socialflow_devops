import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { FiHeart, FiMessageCircle, FiTrash2 } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { postApi } from '../services/postApi'
import { notificationApi } from '../services/notificationApi'
import toast from 'react-hot-toast'

export default function PostCard({ post, onDelete, authorName = '' }) {
    const { user, token } = useAuth()
    const [likes, setLikes] = useState(0)
    const [liked, setLiked] = useState(false)
    const [showComments, setShowComments] = useState(false)
    const [comments, setComments] = useState([])
    const [commentText, setCommentText] = useState('')
    const [loadingComments, setLoadingComments] = useState(false)

    const initials = (authorName || `U${post.author_id}`).slice(0, 2).toUpperCase()

    const handleLike = async () => {
        if (!token) return
        try {
            if (liked) {
                await postApi.unlikePost(post.id, token)
                setLikes(l => l - 1)
                setLiked(false)
            } else {
                await postApi.likePost(post.id, token)
                setLikes(l => l + 1)
                setLiked(true)
                // Notify author of the like (fire-and-forget)
                if (post.author_id !== user?.id) {
                    fetch(`${import.meta.env.VITE_NOTIF_URL || 'http://localhost:8004'}/notifications`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: post.author_id,
                            actor_id: user?.id,
                            type: 'like',
                            reference_id: post.id,
                            message: `${user?.username || 'Someone'} liked your post`,
                        }),
                    }).catch(() => { })
                }
            }
        } catch {
            toast.error('Failed to like post')
        }
    }

    const handleCommentToggle = async () => {
        if (!showComments) {
            setLoadingComments(true)
            try {
                const res = await postApi.getComments(post.id)
                setComments(res.data)
            } catch { }
            setLoadingComments(false)
        }
        setShowComments(v => !v)
    }

    const handleComment = async (e) => {
        e.preventDefault()
        if (!token || !commentText.trim()) return
        try {
            const res = await postApi.addComment(post.id, { content: commentText }, token)
            setComments(prev => [...prev, res.data])
            setCommentText('')
            // Notify author
            if (post.author_id !== user?.id) {
                fetch(`${import.meta.env.VITE_NOTIF_URL || 'http://localhost:8004'}/notifications`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: post.author_id,
                        actor_id: user?.id,
                        type: 'comment',
                        reference_id: post.id,
                        message: `${user?.username || 'Someone'} commented on your post`,
                    }),
                }).catch(() => { })
            }
        } catch {
            toast.error('Failed to post comment')
        }
    }

    const handleDelete = async () => {
        if (!token) return
        if (!window.confirm('Delete this post?')) return
        try {
            await postApi.deletePost(post.id, token)
            onDelete?.(post.id)
            toast.success('Post deleted')
        } catch {
            toast.error('Failed to delete post')
        }
    }

    return (
        <article className="post-card">
            <div className="post-header">
                <Link to={`/profile/${post.author_id}`}>
                    <div className="avatar">{initials}</div>
                </Link>
                <div className="post-meta">
                    <Link to={`/profile/${post.author_id}`}>
                        <div className="post-username">{authorName || `User #${post.author_id}`}</div>
                    </Link>
                    <div className="post-time">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </div>
                </div>
                {user?.id === post.author_id && (
                    <button className="action-btn" onClick={handleDelete} title="Delete post">
                        <FiTrash2 size={16} />
                    </button>
                )}
            </div>

            <div className="post-content">{post.content}</div>

            {post.image_url && (
                <img
                    src={post.image_url.startsWith('/uploads')
                        ? `${import.meta.env.VITE_POST_URL || 'http://localhost:8002'}${post.image_url}`
                        : post.image_url}
                    alt="Post media"
                    className="post-image"
                />
            )}

            <div className="post-actions">
                <button className={`action-btn ${liked ? 'liked' : ''}`} onClick={handleLike} id={`like-btn-${post.id}`}>
                    <FiHeart size={16} fill={liked ? 'currentColor' : 'none'} />
                    <span>{likes}</span>
                </button>
                <button className="action-btn" onClick={handleCommentToggle} id={`comment-btn-${post.id}`}>
                    <FiMessageCircle size={16} />
                    <span>{comments.length}</span>
                </button>
            </div>

            {showComments && (
                <div className="comments-section" style={{ marginTop: '12px' }}>
                    {loadingComments ? (
                        <div className="spinner-container"><div className="spinner" /></div>
                    ) : (
                        comments.map(c => (
                            <div key={c.id} className="comment-item">
                                <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                                    {String(c.author_id).slice(0, 2).toUpperCase()}
                                </div>
                                <div className="comment-body">
                                    <div className="comment-author">User #{c.author_id}</div>
                                    <div className="comment-text">{c.content}</div>
                                    <div className="comment-time">
                                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    {token && (
                        <form onSubmit={handleComment} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <input
                                className="form-input"
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                placeholder="Write a comment…"
                                id={`comment-input-${post.id}`}
                                style={{ flex: 1 }}
                            />
                            <button type="submit" className="btn-primary" disabled={!commentText.trim()}>
                                Send
                            </button>
                        </form>
                    )}
                </div>
            )}
        </article>
    )
}
