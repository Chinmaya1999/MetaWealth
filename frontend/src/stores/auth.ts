import { create } from "zustand";
import axios from "axios";

export type Role = "client" | "advisor" | "reviewer" | "admin" | "super_admin";
export interface User { id: string; email: string; name: string; role: Role; mfa?: boolean }
interface State {
  user: User | null; token: string | null; ready: boolean;
  login: (email: string, password: string, code?: string) => Promise<User | "mfa">;
  refresh: () => Promise<string | null>;
  logout: () => Promise<void>;
}
// Access token lives in memory only (never localStorage); the refresh token is an HttpOnly cookie.
export const useAuth = create<State>((set) => ({
  user: null, token: null, ready: false,
  async login(email, password, code) {
    const { data } = await axios.post("/api/v1/auth/login", { email, password, code }, { withCredentials: true });
    if (data.mfaRequired) return "mfa";
    set({ user: data.user, token: data.accessToken, ready: true });
    return data.user;
  },
  async refresh() {
    try {
      const { data } = await axios.post("/api/v1/auth/refresh", null, { withCredentials: true });
      if (!data.accessToken) { set({ user: null, token: null, ready: true }); return null; }
      set({ user: data.user, token: data.accessToken, ready: true });
      return data.accessToken as string;
    } catch { set({ user: null, token: null, ready: true }); return null; }
  },
  async logout() {
    await axios.post("/api/v1/auth/logout", null, { withCredentials: true }).catch(() => {});
    set({ user: null, token: null });
  },
}));

export const portalFor = (r: Role) => (r === "client" ? "/client" : r === "advisor" || r === "reviewer" ? "/advisor" : "/admin");
