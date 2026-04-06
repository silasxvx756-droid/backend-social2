// utils/api.ts
import axios, { AxiosInstance } from "axios";
import { useAuth } from "@clerk/clerk-expo";

/* ---------------- BASE URL ---------------- */
// Use seu IP de rede local para testar no dispositivo físico
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.104:3000";

/* ---------------- CRIAR API CLIENT ---------------- */
export const createApiClient = (getToken: () => Promise<string | null>): AxiosInstance => {
  const api = axios.create({ baseURL: API_BASE_URL });

  // Interceptor para adicionar token do Clerk
  api.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return api;
};

/* ---------------- HOOK PARA USAR API ---------------- */
export const useApiClient = (): AxiosInstance => {
  const { getToken } = useAuth();
  return createApiClient(getToken);
};

/* ---------------- USER API ---------------- */
export const userApi = {
  // sincroniza usuário do Clerk com o Mongo
  syncUser: (api: AxiosInstance, data: any) => api.post("/api/users/sync", data),
  getCurrentUser: (api: AxiosInstance) => api.get("/api/users/me"),
  updateProfile: (api: AxiosInstance, data: any) => api.put("/api/users/profile", data),
  searchUsers: (api: AxiosInstance, query: string) =>
    api.get(`/api/users/search?q=${encodeURIComponent(query)}`),
};

/* ---------------- POST API ---------------- */
export const postApi = {
  createPost: (api: AxiosInstance, data: { content: string; image?: string }) =>
    api.post("/posts", data),

  getPosts: (api: AxiosInstance) => api.get("/posts"),

  getUserPosts: (api: AxiosInstance, username: string) =>
    api.get(`/posts/user/${username}`),

  likePost: (api: AxiosInstance, postId: string) =>
    api.post(`/posts/${postId}/like`),

  deletePost: (api: AxiosInstance, postId: string) =>
    api.delete(`/posts/${postId}`),
};

/* ---------------- COMMENT API ---------------- */
export const commentApi = {
  createComment: (api: AxiosInstance, postId: string, content: string) =>
    api.post(`/posts/${postId}/comments`, { text: content }),
  getComments: (api: AxiosInstance, postId: string) =>
    api.get(`/posts/${postId}/comments`),
};

/* ---------------- NOTIFICATIONS API ---------------- */
export const notificationApi = {
  getNotifications: (api: AxiosInstance, userId: string) =>
    api.get(`/api/notifications/${userId}`),
  markRead: (api: AxiosInstance, notifId: string) =>
    api.post(`/api/notifications/${notifId}/read`),
};