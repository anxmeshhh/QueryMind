import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — QueryMind" },
      { name: "description", content: "Sign in to QueryMind to analyze your SQL queries." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  if (user) {
    navigate({ to: "/" });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      navigate({ to: "/" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary/15 border border-primary/30 rounded-md flex items-center justify-center">
              <span className="text-primary font-mono font-bold text-sm">Q</span>
            </div>
            <span className="text-text-primary text-xl font-semibold tracking-tight">QueryMind</span>
          </div>
          <p className="text-text-muted text-sm">Sign in to your account</p>
        </div>

        {/* Form Card */}
        <div className="bg-panel border border-border rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-critical/10 border border-critical/20 rounded-md px-3 py-2.5 text-critical text-[13px] font-mono">
                {error}
              </div>
            )}

            <div>
              <label className="block text-text-secondary text-[13px] font-medium mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                className="w-full bg-code border border-border rounded-md px-3 py-2.5 font-mono text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-text-secondary text-[13px] font-medium mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-code border border-border rounded-md px-3 py-2.5 font-mono text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-border text-center">
            <span className="text-text-muted text-[13px]">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign Up
              </Link>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-text-disabled text-xs font-mono">
          20 rules · 8 analysis agents · 30+ SQL dialects
        </div>
      </div>
    </div>
  );
}
