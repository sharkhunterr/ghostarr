import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language, Theme } from "@/types";

interface PreferencesState {
  theme: Theme;
  language: Language;
  timezone: string;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setTimezone: (timezone: string) => void;
  getEffectiveTheme: () => "light" | "dark";
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      theme: "system",
      language: "fr",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      setLanguage: (language) => {
        set({ language });
      },

      setTimezone: (timezone) => {
        set({ timezone });
      },

      getEffectiveTheme: () => {
        const { theme } = get();
        if (theme === "system") {
          return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
        }
        return theme;
      },
    }),
    {
      name: "ghostarr-preferences",
      onRehydrateStorage: () => (state) => {
        // Apply theme on rehydration
        if (state) {
          applyTheme(state.theme);
        }
      },
    }
  )
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const effectiveTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  root.classList.remove("light", "dark");
  root.classList.add(effectiveTheme);
}

// Listen for system theme changes
if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const { theme } = usePreferencesStore.getState();
      if (theme === "system") {
        applyTheme("system");
      }
    });
}
