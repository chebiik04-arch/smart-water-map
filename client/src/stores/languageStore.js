import { create } from "zustand";
import { persist } from "zustand/middleware";
import { translations } from "../i18n/translations";

export const useLanguageStore = create(
  persist(
    (set, get) => ({
      language: "en",
      setLanguage: (language) => set({ language }),
      t: (key) => translations[get().language]?.[key] || translations.en[key] || key
    }),
    { name: "smart-water-map-language" }
  )
);

