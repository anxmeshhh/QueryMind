import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Zap, FolderSearch, Database, ArrowRight, Shield, Activity, Cpu, GitBranch, Search, Clock } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth";
import { fetchRecentScans, type DBAnalysis } from "@/lib/history";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QueryMind — AI Database Intelligence Platform" },
      { name: "description", content: "Scan your codebase, discover SQL queries, detect anti-patterns, and optimize performance with an 8-agent AI pipeline." },
      { property: "og:title", content: "QueryMind — AI Database Intelligence Platform" },
      { property: "og:description", content: "Scan your codebase, discover SQL queries, detect anti-patterns, and optimize performance with an 8-agent AI pipeline." },
    ],
  }),
  component: Index,
});

const modes = [
  {
    to: "/quick" as const,
    icon: Zap,
    title: "Quick Analyze",
    desc: "Paste any SQL statement and instantly receive performance scores, anti-pattern warnings, and AI-optimized rewrites.",
    tag: "No setup needed",
    accent: "from-cyan-500/10 to-transparent",
  },
  {
    to: "/scan" as const,
    icon: FolderSearch,
    title: "Scan Project",
    desc: "Import local folders or GitHub repositories. We traverse your codebase recursively, isolate every SQL statement, and compute aggregate database impact.",
    tag: ".py · .js · .ts · .java · .sql",
    accent: "from-emerald-500/10 to-transparent",
  },
  {
    to: "/connect" as const,
    icon: Database,
    title: "Live Database",
    desc: "Connect to a running PostgreSQL, MySQL, or SQLite database. Get real EXPLAIN plans, live schema discovery, and production-accurate optimization.",
    tag: "PostgreSQL · MySQL · SQLite",
    accent: "from-violet-500/10 to-transparent",
  },
];

