import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, FolderSearch, Database } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { AuthGuard } from "@/components/AuthGuard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QueryMind — Database Query Optimizer" },
      { name: "description", content: "Find slow queries, detect anti-patterns, get index recommendations." },
      { property: "og:title", content: "QueryMind — Database Query Optimizer" },
      { property: "og:description", content: "Find slow queries, detect anti-patterns, get index recommendations." },
    ],
  }),
  component: Index,
});

const cards = [
  {
    to: "/quick" as const,
    icon: Zap,
    title: "Quick Analyze",
    desc: "Paste a SQL query and get instant analysis",
    tag: "No setup needed",
  },
  {
    to: "/scan" as const,
    icon: FolderSearch,
    title: "Scan Project",
    desc: "Upload code files to find every SQL query",
    tag: ".py · .js · .java · .sql",
  },
  {
    to: "/connect" as const,
    icon: Database,
    title: "Live Database",
    desc: "Connect to your database for real EXPLAIN plans",
    tag: "PostgreSQL · MySQL · SQLite",
  },
];

function Index() {
  return (
    <AuthGuard>
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[900px] mx-auto">
          <div className="text-center mb-12">
            <div
              className="text-text-muted text-[11px] font-semibold uppercase mb-4"
              style={{ letterSpacing: "2px" }}
            >
              Database Query Optimizer
            </div>
            <h1 className="text-[32px] leading-tight font-semibold text-text-primary tracking-tight">
              Analyze. Optimize. Ship faster.
            </h1>
            <p className="mt-3 text-text-secondary text-base">
              Find slow queries, detect anti-patterns, get index recommendations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.to}
                  to={c.to}
                  className="group block bg-panel border border-border rounded-lg p-6 transition-colors hover:border-primary"
                >
                  <Icon size={24} className="text-text-secondary group-hover:text-primary transition-colors" />
                  <h3 className="mt-4 text-text-primary font-semibold text-base">{c.title}</h3>
                  <p className="mt-1 text-text-secondary text-sm leading-relaxed">{c.desc}</p>
                  <div className="mt-5">
                    <span className="inline-block bg-secondary text-text-secondary text-[12px] font-mono px-2 py-0.5 rounded">
                      {c.tag}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-16 text-center text-text-disabled text-xs font-mono">
            20 rules · 8 analysis agents · 30+ SQL dialects
          </div>
        </div>
      </main>
    </div>
    </AuthGuard>
  );
}
