import axios from 'axios'

const BASE = import.meta.env.VITE_FEED_URL || 'http://localhost:8003'
const client = axios.create({ baseURL: BASE })

export const feedApi = {
    getFeed: (token, offset = 0, limit = 20) =>
        client.get('/feed', {
            params: { offset, limit },
            headers: { Authorization: `Bearer ${token}` },
        }),
    getUserFeed: (userId, offset = 0, limit = 20) =>
        client.get(`/feed/user/${userId}`, { params: { offset, limit } }),
}
