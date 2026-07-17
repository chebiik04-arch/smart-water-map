import { create } from "zustand";
import { persist } from "zustand/middleware";
import { endpoints } from "../services/api";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      async login(email, password) {
        const { data } = await endpoints.login({ email, password });
        set({ user: data?.user || null, token: data?.accessToken || data?.token || null, refreshToken: data?.refreshToken || null });
        return data.user;
      },
      logout() {
        set({ user: null, token: null, refreshToken: null });
      }
    }),
    { name: "smart-water-map-auth" }
  )
);
