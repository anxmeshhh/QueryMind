/**
 * Auth context — provides user state and auth methods to the entire app.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { API_BASE } from "@/lib/api";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithGithub: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  pendingVerification: { email: string; provider: string } | null;
  sendOtp: (email: string) => Promise<{ error: string | null; sandboxCode?: string }>;
  verifyOtp: (email: string, code: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    provider: string;
  } | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error: error?.message ?? null };
  };

  const signInWithGithub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    setPendingVerification(null);
    await supabase.auth.signOut();
  };

  // ── OTP helpers ─────────────────────────────────────────
  const sendOtp = async (email: string): Promise<{ error: string | null; sandboxCode?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Failed to send OTP" };
      return { error: null, sandboxCode: data.code ?? undefined };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Network error" };
    }
  };

  const verifyOtp = async (email: string, code: string): Promise<{ error: string | null }> => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Verification failed" };

      // OTP verified — create profile
      if (user) {
        const localXp = parseInt(localStorage.getItem("qm_xp") || "0");
        const localLevel = 1 + Math.floor(localXp / 100);
        await supabase.from("user_profiles").upsert({
          id: user.id,
          display_name: user.email?.split("@")[0] || "Developer",
          xp: localXp,
          level: localLevel,
        });
      }

      setPendingVerification(null);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Network error" };
    }
  };

  // Load profile from Supabase on login / state change
  useEffect(() => {
    if (!user) {
      setPendingVerification(null);
      return;
    }

    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from("user_profiles")
          .select("xp, level")
          .eq("id", user.id)
          .maybeSingle();

        if (data) {
          // Existing user — direct login
          const savedLocalXp = parseInt(localStorage.getItem("qm_xp") || "0");
          const finalXp = Math.max(data.xp || 0, savedLocalXp);
          localStorage.setItem("qm_xp", String(finalXp));
          window.dispatchEvent(new Event("qm-xp-updated"));
          setPendingVerification(null);
        } else {
          // New user — check if OAuth provider
          const provider = user.app_metadata?.provider;
          if (provider === "google" || provider === "github") {
            setPendingVerification({
              email: user.email || "",
              provider,
            });
            // Auto-send OTP
            sendOtp(user.email || "");
          } else {
            // Email/password signup — profile created after email confirm
            const localXp = parseInt(localStorage.getItem("qm_xp") || "0");
            const localLevel = 1 + Math.floor(localXp / 100);
            await supabase.from("user_profiles").upsert({
              id: user.id,
              display_name: user.email?.split("@")[0] || "Developer",
              xp: localXp,
              level: localLevel,
            });
          }
        }
      } catch (e) {
        console.error("Failed to sync auth user profile:", e);
      }
    };

    loadProfile();
  }, [user]);

  // Synchronize XP to Supabase whenever it changes locally
  useEffect(() => {
    if (!user) return;

    const handleXpUpdate = async () => {
      try {
        const localXp = parseInt(localStorage.getItem("qm_xp") || "0");
        const localLevel = 1 + Math.floor(localXp / 100);
        await supabase
          .from("user_profiles")
          .update({ xp: localXp, level: localLevel })
          .eq("id", user.id);
      } catch (e) {
        console.error("Failed to upload XP update to Supabase:", e);
      }
    };

    window.addEventListener("qm-xp-updated", handleXpUpdate);
    return () => window.removeEventListener("qm-xp-updated", handleXpUpdate);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithGithub,
        signOut,
        pendingVerification,
        sendOtp,
        verifyOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
