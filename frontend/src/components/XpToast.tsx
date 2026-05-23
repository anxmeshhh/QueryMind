/**
 * XP Toast system — shows animated XP gain notifications.
 * Usage: import { awardXp } from "@/components/XpToast"
 *        awardXp(25, "Query analyzed!")
 */

import { useState, useEffect, useCallback } from "react";
import { Zap } from "lucide-react";

interface XpEvent {
  id: number;
  amount: number;
  reason: string;
}

let _nextId = 0;
let _listeners: ((evt: XpEvent) => void)[] = [];

/**
 * Award XP to the user. Call this from anywhere — it triggers both
 * localStorage persistence and a visual toast notification.
 */
export function awardXp(amount: number, reason: string = "Action completed") {
  const current = parseInt(localStorage.getItem("qm_xp") || "0");
  const updated = current + amount;
  localStorage.setItem("qm_xp", String(updated));
  window.dispatchEvent(new Event("qm-xp-updated"));

  const evt: XpEvent = { id: ++_nextId, amount, reason };
  _listeners.forEach((fn) => fn(evt));
}

/**
 * Mount this component once in the root layout. It listens for awardXp
 * calls and renders floating toast notifications.
 */
export function XpToastContainer() {
  const [toasts, setToasts] = useState<XpEvent[]>([]);

  const handleEvent = useCallback((evt: XpEvent) => {
    setToasts((prev) => [...prev, evt]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== evt.id));
    }, 3000);
  }, []);

  useEffect(() => {
    _listeners.push(handleEvent);
    return () => {
      _listeners = _listeners.filter((fn) => fn !== handleEvent);
    };
  }, [handleEvent]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto bg-panel border border-primary/25 rounded-lg px-4 py-3 shadow-xl shadow-black/20 flex items-center gap-3 min-w-[200px]"
          style={{
            animation: "xp-toast-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          }}
        >
          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <Zap size={14} className="text-primary" />
          </div>
          <div>
            <div className="text-primary text-sm font-bold font-mono">+{t.amount} XP</div>
            <div className="text-text-muted text-[11px]">{t.reason}</div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes xp-toast-in {
          0% { opacity: 0; transform: translateX(40px) scale(0.9); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
