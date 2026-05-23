/**
 * GitHubLinkPrompt — shows a modal after GitHub OAuth login asking the user
 * whether they want to connect their GitHub repos to QueryMind.
 *
 * If YES → sets githubConnected = true, repos appear in scan page
 * If NO  → dismisses, user can still manually import via URL
 */

import { useState, useEffect } from "react";
import { Github, Link2, X, ArrowRight, FolderGit2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

const PROMPT_KEY = "qm_github_link_prompted";

export function GitHubLinkPrompt() {
  const { user, githubConnected, setGithubConnected } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Only show for GitHub OAuth users who haven't been prompted yet
    const isGithubUser = user.app_metadata?.provider === "github";
    const alreadyPrompted = localStorage.getItem(PROMPT_KEY) === "true";

    if (isGithubUser && !alreadyPrompted && !githubConnected) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [user, githubConnected]);

  const handleConnect = () => {
    setGithubConnected(true);
    localStorage.setItem(PROMPT_KEY, "true");
    setShow(false);
  };

  const handleSkip = () => {
    localStorage.setItem(PROMPT_KEY, "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSkip} />

      {/* Card */}
      <div className="relative w-full max-w-[440px] bg-panel border border-border rounded-xl shadow-2xl shadow-black/30 overflow-hidden qm-fade-in">
        <div className="p-6">
          {/* Close */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 text-text-disabled hover:text-text-secondary transition-colors"
          >
            <X size={16} />
          </button>

          {/* Icon */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-[#24292e] border border-border flex items-center justify-center">
              <Github size={24} className="text-white" />
            </div>
            <div className="w-8 flex items-center justify-center text-text-disabled">
              <Link2 size={18} />
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FolderGit2 size={22} className="text-primary" />
            </div>
          </div>

          {/* Content */}
          <h3 className="text-text-primary text-lg font-bold tracking-tight">
            Connect your GitHub repositories?
          </h3>
          <p className="mt-2 text-text-secondary text-sm leading-relaxed">
            Link your GitHub account to automatically browse and scan your repositories directly from QueryMind. Your repos will appear in the <strong className="text-text-primary">Project Scanner</strong> for one-click import.
          </p>

          {/* Benefits */}
          <div className="mt-4 space-y-2">
            {[
              "Browse and search your public & private repos",
              "One-click import — no manual URL entry needed",
              "Schema context flows to Quick Analyze automatically",
            ].map((benefit, i) => (
              <div key={i} className="flex items-start gap-2 text-text-secondary text-[12px]">
                <span className="text-primary mt-0.5">✓</span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleSkip}
              className="flex-1 border border-border text-text-secondary text-sm font-medium py-2.5 rounded-lg hover:bg-elevated/50 transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleConnect}
              className="flex-1 bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              Connect GitHub
              <ArrowRight size={14} />
            </button>
          </div>

          <p className="mt-3 text-text-disabled text-[10px] font-mono text-center">
            You can always import repos manually in the Project Scanner
          </p>
        </div>
      </div>
    </div>
  );
}
