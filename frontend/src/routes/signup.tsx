import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account — QueryMind" },
      { name: "description", content: "Create a QueryMind account to optimize your SQL queries." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // If already logged in, redirect
  if (user) {
    navigate({ to: "/" });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("All fields are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);
    const { error: err } = await signUp(email, password);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-[400px]">
          <div className="bg-panel border border-border rounded-lg p-6 text-center">
            <div className="w-12 h-12 bg-success/15 border border-success/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-success text-xl">✓</span>
            </div>
            <h2 className="text-text-primary text-lg font-semibold">Check your email</h2>
            <p className="mt-2 text-text-secondary text-sm">
              We've sent a confirmation link to{" "}
              <span className="text-primary font-mono">{email}</span>.
              <br />
              Click the link to activate your account.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block bg-primary text-primary-foreground text-sm font-medium px-6 py-2.5 rounded-md hover:bg-primary/90 transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <p className="text-text-muted text-sm">Create your account</p>
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
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                className="w-full bg-code border border-border rounded-md px-3 py-2.5 font-mono text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-text-secondary text-[13px] font-medium mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
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
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-border text-center">
            <span className="text-text-muted text-[13px]">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign In
              </Link>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-text-disabled text-xs font-mono">
          Free tier · No credit card required
        </div>
      </div>
    </div>
  );
}
