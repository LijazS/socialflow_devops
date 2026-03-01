import axios from 'axios'

const BASE = import.meta.env.VITE_AUTH_URL || 'http://localhost:8001'

const client = axios.create({ baseURL: BASE })

export const authApi = {
    register: (data) => client.post('/auth/register', data),
    login: (data) => client.post('/auth/login', data),
    getMyProfile: (token) => client.get('/users/me/profile', {
        headers: { Authorization: `Bearer ${token}` }
    }),
    getUser: (id, token) => client.get(`/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
    }),
    updateProfile: (data, token) => client.patch('/users/me/profile', data, {
        headers: { Authorization: `Bearer ${token}` }
    }),
    follow: (id, token) => client.post(`/users/${id}/follow`, {}, {
        headers: { Authorization: `Bearer ${token}` }
    }),
    unfollow: (id, token) => client.delete(`/users/${id}/follow`, {
        headers: { Authorization: `Bearer ${token}` }
    }),
    getFollowers: (id) => client.get(`/users/${id}/followers`),
    getFollowing: (id) => client.get(`/users/${id}/following`),
}
