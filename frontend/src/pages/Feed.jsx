import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { feedApi } from '../services/feedApi'
import { postApi } from '../services/postApi'
import PostCard from '../components/PostCard'
import toast from 'react-hot-toast'
import { FiImage } from 'react-icons/fi'

export default function Feed() {
    const { user, token } = useAuth()
    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(true)
    const [content, setContent] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [authorMap, setAuthorMap] = useState({})

    const loadFeed = useCallback(async (reset = false) => {
        if (!token) return
        const currentOffset = reset ? 0 : offset
        try {
            const res = await feedApi.getFeed(token, currentOffset, 20)
            const newPosts = res.data
            setPosts(prev => reset ? newPosts : [...prev, ...newPosts])
            setOffset(currentOffset + newPosts.length)
            if (newPosts.length < 20) setHasMore(false)
        } catch {
            toast.error('Failed to load feed')
        } finally {
            setLoading(false)
        }
    }, [token, offset])

    useEffect(() => {
        loadFeed(true)
    }, [token])

    const handlePost = async (e) => {
        e.preventDefault()
        if (!content.trim()) return
        setSubmitting(true)
        try {
            const res = await postApi.createPost({ content }, token)
            setPosts(prev => [res.data, ...prev])
            setContent('')
            toast.success('Posted!')
        } catch {
            toast.error('Failed to post')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = (id) => {
        setPosts(prev => prev.filter(p => p.id !== id))
    }

    return (
        <main className="main-content">
            <div className="feed-header">Home</div>

            {token && (
                <div className="composer">
                    <div className="composer-avatar">
                        {user?.username?.slice(0, 2).toUpperCase() || 'ME'}
                    </div>
                    <form className="composer-body" onSubmit={handlePost}>
                        <textarea
                            className="composer-textarea"
                            placeholder="What's happening?"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={3}
                            id="post-composer"
                        />
                        <div className="composer-actions">
                            <button type="submit" className="btn-primary" disabled={submitting || !content.trim()} id="submit-post">
                                {submitting ? 'Posting…' : 'Post'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="spinner-container"><div className="spinner" /></div>
            ) : posts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🌤️</div>
                    <h3>Your feed is empty</h3>
                    <p>Follow some users or create your first post!</p>
                </div>
            ) : (
                <>
                    {posts.map(post => (
                        <PostCard
                            key={post.id}
                            post={post}
                            onDelete={handleDelete}
                            authorName={authorMap[post.author_id] || ''}
                        />
                    ))}
                    {hasMore && (
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                            <button className="btn-outline" onClick={() => loadFeed(false)} id="load-more">
                                Load more
                            </button>
                        </div>
                    )}
                </>
            )}
        </main>
    )
}
