/**
 * AuthGuard — wraps protected routes. Redirects to /login if not authenticated.
 */

import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background qm-hero-gradient">
        <div className="flex flex-col items-center gap-4 qm-slide-up">
          <div className="w-10 h-10 bg-primary/15 border border-primary/30 rounded-lg flex items-center justify-center">
            <span className="text-primary font-mono font-bold text-sm">Q</span>
          </div>
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-text-muted text-sm font-mono">Initializing session...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
