import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/authApi'
import toast from 'react-hot-toast'

export default function Login() {
    const [form, setForm] = useState({ email: '', password: '' })
    const [loading, setLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await authApi.login(form)
            const token = res.data.access_token
            const profile = await authApi.getMyProfile(token)
            login(token, profile.data)
            toast.success(`Welcome back, ${profile.data.username}!`)
            navigate('/feed')
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">SocialFlow</div>
                <p className="auth-subtitle">Sign in to your account</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            required
                            placeholder="you@example.com"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            required
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        id="login-btn"
                        className="btn-primary btn-full"
                        disabled={loading}
                        style={{ marginTop: '8px' }}
                    >
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

                <p className="auth-link">
                    Don't have an account? <Link to="/register">Create one</Link>
                </p>
            </div>
        </div>
    )
}
