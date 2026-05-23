import { Link } from "@tanstack/react-router";

export function TopBar({
  showBack = false,
  right,
  center,
}: {
  showBack?: boolean;
  right?: React.ReactNode;
  center?: React.ReactNode;
}) {
  return (
    <header className="h-12 border-b border-border flex items-center px-4 shrink-0 bg-background">
      <div className="flex items-center gap-2 min-w-0">
        {showBack && (
          <Link
            to="/"
            className="text-text-secondary hover:text-text-primary text-sm w-6 h-6 flex items-center justify-center rounded-sm hover:bg-elevated transition-colors"
            aria-label="Back"
          >
            ←
          </Link>
        )}
        <Link to="/" className="text-text-primary text-base font-semibold tracking-tight">
          QueryMind
        </Link>
      </div>
      <div className="flex-1 flex justify-center">{center}</div>
      <div className="flex items-center gap-3">
        {right ?? (
          <button className="text-text-secondary hover:text-text-primary text-sm transition-colors">
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
