import { create } from "zustand";
import { persist } from "zustand/middleware";
import { endpoints } from "../services/api";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      async login(email, password) {
        const { data } = await endpoints.login({ email, password });
        set({ user: data.user, token: data.token });
        return data.user;
      },
      logout() {
        set({ user: null, token: null });
      }
    }),
    { name: "smart-water-map-auth" }
  )
);

