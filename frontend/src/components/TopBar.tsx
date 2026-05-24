import { useState, useEffect } from "react";
import { Link, useMatches } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LogOut, Zap, FolderSearch, Database, Clock, Trophy, Flame, ChevronDown } from "lucide-react";
import { HistoryDrawer } from "./HistoryDrawer";
import { ThemeToggle } from "./ThemeToggle";
import { CommandPaletteTrigger } from "./CommandPalette";
import { type DBAnalysis } from "@/lib/history";

const navItems = [
  { to: "/quick" as const, label: "Quick Analyze", icon: Zap },
  { to: "/scan" as const, label: "Project Scanner", icon: FolderSearch },
  { to: "/connect" as const, label: "Live Database", icon: Database },
];

const BADGES = [
  { id: "first_scan", icon: "🔍", name: "First Scan", desc: "Run your first analysis", xp: 50 },
  { id: "connector", icon: "🔗", name: "Connector", desc: "Connect to a live database", xp: 100 },
  { id: "bug_hunter", icon: "🐛", name: "Bug Hunter", desc: "Find 10 SQL anti-patterns", xp: 150 },
  { id: "speed_demon", icon: "⚡", name: "Speed Demon", desc: "Get analysis under 2 seconds", xp: 200 },
  { id: "optimizer", icon: "🎯", name: "Optimizer", desc: "Achieve a 90+ optimization score", xp: 250 },
  { id: "data_scientist", icon: "📊", name: "Data Scientist", desc: "Analyze 50+ queries total", xp: 300 },
  { id: "streak_7", icon: "🔥", name: "On Fire", desc: "7-day usage streak", xp: 350 },
  { id: "guardian", icon: "🛡️", name: "Schema Guardian", desc: "Pass schema safety on 10 queries", xp: 400 },
  { id: "perfectionist", icon: "💎", name: "Perfectionist", desc: "Score 95+ on 5 queries", xp: 500 },
  { id: "master", icon: "🏆", name: "Command Master", desc: "Reach Level 10", xp: 1000 },
];

const isBadgeEarned = (badgeId: string, currentXp: number) => {
  const badge = BADGES.find((b) => b.id === badgeId);
  return badge ? currentXp >= badge.xp : false;
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [xp, setXp] = useState(() => {
    if (typeof window === "undefined") return 0;
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

  // Close dropdowns on outside click
  useEffect(() => {
    const close = () => {
      setIsBadgesOpen(false);
      setIsUserMenuOpen(false);
    };
    if (isBadgesOpen || isUserMenuOpen) {
      const timer = setTimeout(() => document.addEventListener("click", close), 10);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("click", close);
      };
    }
  }, [isBadgesOpen, isUserMenuOpen]);

  const level = 1 + Math.floor(xp / 100);
  const nextLevelXp = level * 100;
  const prevLevelXp = (level - 1) * 100;
  const percent = Math.min(100, Math.max(0, ((xp - prevLevelXp) / 100) * 100));
  const earnedCount = BADGES.filter((b) => isBadgeEarned(b.id, xp)).length;

  const handleRestore = (analysis: DBAnalysis) => {
    const event = new CustomEvent("qm-restore-history", { detail: analysis });
    window.dispatchEvent(event);
  };

  return (
    <>
      <header className="h-14 border-b border-border flex items-center px-5 shrink-0 qm-glass sticky top-0 z-50">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-1 min-w-0">
          <Link to="/" className="flex items-center gap-2.5 group shrink-0 mr-1">
            <div className="w-7 h-7 bg-primary/15 border border-primary/30 rounded-lg flex items-center justify-center group-hover:bg-primary/25 transition-colors">
              <span className="text-primary font-mono font-bold text-xs">Q</span>
            </div>
            <span className="text-text-primary text-[15px] font-semibold tracking-tight hidden sm:block">
              QueryMind
            </span>
          </Link>

          {!showBack && (
            <nav className="hidden md:flex items-center ml-3 gap-0.5 h-14">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = currentPath === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`qm-tab-indicator ${active ? "active" : ""} flex items-center gap-1.5 px-3 h-full text-[13px] font-medium transition-colors ${
                      active
                        ? "text-primary"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    <Icon size={14} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* Center */}
        <div className="flex-1 flex justify-center">
          {center || <CommandPaletteTrigger />}
        </div>

        {/* Right: gamification + user */}
        <div className="flex items-center gap-2">
          {right}
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-2 border-l border-border pl-3 ml-1">
              {/* Level Badge */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsBadgesOpen(!isBadgesOpen);
                  }}
                  className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-lg px-2.5 py-1.5 hover:bg-primary/15 transition-all select-none"
                  title="View Achievements"
                >
                  <Trophy size={13} className="text-primary" />
                  <span className="text-[11px] font-mono font-bold text-primary">LVL {level}</span>
                  <div className="w-14 h-1.5 bg-elevated border border-border rounded-full overflow-hidden hidden sm:block">
                    <div className="bg-gradient-to-r from-primary to-purple-400 h-full transition-all duration-500" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-text-disabled hidden sm:inline">{xp} XP</span>
                </button>

                {isBadgesOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-panel border border-border rounded-xl shadow-2xl shadow-black/30 p-5 z-50 qm-fade-in" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                      <span className="font-semibold text-sm text-text-primary">Achievements</span>
                      <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {earnedCount} / {BADGES.length}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto qm-scroll pr-1">
                      {BADGES.map((b) => {
                        const earned = isBadgeEarned(b.id, xp);
                        return (
                          <div
                            key={b.id}
                            className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                              earned
                                ? "bg-primary/5 border border-primary/10"
                                : "opacity-50 border border-transparent"
                            }`}
                          >
                            <span className="text-lg shrink-0">{earned ? b.icon : "🔒"}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] font-semibold text-text-primary flex items-center gap-1.5">
                                {b.name}
                                {earned && (
                                  <span className="text-[9px] bg-success/15 text-success px-1.5 py-px rounded-full font-normal">
                                    Earned
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-text-muted mt-0.5">{b.desc}</div>
                            </div>
                            <span className="text-[9px] font-mono text-text-disabled shrink-0">{b.xp} XP</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* History */}
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="text-text-disabled hover:text-primary p-1.5 rounded-lg hover:bg-elevated transition-all flex items-center gap-1"
                title="View History"
              >
                <Clock size={15} />
              </button>

              {/* User Avatar Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsUserMenuOpen(!isUserMenuOpen);
                  }}
                  className="flex items-center gap-1.5 hover:bg-elevated rounded-lg px-1.5 py-1 transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 border border-primary/25 flex items-center justify-center">
                    <span className="text-primary font-mono text-[10px] font-bold uppercase">
                      {user.email?.charAt(0) || "U"}
                    </span>
                  </div>
                  <ChevronDown size={12} className="text-text-disabled hidden sm:block" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-panel border border-border rounded-xl shadow-2xl shadow-black/30 py-2 z-50 qm-fade-in" onClick={(e) => e.stopPropagation()}>
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <div className="text-text-primary text-sm font-medium truncate">
                        {user.email?.split("@")[0] || "Developer"}
                      </div>
                      <div className="text-text-disabled text-[11px] font-mono truncate">{user.email}</div>
                    </div>
                    <button
                      onClick={() => signOut()}
                      className="w-full flex items-center gap-2 px-3 py-2 text-text-muted text-[13px] hover:text-critical hover:bg-critical/5 transition-colors"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
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
