import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/authApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(() => localStorage.getItem('sf_token'))
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (token) {
            authApi.getMyProfile(token)
                .then(res => setUser(res.data))
                .catch(() => logout())
                .finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [token])

    const login = (accessToken, userData) => {
        localStorage.setItem('sf_token', accessToken)
        setToken(accessToken)
        setUser(userData)
    }

    const logout = () => {
        localStorage.removeItem('sf_token')
        setToken(null)
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
