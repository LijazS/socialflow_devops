import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Register from './pages/Register'
import Feed from './pages/Feed'
import Profile from './pages/Profile'

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()
    if (loading) return <div className="spinner-container" style={{ height: '100vh' }}><div className="spinner" /></div>
    return user ? children : <Navigate to="/login" replace />
}

function AppLayout({ children }) {
    const { user } = useAuth()
    return (
        <div className="app-layout">
            {user && <Navbar />}
            {children}
            <aside className="right-sidebar" style={{ paddingTop: '24px' }}>
                <div className="sidebar-card">
                    <div className="sidebar-card-title">About SocialFlow</div>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                        A modern social platform powered by microservices. Share your thoughts, follow friends, and get real-time notifications.
                    </p>
                </div>
            </aside>
        </div>
    )
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: 'var(--color-surface)',
                            color: 'var(--color-text)',
                            border: '1px solid var(--color-border)',
                            fontFamily: 'var(--font)',
                        }
                    }}
                />
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route
                        path="/feed"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <Feed />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/profile/:userId"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <Profile />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route path="*" element={<Navigate to="/feed" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}
