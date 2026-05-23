import { useState } from "react";
import { Link, useMatches } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LogOut, Zap, FolderSearch, Database, ChevronRight, Clock } from "lucide-react";
import { HistoryDrawer } from "./HistoryDrawer";
import { type DBAnalysis } from "@/lib/history";

const navItems = [
  { to: "/quick" as const, label: "Quick", icon: Zap },
  { to: "/scan" as const, label: "Scan", icon: FolderSearch },
  { to: "/connect" as const, label: "Connect", icon: Database },
];

export function TopBar({
  showBack = false,
  right,
  center,
}: {
  showBack?: boolean;
  right?: React.ReactNode;
  center?: React.ReactNode;
}) {
  const { user, signOut } = useAuth();
  const matches = useMatches();
  const currentPath = matches[matches.length - 1]?.pathname;
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleRestore = (analysis: DBAnalysis) => {
    // Dispatch a custom event that any active page route can listen to
    const event = new CustomEvent("qm-restore-history", { detail: analysis });
    window.dispatchEvent(event);
  };

  return (
    <>
      <header className="h-12 border-b border-border flex items-center px-4 shrink-0 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        {/* Left: logo + breadcrumb nav */}
        <div className="flex items-center gap-1 min-w-0">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-6 h-6 bg-primary/15 border border-primary/30 rounded flex items-center justify-center group-hover:bg-primary/25 transition-colors">
              <span className="text-primary font-mono font-bold text-[11px]">Q</span>
            </div>
            <span className="text-text-primary text-sm font-semibold tracking-tight hidden sm:block">
              QueryMind
            </span>
          </Link>

          {showBack && (
            <>
              <ChevronRight size={14} className="text-text-disabled mx-1" />
              <span className="text-text-secondary text-sm font-mono capitalize">
                {currentPath?.replace("/", "") || "home"}
              </span>
            </>
          )}

          {!showBack && (
            <nav className="hidden md:flex items-center ml-4 gap-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = currentPath === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[13px] font-mono transition-colors ${
                      active
                        ? "text-primary bg-primary/10"
                        : "text-text-muted hover:text-text-secondary hover:bg-elevated/50"
                    }`}
                  >
                    <Icon size={13} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* Center */}
        <div className="flex-1 flex justify-center">{center}</div>

        {/* Right: actions + user */}
        <div className="flex items-center gap-3">
          {right}
          {user && (
            <div className="flex items-center gap-2.5 border-l border-border pl-3 ml-1">
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="text-text-disabled hover:text-primary p-1.5 rounded transition-colors flex items-center gap-1"
                title="View History"
              >
                <Clock size={15} />
                <span className="text-xs font-mono hidden md:block">History</span>
              </button>
              <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                <span className="text-primary font-mono text-[10px] font-bold uppercase">
                  {user.email?.charAt(0) || "U"}
                </span>
              </div>
              <span className="text-text-muted text-[12px] font-mono hidden lg:block truncate max-w-[140px]">
                {user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="text-text-disabled hover:text-critical text-sm flex items-center transition-colors"
                title="Sign Out"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRestore={handleRestore}
      />
    </>
  );
}

