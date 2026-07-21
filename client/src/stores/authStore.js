import { create } from "zustand";
import { api, endpoints } from "../services/api";
import { authSessionUpdatedEvent, buildAuthSession, clearAuthSession, readAuthSession, writeAuthSession } from "../utils/authSession";

const initialSession = readAuthSession();

export const useAuthStore = create((set, get) => ({
  ...initialSession,
  async login(email, password, rememberMe = false) {
    const { data } = await endpoints.login({ email, password, rememberMe });
    const session = writeAuthSession(buildAuthSession(data, rememberMe));
    set(session);
    return data.user;
  },
  async logout({ revoke = true } = {}) {
    const refreshToken = get().refreshToken;
    clearAuthSession();
    set(readAuthSession());
    if (revoke && refreshToken) {
      await api.post("/auth/logout", { refreshToken }).catch(() => {});
    }
  }
}));

window.addEventListener(authSessionUpdatedEvent, (event) => {
  useAuthStore.setState(event.detail || readAuthSession());
});
