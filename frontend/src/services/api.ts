import axios from "axios";
import { useAuth } from "../stores/auth";

export const api = axios.create({ baseURL: "/api/v1", withCredentials: true });

api.interceptors.request.use((cfg) => {
  const t = useAuth.getState().token;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// On 401, try one silent refresh (rotating HttpOnly cookie), then retry.
let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(undefined, async (err) => {
  const orig = err.config;
  if (err.response?.status === 401 && !orig._retry && !orig.url?.includes("/auth/")) {
    orig._retry = true;
    refreshing ??= useAuth.getState().refresh().finally(() => (refreshing = null));
    const t = await refreshing;
    if (t) return api(orig);
  }
  throw err;
});
