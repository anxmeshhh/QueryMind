/**
 * OnboardingTour — shows a guided walkthrough for first-time users.
 * Highlights key features with step-by-step tooltips.
 */

import { useState, useEffect } from "react";
import { X, Zap, FolderSearch, Database, Sparkles, ArrowRight, Trophy } from "lucide-react";

const TOUR_KEY = "qm_tour_completed";

const steps = [
  {
    icon: Zap,
    title: "Quick Analyze",
    desc: "Paste any SQL query and get instant performance analysis, anti-pattern detection, and optimized rewrites.",
    tip: "Try the Natural Language tab to describe what you want in plain English!",
  },
  {
    icon: FolderSearch,
    title: "Project Scanner",
    desc: "Upload local files or import a GitHub repository. We'll scan every file, find all SQL queries, and analyze them in batch.",
    tip: "Supports .py, .js, .ts, .java, .sql, and more.",
  },
  {
    icon: Database,
    title: "Live Database",
    desc: "Connect to a running PostgreSQL, MySQL, or SQLite database. Get real EXPLAIN plans and live schema discovery.",
    tip: "Connected schemas are shared across all modes automatically.",
  },
  {
    icon: Sparkles,
    title: "Natural Language",
    desc: 'Describe what you need in plain English — "Show me all users who ordered last month" — and we generate production-ready SQL.',
    tip: "The generated SQL is automatically analyzed for performance.",
  },
  {
    icon: Trophy,
    title: "Level Up",
    desc: "Earn XP for every analysis, unlock achievements, and track your optimization streak. Make database engineering fun!",
    tip: "Check your progress in the level badge on the top bar.",
  },
];

export function OnboardingTour() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(TOUR_KEY) !== "true") {
        // Show after a brief delay to let the page load
        const timer = setTimeout(() => setShow(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(TOUR_KEY, "true");
    } catch {}
  };

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!show) return null;

  const current = steps[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />

      {/* Card */}
      <div className="relative w-full max-w-[420px] bg-panel border border-border rounded-xl shadow-2xl shadow-black/30 overflow-hidden qm-fade-in">
        {/* Progress bar */}
        <div className="h-1 bg-elevated">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Close */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 text-text-disabled hover:text-text-secondary transition-colors"
          >
            <X size={16} />
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? "bg-primary scale-110" : i < step ? "bg-primary/40" : "bg-elevated"
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <Icon size={22} className="text-primary" />
          </div>

          {/* Content */}
          <h3 className="text-text-primary text-lg font-bold tracking-tight">{current.title}</h3>
          <p className="mt-2 text-text-secondary text-sm leading-relaxed">{current.desc}</p>

          {/* Tip */}
          <div className="mt-4 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2.5 text-primary text-[12px] flex items-start gap-2">
            <Sparkles size={12} className="shrink-0 mt-0.5" />
            <span>{current.tip}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={dismiss}
              className="text-text-muted text-[13px] hover:text-text-secondary transition-colors"
            >
              Skip tour
            </button>
            <button
              onClick={next}
              className="bg-primary text-primary-foreground text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 transition-all flex items-center gap-1.5"
            >
              {step === steps.length - 1 ? "Get Started" : "Next"}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
