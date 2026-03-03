"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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

type AuthContextType = {
  user: User | null;
  session: Session | null;
  token: string | null;
  loading: boolean;
  setAuth: (user: User, session: Session) => void;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);
const supabase = createSupabaseClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from Supabase's internal storage on mount
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setUser({
          id: data.session.user.id,
          email: data.session.user.email ?? "",
          displayName: data.session.user.user_metadata?.display_name ?? "",
        });
      }
      setLoading(false);
    });

    // Keep context in sync if session refreshes or user signs out elsewhere
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) {
        setSession(s);
        setUser({
          id: s.user.id,
          email: s.user.email ?? "",
          displayName: s.user.user_metadata?.display_name ?? "",
        });
      } else {
        setUser(null);
        setSession(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function setAuth(user: User, session: Session) {
    setUser(user);
    setSession(session);
  }

  function clearAuth() {
    setUser(null);
    setSession(null);
    supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      token: session?.access_token ?? null,
      loading,
      setAuth,
      clearAuth,
    }}>
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
