import { useState, useEffect } from "react";
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

const BADGES = [
  { id: "first_scan", icon: "🔍", name: "First Scan", desc: "Scan your first project folder", xp: 50 },
  { id: "bug_hunter", icon: "🐛", name: "Bug Hunter", desc: "Identify critical SQL anti-patterns", xp: 150 },
  { id: "optimizer", icon: "⚡", name: "Query Optimizer", desc: "Successfully optimize SQL statement", xp: 250 },
  { id: "guardian", icon: "🛡️", name: "Schema Guardian", desc: "Assess table constraints & keys", xp: 400 },
  { id: "completionist", icon: "🏆", name: "Command Master", desc: "Maintain a healthy developer index score", xp: 600 },
];

const isBadgeEarned = (badgeId: string, currentXp: number) => {
  if (badgeId === "first_scan") return currentXp >= 50;
  if (badgeId === "bug_hunter") return currentXp >= 150;
  if (badgeId === "optimizer") return currentXp >= 250;
  if (badgeId === "guardian") return currentXp >= 400;
  if (badgeId === "completionist") return currentXp >= 600;
  return false;
};

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
  const [isBadgesOpen, setIsBadgesOpen] = useState(false);
  const [xp, setXp] = useState(() => {
    try {
      return parseInt(localStorage.getItem("qm_xp") || "0");
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        setXp(parseInt(localStorage.getItem("qm_xp") || "0"));
      } catch {}
    };
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("qm-xp-updated", handleUpdate);
    const interval = setInterval(handleUpdate, 1000);
    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("qm-xp-updated", handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const level = 1 + Math.floor(xp / 100);
  const nextLevelXp = level * 100;
  const prevLevelXp = (level - 1) * 100;
  const percent = Math.min(100, Math.max(0, ((xp - prevLevelXp) / 100) * 100));

  const handleRestore = (analysis: DBAnalysis) => {
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
              {/* Sleek Gamification Level Badge */}
              <div className="relative">
                <button
                  onClick={() => setIsBadgesOpen(!isBadgesOpen)}
                  className="flex items-center gap-1.5 bg-primary/10 border border-primary/25 rounded px-2.5 py-1 hover:bg-primary/20 transition-all select-none"
                  title="View Achievements"
                >
                  <span className="text-[10.5px] font-mono font-bold text-primary">LVL {level}</span>
                  <div className="w-12 h-1.5 bg-code border border-border rounded-full overflow-hidden hidden sm:block">
                    <div className="bg-primary h-full transition-all duration-300" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-text-secondary hidden sm:inline">{xp} XP</span>
                </button>

                {isBadgesOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-panel border border-border rounded-lg shadow-2xl p-4 z-50 qm-fade-in space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="font-mono text-xs font-bold text-text-primary">Developer Achievements</span>
                      <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {BADGES.filter(b => isBadgeEarned(b.id, xp)).length} / {BADGES.length} Earned
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-60 overflow-y-auto qm-scroll pr-1">
                      {BADGES.map((b) => {
                        const earned = isBadgeEarned(b.id, xp);
                        return (
                          <div key={b.id} className={`flex items-start gap-3 p-2 rounded transition-colors ${earned ? "bg-primary/5 border border-primary/10" : "opacity-60 border border-transparent"}`}>
                            <span className="text-xl shrink-0">{earned ? b.icon : "🔒"}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-mono font-bold text-text-primary flex items-center gap-1.5">
                                {b.name}
                                {earned && <span className="text-[9px] bg-success/15 text-success px-1.5 py-0.2 rounded-full font-normal">Earned</span>}
                              </div>
                              <div className="text-[10px] text-text-muted leading-tight mt-0.5">{b.desc}</div>
                              <div className="text-[9px] font-mono text-text-disabled mt-1">Unlock at: {b.xp} XP</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

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

