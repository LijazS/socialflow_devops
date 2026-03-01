import axios from 'axios'

const BASE = import.meta.env.VITE_POST_URL || 'http://localhost:8002'

const client = axios.create({ baseURL: BASE })

const authHeader = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

export const postApi = {
    createPost: (data, token) => client.post('/posts', data, authHeader(token)),
    getPost: (id) => client.get(`/posts/${id}`),
    deletePost: (id, token) => client.delete(`/posts/${id}`, authHeader(token)),
    getUserPosts: (userId) => client.get(`/posts/user/${userId}`),
    likePost: (id, token) => client.post(`/posts/${id}/like`, {}, authHeader(token)),
    unlikePost: (id, token) => client.delete(`/posts/${id}/like`, authHeader(token)),
    getLikes: (id) => client.get(`/posts/${id}/likes`),
    addComment: (id, data, token) => client.post(`/posts/${id}/comments`, data, authHeader(token)),
    getComments: (id) => client.get(`/posts/${id}/comments`),
    uploadImage: (formData, token) => client.post('/posts/upload-image', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    }),
}