const stats = [
  { icon: Shield, value: "20", label: "Anti-pattern rules" },
  { icon: Cpu, value: "9", label: "AI analysis agents" },
  { icon: Activity, value: "~3s", label: "Average analysis time" },
  { icon: GitBranch, value: "3", label: "SQL dialects supported" },
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
        <main className="flex-1 flex flex-col">
          {/* Hero */}
          <section className="relative px-6 pt-16 pb-12 qm-hero-gradient">
            <div className="w-full max-w-[960px] mx-auto text-center qm-slide-up">
              <div className="inline-flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-full px-3 py-1 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-primary text-xs font-mono">
                  Logged in as {user?.email?.split("@")[0] || "developer"}
                </span>
              </div>
              <h1 className="text-[36px] md:text-[42px] leading-[1.15] font-bold text-text-primary tracking-tight">
                Your Database.{" "}
                <span className="text-primary">Optimized.</span>
              </h1>
              <p className="mt-4 text-text-secondary text-base md:text-lg max-w-[580px] mx-auto leading-relaxed">
                Scan your codebase, discover every SQL query, detect anti-patterns,
                and get AI-powered optimization — all in one pipeline.
              </p>

              {/* Quick-paste input */}
              <div className="mt-8 max-w-[560px] mx-auto">
                <div className="relative flex items-center">
                  <Search size={16} className="absolute left-3 text-text-disabled pointer-events-none" />
                  <input
                    value={quickSql}
                    onChange={(e) => setQuickSql(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleQuickPaste()}
                    placeholder="Paste SQL here to quick-analyze..."
                    className="w-full bg-code border border-border rounded-lg pl-10 pr-24 py-3 font-mono text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                  <button
                    onClick={handleQuickPaste}
                    disabled={!quickSql.trim()}
                    className="absolute right-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-primary/90 transition-all disabled:opacity-40"
                  >
                    Analyze
                  </button>
                </div>
                <div className="mt-2 text-text-disabled text-[10px] font-mono">Press Enter to analyze · Ctrl+K to focus</div>
              </div>
            </div>
          </section>

          {/* Mode Cards */}
          <section className="px-6 -mt-2 pb-12">
            <div className="w-full max-w-[960px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 qm-stagger">
              {modes.map((c) => {
                const Icon = c.icon;
                return (
                  <Link
                    key={c.to}
                    to={c.to}
                    className="group relative block bg-panel border border-border rounded-lg p-6 qm-card-hover overflow-hidden"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-b ${c.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    <div className="relative">
                      <div className="w-10 h-10 rounded-lg bg-secondary/60 border border-border flex items-center justify-center mb-4 group-hover:border-primary/30 transition-colors">
                        <Icon size={20} className="text-text-secondary group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="text-text-primary font-semibold text-base flex items-center gap-2">
                        {c.title}
                        <ArrowRight size={14} className="text-text-disabled group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </h3>
                      <p className="mt-2 text-text-muted text-[13px] leading-relaxed">{c.desc}</p>
                      <div className="mt-4">
                        <span className="inline-block bg-secondary text-text-secondary text-[11px] font-mono px-2 py-0.5 rounded">
                          {c.tag}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Stats Strip */}
          <section className="border-t border-border bg-panel/50 px-6 py-8">
            <div className="w-full max-w-[960px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-secondary/60 border border-border flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-primary" />
                    </div>
                    <div>
                      <div className="text-text-primary font-mono font-bold text-lg leading-none">
                        {s.value}
                      </div>
                      <div className="text-text-disabled text-[11px] font-mono mt-0.5">
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
            <section className="border-t border-border px-6 py-8">
              <div className="w-full max-w-[960px] mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <span className="section-label flex items-center gap-1.5"><Clock size={12} /> Recent Activity</span>
                  <span className="text-text-disabled text-[10px] font-mono">{recentScans.length} analyses</span>
                </div>
                <div className="space-y-2">
                  {recentScans.map((scan, i) => (
                    <Link
                      key={scan.id || i}
                      to={`/${scan.mode}` as "/quick" | "/scan" | "/connect"}
                      className="flex items-center gap-4 bg-panel border border-border rounded-lg px-4 py-3 hover:border-primary/30 transition-all group"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        scan.mode === "quick" ? "bg-cyan-500/10 text-cyan-400" :
                        scan.mode === "scan" ? "bg-emerald-500/10 text-emerald-400" :
                        "bg-violet-500/10 text-violet-400"
                      }`}>
                        {scan.mode === "quick" ? <Zap size={14} /> : scan.mode === "scan" ? <FolderSearch size={14} /> : <Database size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-text-primary text-sm font-mono truncate">
                          {scan.original_query?.slice(0, 60) || "Analysis"}
                        </div>
                        <div className="text-text-disabled text-[10px] font-mono mt-0.5">
                          {scan.mode} · {scan.dialect} · {new Date(scan.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-mono shrink-0">
                        <span className="text-critical">{scan.performance_score_before}</span>
                        <span className="text-text-disabled">→</span>
                        <span className="text-success">{scan.performance_score_after}</span>
                      </div>
                      <ArrowRight size={12} className="text-text-disabled group-hover:text-primary transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Pipeline visual */}
          <section className="border-t border-border px-6 py-10">
            <div className="w-full max-w-[960px] mx-auto">
              <div className="text-center mb-8">
                <span className="section-label">8-Agent AI Pipeline</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2 md:gap-0">
                {[
                  "File Scanner",
                  "DB Connector",
                  "Schema Discovery",
                  "SQL Parser",
                  "Anti-Pattern Detector",
                  "Index Advisor",
                  "Query Optimizer",
                  "Performance Predictor",
                ].map((name, i) => (
                  <div key={i} className="flex items-center">
                    <div className="bg-panel border border-border rounded px-3 py-1.5 text-xs font-mono text-text-secondary hover:text-primary hover:border-primary/30 transition-colors cursor-default">
                      {name}
                    </div>
                    {i < 7 && (
                      <ArrowRight size={12} className="text-text-disabled mx-1 hidden md:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-border px-6 py-6">
            <div className="w-full max-w-[960px] mx-auto flex flex-wrap items-center justify-between gap-4 text-text-disabled text-xs font-mono">
              <span>QueryMind · AI Database Intelligence Platform</span>
              <span>Built with Flask · React · Groq AI · Supabase</span>
            </div>
          </footer>
        </main>
      </div>
    </AuthGuard>
  );
}
