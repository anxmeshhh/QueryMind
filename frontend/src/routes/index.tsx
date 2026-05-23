import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Zap, FolderSearch, Database, ArrowRight, Shield, Activity, Cpu, GitBranch, Search, Clock, CheckCircle2, TrendingUp, Lock } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth";
import { fetchRecentScans, type DBAnalysis } from "@/lib/history";
import { OnboardingTour } from "@/components/OnboardingTour";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QueryMind — Database Engineering Platform" },
      { name: "description", content: "Scan your codebase, discover SQL queries, detect anti-patterns, and optimize performance with intelligent analysis." },
      { property: "og:title", content: "QueryMind — Database Engineering Platform" },
      { property: "og:description", content: "Scan your codebase, discover SQL queries, detect anti-patterns, and optimize performance." },
    ],
  }),
  component: Index,
});

const modes = [
  {
    to: "/quick" as const,
    icon: Zap,
    title: "Quick Analyze",
    desc: "Paste any SQL statement and instantly receive performance scores, anti-pattern detection, and optimized rewrites.",
    tag: "No setup needed",
    gradient: "from-violet-500/8 via-transparent to-transparent",
  },
  {
    to: "/scan" as const,
    icon: FolderSearch,
    title: "Project Scanner",
    desc: "Import local folders or GitHub repositories. Recursively traverse your codebase, isolate every SQL statement, and compute aggregate impact.",
    tag: ".py · .js · .ts · .java · .sql",
    gradient: "from-emerald-500/8 via-transparent to-transparent",
  },
  {
    to: "/connect" as const,
    icon: Database,
    title: "Live Database",
    desc: "Connect to a running PostgreSQL, MySQL, or SQLite instance. Get real EXPLAIN plans, live schema discovery, and production-accurate analysis.",
    tag: "PostgreSQL · MySQL · SQLite",
    gradient: "from-blue-500/8 via-transparent to-transparent",
  },
];

const stats = [
  { icon: Shield, value: "20+", label: "Detection rules" },
  { icon: Cpu, value: "9", label: "Analysis agents" },
  { icon: Activity, value: "~3s", label: "Avg. analysis" },
  { icon: GitBranch, value: "3", label: "SQL dialects" },
];

const steps = [
  { num: "01", title: "Input", desc: "Paste SQL, upload files, or connect a live database", icon: Search },
  { num: "02", title: "Analyze", desc: "9 specialized agents parse, detect, and optimize in parallel", icon: Cpu },
  { num: "03", title: "Optimize", desc: "Get scored results, rewritten queries, and index recommendations", icon: TrendingUp },
];

