import axios from 'axios'

const BASE = import.meta.env.VITE_NOTIF_URL || 'http://localhost:8004'
const client = axios.create({ baseURL: BASE })

const authHeader = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

export const notificationApi = {
    getAll: (token) => client.get('/notifications', authHeader(token)),
    markRead: (id, token) => client.patch(`/notifications/${id}/read`, {}, authHeader(token)),
    markAllRead: (token) => client.patch('/notifications/read-all', {}, authHeader(token)),
}
