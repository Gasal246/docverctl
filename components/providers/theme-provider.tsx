"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

const THEME_STORAGE_KEY = "docverctl-theme";

export type ThemePreference = "system" | "dark" | "light";
type ResolvedTheme = "dark" | "light";

type ThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (nextPreference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function normalizeThemePreference(raw: string | null): ThemePreference {
  if (raw === "dark" || raw === "light" || raw === "system") {
    return raw;
  }

  return "system";
}

function resolveTheme(preference: ThemePreference, media: MediaQueryList): ResolvedTheme {
  if (preference === "system") {
    return media.matches ? "dark" : "light";
  }

  return preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const storedPreference = normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
    setThemePreferenceState(storedPreference);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const nextResolvedTheme = resolveTheme(themePreference, media);
      setResolvedTheme(nextResolvedTheme);

      const htmlElement = document.documentElement;
      htmlElement.classList.toggle("dark", nextResolvedTheme === "dark");
      htmlElement.style.colorScheme = nextResolvedTheme;
    };

    applyTheme();

    if (themePreference === "system") {
      media.addEventListener("change", applyTheme);
      return () => {
        media.removeEventListener("change", applyTheme);
      };
    }

    return undefined;
  }, [themePreference]);

  const setThemePreference = useCallback((nextPreference: ThemePreference) => {
    setThemePreferenceState(nextPreference);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
  }, []);

  const value = useMemo(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference
    }),
    [resolvedTheme, setThemePreference, themePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within ThemeProvider");
  }

  return context;
}
