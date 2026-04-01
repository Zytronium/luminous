"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { createSupabaseClient } from "@/lib/supabase/client";

type User = {
  id: string;
  email: string;
  displayName: string;
};

type Session = {
  access_token: string;
  refresh_token: string;
};

export type UserSettings = {
  theme: "light" | "system" | "dark";
  reduce_animations: boolean;
  notification_preference: "none" | "mentions" | "all";
};

const SETTINGS_DEFAULTS: UserSettings = {
  theme: "dark",
  reduce_animations: false,
  notification_preference: "mentions",
};

const SETTINGS_CACHE_KEY = "luminous_settings";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  token: string | null;
  loading: boolean;
  settings: UserSettings;
  settingsLoading: boolean;
  setAuth: (user: User | null, session: Session | null) => void;
  clearAuth: () => void;
  /** Call this after every successful DB upsert in the settings page. */
  cacheSettings: (s: UserSettings) => void;
};

function applyTheme(theme: UserSettings["theme"]) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

function applyReduceAnimations(reduce: boolean) {
  document.documentElement.classList.toggle("reduce-motion", reduce);
}

function applySettings(s: UserSettings) {
  applyTheme(s.theme);
  applyReduceAnimations(s.reduce_animations);
}

function writeSettingsCache(s: UserSettings) {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s));
  } catch (_) {}
}

function clearSettingsCache() {
  try {
    localStorage.removeItem(SETTINGS_CACHE_KEY);
  } catch (_) {}
}

const AuthContext = createContext<AuthContextType | null>(null);
const supabase = createSupabaseClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                     = useState<User | null>(null);
  const [session, setSession]               = useState<Session | null>(null);
  const [loading, setLoading]               = useState(true);
  const [settings, setSettings]             = useState<UserSettings>(SETTINGS_DEFAULTS);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // ── Fetch + apply + cache settings for a given user ID ───────────────────

  const loadSettings = useCallback(async (userId: string) => {
    setSettingsLoading(true);
    const { data, error } = await supabase
      .from("user_settings")
      .select("theme, reduce_animations, notification_preference")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      const loaded: UserSettings = {
        theme:                   (data.theme as UserSettings["theme"]) ?? SETTINGS_DEFAULTS.theme,
        reduce_animations:       data.reduce_animations ?? SETTINGS_DEFAULTS.reduce_animations,
        notification_preference: data.notification_preference ?? SETTINGS_DEFAULTS.notification_preference,
      };
      setSettings(loaded);
      applySettings(loaded);
      writeSettingsCache(loaded);
    }
    // If no row yet (new user), keep defaults and don't write a stale cache entry
    setSettingsLoading(false);
  }, []);

  // ── Restore session on mount + subscribe to auth state changes ────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const u: User = {
          id:          data.session.user.id,
          email:       data.session.user.email ?? "",
          displayName: data.session.user.user_metadata?.display_name ?? "",
        };
        setSession(data.session);
        setUser(u);
        loadSettings(u.id);
      } else {
        setSettingsLoading(false);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) {
        const u: User = {
          id:          s.user.id,
          email:       s.user.email ?? "",
          displayName: s.user.user_metadata?.display_name ?? "",
        };
        setSession(s);
        setUser(u);
        loadSettings(u.id);
      } else {
        setUser(null);
        setSession(null);
        setSettings(SETTINGS_DEFAULTS);
        setSettingsLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadSettings]);

  function setAuth(user: User | null, session: Session | null) {
    setUser(user);
    setSession(session);
  }

  function clearAuth() {
    setUser(null);
    setSession(null);
    setSettings(SETTINGS_DEFAULTS);
    clearSettingsCache();
    supabase.auth.signOut();
  }

  /**
   * Call this from the settings page after a successful DB upsert.
   * Keeps the localStorage cache in sync without requiring a round-trip.
   */
  function cacheSettings(s: UserSettings) {
    setSettings(s);
    applySettings(s);
    writeSettingsCache(s);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        token: session?.access_token ?? null,
        loading,
        settings,
        settingsLoading,
        setAuth,
        clearAuth,
        cacheSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