function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quickSql, setQuickSql] = useState("");
  const [recentScans, setRecentScans] = useState<DBAnalysis[]>([]);

  useEffect(() => {
    fetchRecentScans(5).then(setRecentScans).catch(() => {});
  }, []);

  const handleQuickPaste = () => {
    if (quickSql.trim()) {
      navigate({ to: "/quick", search: { q: quickSql.trim() } });
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col bg-background">
        <TopBar />
        <OnboardingTour />
        <main className="flex-1 flex flex-col">
          {/* Hero */}
          <section className="relative px-6 pt-20 pb-16 qm-hero-gradient overflow-hidden">
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }} />

            <div className="relative w-full max-w-[960px] mx-auto text-center qm-slide-up">
              <div className="inline-flex items-center gap-2 bg-primary/8 border border-primary/15 rounded-full px-4 py-1.5 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-primary text-[11px] font-medium tracking-wide">
                  Database Engineering Platform
                </span>
              </div>
              <h1 className="text-[38px] md:text-[48px] leading-[1.1] font-bold text-text-primary tracking-tight">
                Your Queries.{" "}
                <span className="qm-gradient-text">Perfected.</span>
              </h1>
              <p className="mt-5 text-text-secondary text-base md:text-lg max-w-[560px] mx-auto leading-relaxed">
                Scan codebases, connect live databases, detect anti-patterns,
                and get performance-optimized rewrites — all in one workflow.
              </p>

              {/* Quick-paste input */}
              <div className="mt-10 max-w-[580px] mx-auto">
                <div className="relative flex items-center group">
                  <Search size={16} className="absolute left-4 text-text-disabled pointer-events-none group-focus-within:text-primary transition-colors" />
                  <input
                    value={quickSql}
                    onChange={(e) => setQuickSql(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleQuickPaste()}
                    placeholder="Paste SQL here to quick-analyze..."
                    className="w-full bg-panel border border-border rounded-xl pl-11 pr-28 py-3.5 font-mono text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all shadow-lg shadow-black/10"
                  />
                  <button
                    onClick={handleQuickPaste}
                    disabled={!quickSql.trim()}
                    className="absolute right-2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-all disabled:opacity-30 qm-glow"
                  >
                    Analyze →
                  </button>
                </div>
                <div className="mt-2.5 flex items-center justify-center gap-4 text-text-disabled text-[10px] font-mono">
                  <span>Press Enter to analyze</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Lock size={9} /> End-to-end encrypted</span>
                </div>
              </div>
            </div>
          </section>

          {/* Mode Cards */}
          <section className="px-6 -mt-4 pb-16">
            <div className="w-full max-w-[960px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 qm-stagger">
              {modes.map((c) => {
                const Icon = c.icon;
                return (
                  <Link
                    key={c.to}
                    to={c.to}
                    className="group relative block bg-panel border border-border rounded-xl p-6 qm-card-hover overflow-hidden"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-b ${c.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className="relative">
                      <div className="w-11 h-11 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-4 group-hover:bg-primary/15 group-hover:border-primary/25 transition-all">
                        <Icon size={20} className="text-primary" />
                      </div>
                      <h3 className="text-text-primary font-semibold text-[15px] flex items-center gap-2">
                        {c.title}
                        <ArrowRight size={14} className="text-text-disabled group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </h3>
                      <p className="mt-2 text-text-muted text-[13px] leading-relaxed">{c.desc}</p>
                      <div className="mt-4">
                        <span className="inline-block bg-secondary/80 text-text-secondary text-[10px] font-mono px-2.5 py-1 rounded-md">
                          {c.tag}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* How It Works */}
          <section className="border-t border-border bg-panel/30 px-6 py-16">
            <div className="w-full max-w-[960px] mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-text-primary text-xl font-bold tracking-tight">How It Works</h2>
                <p className="text-text-muted text-sm mt-2">Three steps to production-grade query optimization</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 qm-stagger">
                {steps.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.num} className="text-center">
                      <div className="w-14 h-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-4">
                        <Icon size={22} className="text-primary" />
                      </div>
                      <div className="text-primary text-[10px] font-mono font-bold mb-2">{s.num}</div>
                      <h3 className="text-text-primary font-semibold text-[15px]">{s.title}</h3>
                      <p className="text-text-muted text-[13px] mt-1.5 leading-relaxed max-w-[240px] mx-auto">{s.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Stats Strip */}
          <section className="border-t border-border px-6 py-10">
            <div className="w-full max-w-[960px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-primary" />
                    </div>
                    <div>
                      <div className="text-text-primary font-mono font-bold text-xl leading-none">
                        {s.value}
                      </div>
                      <div className="text-text-disabled text-[11px] mt-0.5">
                        {s.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent Activity */}
          {recentScans.length > 0 && (
            <section className="border-t border-border px-6 py-10">
              <div className="w-full max-w-[960px] mx-auto">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-text-primary font-semibold text-sm flex items-center gap-2">
                    <Clock size={14} className="text-text-muted" />
                    Recent Analyses
                  </h3>
                </div>
                <div className="space-y-2">
                  {recentScans.slice(0, 5).map((scan, i) => (
                    <div key={i} className="flex items-center gap-3 bg-panel border border-border rounded-lg px-4 py-3 text-[13px] font-mono">
                      <CheckCircle2 size={14} className="text-success shrink-0" />
                      <span className="text-text-secondary truncate flex-1">
                        {scan.original_query?.substring(0, 80) || scan.mode || "Analysis"}...
                      </span>
                      <span className="text-text-disabled text-[11px] shrink-0">
                        {scan.performance_score_before ?? "?"} → {scan.performance_score_after ?? "?"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="border-t border-border px-6 py-6">
            <div className="w-full max-w-[960px] mx-auto flex items-center justify-between text-text-disabled text-[10px] font-mono">
              <span>© 2024 QueryMind · Database Engineering Platform</span>
              <span className="flex items-center gap-1">
                <Shield size={10} /> Encrypted · Privacy-first
              </span>
            </div>
          </footer>
        </main>
      </div>
    </AuthGuard>
  );
}
