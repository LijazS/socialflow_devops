import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/authApi'
import toast from 'react-hot-toast'

export default function Register() {
    const [form, setForm] = useState({ username: '', email: '', password: '' })
    const [loading, setLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            await authApi.register(form)
            const loginRes = await authApi.login({ email: form.email, password: form.password })
            const token = loginRes.data.access_token
            const profile = await authApi.getMyProfile(token)
            login(token, profile.data)
            toast.success(`Welcome to SocialFlow, ${form.username}!`)
            navigate('/feed')
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">SocialFlow</div>
                <p className="auth-subtitle">Create your account</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            className="form-input"
                            value={form.username}
                            onChange={e => setForm({ ...form, username: e.target.value })}
                            required
                            placeholder="cooluser123"
                            minLength={3}
                        />
                    </div>
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
                            placeholder="At least 8 characters"
                            minLength={8}
                        />
                    </div>
                    <button
                        type="submit"
                        id="register-btn"
                        className="btn-primary btn-full"
                        disabled={loading}
                        style={{ marginTop: '8px' }}
                    >
                        {loading ? 'Creating account…' : 'Create account'}
                    </button>
                </form>

                <p className="auth-link">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    )
}
