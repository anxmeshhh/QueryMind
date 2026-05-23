import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Github, Shield, Cpu, Activity, Zap, CheckCircle2 } from "lucide-react";

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
  const { signUp, signInWithGoogle, signInWithGithub, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirect if already logged in — must be in useEffect to avoid setState-during-render
  useEffect(() => {
    if (user) {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

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

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    const { error: err } = await signInWithGoogle();
    if (err) {
      setError(err);
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setError(null);
    setLoading(true);
    const { error: err } = await signInWithGithub();
    if (err) {
      setError(err);
      setLoading(false);
    }
  };

  // Don't render if user is already logged in
  if (user) return null;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-[440px] qm-fade-in">
          <div className="bg-panel border border-border rounded-lg p-8 text-center shadow-xl shadow-black/10">
            <div className="w-14 h-14 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={24} className="text-success" />
            </div>
            <h2 className="text-text-primary text-xl font-bold tracking-tight">Check your email</h2>
            <p className="mt-3 text-text-secondary text-sm leading-relaxed">
              We've sent a confirmation link to{" "}
              <span className="text-primary font-mono font-medium">{email}</span>.
              <br />
              Click the link to activate your account.
            </p>
            <Link
              to="/login"
              className="mt-7 inline-flex items-center justify-center bg-primary text-primary-foreground text-sm font-semibold px-8 py-2.5 rounded-md hover:bg-primary/90 transition-all qm-glow"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — branding + feature highlights */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-panel border-r border-border p-10 qm-hero-gradient">
        <div>
          <div className="flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 bg-primary/15 border border-primary/30 rounded-lg flex items-center justify-center">
              <span className="text-primary font-mono font-bold text-base">Q</span>
            </div>
            <span className="text-text-primary text-xl font-semibold tracking-tight">QueryMind</span>
          </div>

          <h2 className="text-text-primary text-2xl font-bold leading-snug tracking-tight">
            Start optimizing your<br />database today
          </h2>
          <p className="mt-3 text-text-muted text-sm leading-relaxed max-w-[320px]">
            Join developers who use QueryMind to write faster, safer SQL — powered by a 9-agent analysis engine.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { icon: Zap, label: "Instant analysis", desc: "Paste SQL, get results in ~3s" },
              { icon: Shield, label: "Schema protection", desc: "Never break existing indexes" },
              { icon: Cpu, label: "Project scanning", desc: "Import folders or GitHub repos" },
              { icon: Activity, label: "History tracking", desc: "Every optimization saved" },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 group">
                <div className="w-8 h-8 bg-secondary/60 border border-border rounded-lg flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors">
                  <f.icon size={14} className="text-primary" />
                </div>
                <div>
                  <div className="text-text-primary text-[13px] font-medium">{f.label}</div>
                  <div className="text-text-disabled text-[11px] font-mono">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-text-disabled text-[10px] font-mono">
          © 2024 QueryMind · Database Engineering Platform
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[400px] qm-fade-in">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-primary/15 border border-primary/30 rounded-md flex items-center justify-center">
                <span className="text-primary font-mono font-bold text-sm">Q</span>
              </div>
              <span className="text-text-primary text-xl font-semibold tracking-tight">QueryMind</span>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-text-primary text-xl font-bold tracking-tight">Create your account</h1>
            <p className="text-text-muted text-sm mt-1">Get started with free SQL optimization</p>
          </div>

          {/* Form Card */}
          <div className="bg-panel border border-border rounded-lg p-6 shadow-xl shadow-black/10">
            {/* OAuth buttons first */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-code border border-border rounded-md py-2.5 text-text-primary text-[13px] hover:bg-elevated hover:border-text-muted transition-all font-mono disabled:opacity-60 qm-card-hover"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={handleGithubLogin}
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-code border border-border rounded-md py-2.5 text-text-primary text-[13px] hover:bg-elevated hover:border-text-muted transition-all font-mono disabled:opacity-60 qm-card-hover"
              >
                <Github size={15} className="text-text-primary shrink-0" />
                GitHub
              </button>
            </div>

            <div className="relative my-5 flex items-center justify-center shrink-0">
              <span className="absolute left-0 right-0 border-t border-border" />
              <span className="relative bg-panel px-3 text-[10px] text-text-disabled font-mono uppercase tracking-widest">
                or with email
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-critical/10 border border-critical/20 rounded-md px-3 py-2.5 text-critical text-[13px] font-mono flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-critical shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-text-secondary text-[13px] font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                  className="w-full bg-code border border-border rounded-md px-3 py-2.5 font-mono text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-text-secondary text-[13px] font-medium mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  className="w-full bg-code border border-border rounded-md px-3 py-2.5 font-mono text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-text-secondary text-[13px] font-medium mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-code border border-border rounded-md px-3 py-2.5 font-mono text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded-md hover:bg-primary/90 transition-all disabled:opacity-60 qm-glow"
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

            <div className="mt-5 pt-4 border-t border-border text-center">
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

          {/* Trust signals */}
          <div className="mt-6 flex items-center justify-center gap-4 text-text-disabled text-[10px] font-mono">
            <span className="flex items-center gap-1"><Shield size={10} /> Encrypted</span>
            <span>·</span>
            <span>No credit card</span>
            <span>·</span>
            <span>Free tier</span>
          </div>
        </div>
      </div>
    </div>
  );
}
