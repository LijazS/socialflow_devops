import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../hooks/useWebSocket'
import { notificationApi } from '../services/notificationApi'
import { FiHome, FiBell, FiUser, FiLogOut, FiEdit2, FiHash } from 'react-icons/fi'
import toast from 'react-hot-toast'

export default function Navbar() {
    const { user, token, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [showNotifs, setShowNotifs] = useState(false)

    useEffect(() => {
        if (!token) return
        notificationApi.getAll(token).then(res => {
            setNotifications(res.data)
            setUnreadCount(res.data.filter(n => !n.is_read).length)
        }).catch(() => { })
    }, [token])

    const handleWsMessage = useCallback((msg) => {
        setNotifications(prev => [msg, ...prev])
        setUnreadCount(c => c + 1)
        toast.custom(() => (
            <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                color: 'var(--color-text)',
                fontSize: '14px',
                boxShadow: 'var(--shadow-glow)',
            }}>
                🔔 {msg.message}
            </div>
        ), { duration: 4000 })
    }, [])

    useWebSocket(user?.id, handleWsMessage)

    const markAllRead = async () => {
        if (!token) return
        await notificationApi.markAllRead(token)
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)
    }

    const isActive = (path) => location.pathname === path

    return (
        <aside className="left-sidebar">
            <div className="sidebar-logo">SocialFlow</div>

            <Link to="/feed" className={`sidebar-nav-item ${isActive('/feed') ? 'active' : ''}`}>
                <FiHome size={20} />
                <span>Home</span>
            </Link>

            <div
                className={`sidebar-nav-item ${showNotifs ? 'active' : ''}`}
                style={{ cursor: 'pointer', position: 'relative' }}
                onClick={() => setShowNotifs(v => !v)}
                id="notif-bell"
            >
                <FiBell size={20} />
                <span>Notifications</span>
                {unreadCount > 0 && (
                    <span className="notif-badge" style={{ marginLeft: 'auto' }}>{unreadCount}</span>
                )}
            </div>

            {showNotifs && (
                <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                }}>
                    <div className="notif-header">
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>Notifications</span>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                                Mark all read
                            </button>
                        )}
                    </div>
                    {notifications.length === 0 ? (
                        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px' }}>
                            No notifications
                        </p>
                    ) : (
                        notifications.slice(0, 10).map(n => (
                            <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
                                <div>{n.message}</div>
                                <div className="notif-time">{new Date(n.created_at).toLocaleString()}</div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {user && (
                <Link
                    to={`/profile/${user.id}`}
                    className={`sidebar-nav-item ${location.pathname.startsWith('/profile') ? 'active' : ''}`}
                >
                    <FiUser size={20} />
                    <span>Profile</span>
                </Link>
            )}

            {user && (
                <div
                    className="sidebar-nav-item"
                    style={{ cursor: 'pointer', marginTop: 'auto' }}
                    onClick={() => { logout(); navigate('/login') }}
                >
                    <FiLogOut size={20} />
                    <span>Logout</span>
                </div>
            )}

            {user && (
                <Link to="/feed" className="sidebar-compose-btn" style={{ textAlign: 'center', display: 'block' }}>
                    <FiEdit2 style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Post
                </Link>
            )}
        </aside>
    )
}
