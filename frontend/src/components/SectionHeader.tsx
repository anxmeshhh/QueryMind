/**
 * SectionHeader — Consistent page header with breadcrumb, title, subtitle, and action slot.
 * Used across all main pages for uniform navigation feel.
 */

import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  to?: string;
}

interface SectionHeaderProps {
  crumbs: Crumb[];
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  stats?: { label: string; value: string | number }[];
}

export function SectionHeader({ crumbs, title, subtitle, badge, actions, stats }: SectionHeaderProps) {
  return (
    <div className="border-b border-border bg-panel/40 px-6 py-5">
      <div className="w-full max-w-[1100px] mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-[12px] font-mono text-text-disabled mb-3">
          <Link to="/" className="hover:text-text-muted transition-colors">
            Home
          </Link>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={10} className="text-text-disabled/50" />
              {c.to ? (
                <Link to={c.to} className="hover:text-text-muted transition-colors">
                  {c.label}
                </Link>
              ) : (
                <span className="text-text-secondary">{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-text-primary text-[22px] font-bold tracking-tight leading-tight">
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <p className="mt-1.5 text-text-muted text-sm leading-relaxed max-w-[600px]">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0 pt-0.5">{actions}</div>}
        </div>

        {/* Optional stats pills */}
        {stats && stats.length > 0 && (
          <div className="flex items-center gap-4 mt-4">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className="text-text-primary font-bold">{s.value}</span>
                <span className="text-text-disabled">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
