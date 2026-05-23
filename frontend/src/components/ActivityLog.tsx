export type LogLevel = "info" | "critical" | "warning" | "success" | "index";

export interface LogEntry {
  time: string;
  agent: string;
  message: string;
  level?: LogLevel;
}

const dotColor: Record<LogLevel, string> = {
  info: "bg-info",
  critical: "bg-critical",
  warning: "bg-warning",
  success: "bg-success",
  index: "bg-primary",
};

export function ActivityLog({
  entries,
  active,
  emptyText = "Waiting for query...",
}: {
  entries: LogEntry[];
  active?: boolean;
  emptyText?: string;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-10 px-4 flex items-center justify-between border-b border-border shrink-0">
        <span className="section-label">Activity Log</span>
        <span
          className={`w-2 h-2 rounded-full ${
            active ? "qm-pulse-dot" : "bg-text-disabled"
          }`}
          style={{ width: 6, height: 6 }}
        />
      </div>
      <div className="flex-1 overflow-auto qm-scroll p-3 font-mono text-[13px] leading-relaxed">
        {entries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-text-disabled">
            {emptyText}
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e, i) => (
              <div key={i} className="flex items-start gap-2 qm-fade-in">
                <span
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                    dotColor[e.level ?? "info"]
                  }`}
                />
                <span className="text-text-disabled text-[11px] w-14 shrink-0 pt-px">
                  {e.time}
                </span>
                <span className="text-text-secondary text-[12px] font-medium w-16 shrink-0 pt-px">
                  {e.agent}
                </span>
                <span className="text-text-primary text-[13px] min-w-0 break-words">
                  {e.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
