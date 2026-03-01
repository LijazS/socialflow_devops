import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/authApi'
import { feedApi } from '../services/feedApi'
import PostCard from '../components/PostCard'
import toast from 'react-hot-toast'

export default function Profile() {
    const { userId } = useParams()
    const { user, token } = useAuth()
    const navigate = useNavigate()
    const [profile, setProfile] = useState(null)
    const [posts, setPosts] = useState([])
    const [followers, setFollowers] = useState([])
    const [following, setFollowing] = useState([])
    const [isFollowing, setIsFollowing] = useState(false)
    const [loading, setLoading] = useState(true)

    const targetId = parseInt(userId)
    const isOwn = user?.id === targetId

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const [profileRes, postsRes, followersRes, followingRes] = await Promise.all([
                    authApi.getUser(targetId, token),
                    feedApi.getUserFeed(targetId),
                    authApi.getFollowers(targetId),
                    authApi.getFollowing(targetId),
                ])
                setProfile(profileRes.data)
                setPosts(postsRes.data)
                setFollowers(followersRes.data)
                setFollowing(followingRes.data)
                if (user) {
                    setIsFollowing(followersRes.data.some(f => f.id === user.id))
                }
            } catch {
                toast.error('Failed to load profile')
                navigate('/feed')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [targetId, token])

    const handleFollow = async () => {
        if (!token) { navigate('/login'); return }
        try {
            if (isFollowing) {
                await authApi.unfollow(targetId, token)
                setFollowers(prev => prev.filter(f => f.id !== user.id))
                setIsFollowing(false)
                toast.success('Unfollowed')
            } else {
                await authApi.follow(targetId, token)
                setFollowers(prev => [...prev, user])
                setIsFollowing(true)
                toast.success('Following!')
                // Notify the followed user
                fetch(`${import.meta.env.VITE_NOTIF_URL || 'http://localhost:8004'}/notifications`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: targetId,
                        actor_id: user?.id,
                        type: 'follow',
                        reference_id: user?.id,
                        message: `${user?.username || 'Someone'} started following you`,
                    }),
                }).catch(() => { })
            }
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Action failed')
        }
    }

    const handleDelete = (id) => {
        setPosts(prev => prev.filter(p => p.id !== id))
    }

    if (loading) return <div className="spinner-container"><div className="spinner" /></div>
    if (!profile) return null

    const initials = profile.username.slice(0, 2).toUpperCase()

    return (
        <main className="main-content">
            <div className="profile-header">
                <div className="profile-cover" />
                <div className="profile-info" style={{ marginTop: '60px' }}>
                    <div className="profile-avatar">
                        {profile.avatar_url
                            ? <img src={profile.avatar_url} alt={profile.username} />
                            : initials
                        }
                    </div>
                    {!isOwn && (
                        <button
                            className={isFollowing ? 'btn-outline' : 'btn-primary'}
                            onClick={handleFollow}
                            id="follow-btn"
                        >
                            {isFollowing ? 'Unfollow' : 'Follow'}
                        </button>
                    )}
                </div>

                <div style={{ padding: '0 8px' }}>
                    <div className="profile-name">{profile.username}</div>
                    <div className="profile-handle">@{profile.username}</div>
                    {profile.bio && <div className="profile-bio">{profile.bio}</div>}

                    <div className="profile-stats">
                        <div className="profile-stat">
                            <strong>{posts.length}</strong>
                            <span>Posts</span>
                        </div>
                        <div className="profile-stat">
                            <strong>{followers.length}</strong>
                            <span>Followers</span>
                        </div>
                        <div className="profile-stat">
                            <strong>{following.length}</strong>
                            <span>Following</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="feed-header" style={{ position: 'relative', fontSize: '15px' }}>Posts</div>

            {posts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <h3>No posts yet</h3>
                </div>
            ) : (
                posts.map(post => (
                    <PostCard
                        key={post.id}
                        post={post}
                        onDelete={handleDelete}
                        authorName={profile.username}
                    />
                ))
            )}
        </main>
    )
}
