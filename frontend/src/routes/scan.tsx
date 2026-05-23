import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { ActivityLog, type LogEntry } from "@/components/ActivityLog";
import { scanFiles, type SSEEvent } from "@/lib/api";
import type { DiscoveredQuery } from "@/lib/mock-data";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan Project — QueryMind" },
      { name: "description", content: "Upload code files to find every SQL query in your project." },
    ],
  }),
  component: ScanPage,
});

interface UploadedFile {
  name: string;
  size: number;
  content: string;
}

function ScanPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);
  const [queries, setQueries] = useState<DiscoveredQuery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: UploadedFile[] = [];
    for (const f of Array.from(fileList)) {
      const content = await f.text();
      newFiles.push({ name: f.name, size: f.size, content });
    }
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const runScan = () => {
    if (files.length === 0) {
      setError("Upload files first");
      return;
    }

    setScanning(true);
    setLog([]);
    setDone(false);
    setQueries([]);
    setError(null);

    scanFiles(
      files.map((f) => ({ name: f.name, content: f.content })),
      (event: SSEEvent) => {
        const entry: LogEntry = {
          time: event.time ? `${event.time}s` : "",
          agent: event.agent || "scanner",
          message: event.message || "",
          level: event.type === "complete" ? "success" : event.type === "agent_error" ? "critical" : "info",
        };
        setLog((prev) => [...prev, entry]);

        if (event.type === "complete" && event.result?.queries) {
          const discovered: DiscoveredQuery[] = event.result.queries.map((q: any) => ({
            severity: "warning" as const,
            path: `${q.file}:${q.line}`,
            preview: q.sql.slice(0, 80) + (q.sql.length > 80 ? "..." : ""),
            language: q.language,
            sql: q.sql,
          }));
          setQueries(discovered);
          setDone(true);
          setScanning(false);
        }

        if (event.type === "error") {
          setError(event.message || "Scan failed");
          setScanning(false);
        }
      },
      (errMsg) => {
        setError(errMsg);
        setScanning(false);
        setLog((prev) => [
          ...prev,
          { time: "", agent: "error", message: errMsg, level: "critical" },
        ]);
      },
    );
  };

  const right = (
    <button
      onClick={runScan}
      disabled={scanning}
      className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
    >
      {scanning ? "Scanning..." : "Scan Files"}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar showBack right={right} />
      <main className="flex-1 px-6 py-6 max-w-[1280px] mx-auto w-full">
        {/* Upload Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            readFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`bg-panel rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors h-[180px] ${
            dragOver ? "border-2 border-dashed border-primary" : "border-2 border-dashed border-border"
          }`}
        >
          <Upload size={28} className="text-text-disabled" />
          <div className="mt-3 text-text-secondary text-sm">
            Drop files here or click to browse
          </div>
          <div className="mt-1 text-text-disabled text-xs font-mono">
            .py .js .ts .java .sql .env
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => readFiles(e.target.files)}
          />
        </div>

        {error && (
          <div className="mt-4 p-3 text-critical text-sm font-mono bg-panel border border-critical/30 rounded-lg">
            {error}
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-4 bg-panel border border-border rounded-lg divide-y divide-elevated">
            {files.map((f, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="font-mono text-text-primary truncate">{f.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-text-muted text-xs">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles((p) => p.filter((_, idx) => idx !== i));
                    }}
                    className="text-text-muted hover:text-critical transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(scanning || done) && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[40fr_60fr] gap-4 min-h-[520px]">
            <div className="bg-panel border border-border rounded-lg overflow-hidden flex flex-col">
              <ActivityLog entries={log} active={scanning} emptyText="Waiting..." />
            </div>

            <div className="bg-panel border border-border rounded-lg flex flex-col overflow-hidden">
              <div className="h-10 px-4 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="section-label">Queries Found</span>
                  <span className="text-[11px] font-mono bg-secondary text-text-secondary px-1.5 py-0.5 rounded">
                    {done ? queries.length : 0}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-auto qm-scroll">
                {done &&
                  queries.map((q, i) => (
                    <div
                      key={i}
                      className="px-4 py-2.5 border-b border-elevated flex items-center gap-3 hover:bg-elevated/60 transition-colors"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          q.severity === "critical"
                            ? "bg-critical"
                            : q.severity === "warning"
                            ? "bg-warning"
                            : "bg-success"
                        }`}
                      />
                      <span className="font-mono text-[12.5px] text-primary shrink-0">
                        {q.path}
                      </span>
                      <span className="font-mono text-[12.5px] text-text-secondary truncate flex-1 min-w-0">
                        {q.preview}
                      </span>
                      <span className="text-[11px] font-mono bg-secondary text-text-secondary px-1.5 py-0.5 rounded">
                        {q.language}
                      </span>
                      <Link
                        to="/quick"
                        search={{ q: q.sql }}
                        className="text-primary text-xs font-medium hover:text-primary/80 transition-colors shrink-0"
                      >
                        Analyze →
                      </Link>
                    </div>
                  ))}
              </div>
              {done && queries.length > 0 && (
                <div className="border-t border-border p-3 flex items-center gap-2 justify-end">
                  <button className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
                    Analyze All
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
