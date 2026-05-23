import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Upload, X, Github, FolderOpen, RefreshCw, Trash2, Code } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { AuthGuard } from "@/components/AuthGuard";
import { ActivityLog, type LogEntry } from "@/components/ActivityLog";
import { scanFiles, type SSEEvent } from "@/lib/api";
import type { DiscoveredQuery } from "@/lib/mock-data";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan Project — QueryMind" },
      { name: "description", content: "Upload local folders, files or import GitHub repositories to discover SQL queries." },
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
  const [activeTab, setActiveTab] = useState<"local" | "github">("local");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);
  const [queries, setQueries] = useState<DiscoveredQuery[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage for Workspace Persistence
  useEffect(() => {
    try {
      const savedFiles = localStorage.getItem("qm_scan_files");
      const savedQueries = localStorage.getItem("qm_scan_queries");
      const savedLog = localStorage.getItem("qm_scan_log");
      const savedDone = localStorage.getItem("qm_scan_done");
      if (savedFiles) setFiles(JSON.parse(savedFiles));
      if (savedQueries) setQueries(JSON.parse(savedQueries));
      if (savedLog) setLog(JSON.parse(savedLog));
      if (savedDone) setDone(JSON.parse(savedDone));
    } catch (e) {
      console.error("Failed to restore workspace session state:", e);
    }
  }, []);

  // Save changes to localStorage to persist workspace state
  useEffect(() => {
    try {
      localStorage.setItem("qm_scan_files", JSON.stringify(files));
    } catch {}
  }, [files]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_scan_queries", JSON.stringify(queries));
    } catch {}
  }, [queries]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_scan_log", JSON.stringify(log));
    } catch {}
  }, [log]);

  useEffect(() => {
    try {
      localStorage.setItem("qm_scan_done", JSON.stringify(done));
    } catch {}
  }, [done]);

  const clearWorkspace = () => {
    setFiles([]);
    setQueries([]);
    setLog([]);
    setDone(false);
    setError(null);
    try {
      localStorage.removeItem("qm_scan_files");
      localStorage.removeItem("qm_scan_queries");
      localStorage.removeItem("qm_scan_log");
      localStorage.removeItem("qm_scan_done");
    } catch {}
  };

  const readFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: UploadedFile[] = [];
    setError(null);
    for (const f of Array.from(fileList)) {
      const extension = f.name.split(".").pop()?.toLowerCase();
      const allowed = ["py", "js", "ts", "tsx", "java", "sql", "env", "go", "rb", "php", "cs", "cpp"];
      if (extension && allowed.includes(extension)) {
        try {
          const content = await f.text();
          newFiles.push({ name: f.name, size: f.size, content });
        } catch (e) {
          console.error(`Failed to read file ${f.name}`);
        }
      }
    }
    if (newFiles.length === 0) {
      setError("No supported code files found in selection");
      return;
    }
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const importFromGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;

    // Parse owner/repo from URL
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      setError("Invalid GitHub repository URL. Use format: https://github.com/owner/repo");
      return;
    }

    const [_, owner, rawRepo] = match;
    const repo = rawRepo.replace(/\.git$/, "");
    setScanning(true);
    setLog([]);
    setQueries([]);
    setDone(false);
    setError(null);

    const logMsg = (msg: string, level: "info" | "success" | "critical" = "info") => {
      setLog((prev) => [...prev, { time: "", agent: "GitHub client", message: msg, level }]);
    };

    logMsg(`Accessing public GitHub tree for ${owner}/${repo}...`);

    try {
      // Step 1: Fetch main tree
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
      if (!res.ok) {
        throw new Error("Repository main branch not found or private repository");
      }
      const treeData = await res.json();
      
      // Filter out code files
      const codeFiles = treeData.tree.filter((node: any) => {
        if (node.type !== "blob") return false;
        const ext = node.path.split(".").pop()?.toLowerCase();
        return ["py", "js", "ts", "tsx", "java", "sql", "go", "rb", "php"].includes(ext || "");
      }).slice(0, 15); // Limit to 15 files to fit payload safely

      if (codeFiles.length === 0) {
        throw new Error("No supported code files found in the main branch of this repository.");
      }

      logMsg(`Found ${codeFiles.length} source code files. Starting file download...`, "success");

      const loadedFiles: UploadedFile[] = [];
      for (const file of codeFiles) {
        logMsg(`Fetching raw content for ${file.path}...`);
        const fileRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${file.path}`);
        if (fileRes.ok) {
          const text = await fileRes.text();
          loadedFiles.push({
            name: file.path,
            size: text.length,
            content: text
          });
        }
      }

      setFiles((prev) => [...prev, ...loadedFiles]);
      logMsg(`Successfully imported ${loadedFiles.length} files from GitHub!`, "success");
      setScanning(false);
    } catch (err: any) {
      setError(err.message || "Failed to load GitHub repository");
      logMsg(err.message || "Connection failed", "critical");
      setScanning(false);
    }
  };

  const runScan = () => {
    if (files.length === 0) {
      setError("Upload files or load a GitHub repository first");
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
          agent: event.agent || "Scanner Agent",
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
          { time: "", agent: "Error Handler", message: errMsg, level: "critical" },
        ]);
      },
    );
  };

  const right = (
    <div className="flex items-center gap-2">
      {files.length > 0 && (
        <button
          onClick={clearWorkspace}
          className="border border-border text-text-secondary hover:text-critical text-sm font-medium px-3 py-1.5 rounded-md hover:bg-elevated/40 transition-colors flex items-center gap-1.5"
          title="Clear active workspace files and cached results"
        >
          <Trash2 size={13} />
          <span>Clear Workspace</span>
        </button>
      )}
      <button
        onClick={runScan}
        disabled={scanning || files.length === 0}
        className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5"
      >
        {scanning ? (
          <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
        ) : (
          <RefreshCw size={13} />
        )}
        <span>{scanning ? "Scanning..." : "Scan Workspace"}</span>
      </button>
    </div>
  );

  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col bg-background">
        <TopBar showBack right={right} />
        
        <main className="flex-1 px-6 py-6 max-w-[1280px] mx-auto w-full space-y-6">
          {/* Workspace persistence information header */}
          <div className="bg-panel border border-border rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-text-primary text-[13px] font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
              <span>Workspace Session Active</span>
              <span className="text-text-disabled">|</span>
              <span className="text-text-muted">{files.length} Files loaded</span>
              {queries.length > 0 && (
                <>
                  <span className="text-text-disabled">|</span>
                  <span className="text-primary">{queries.length} SQL queries cached</span>
                </>
              )}
            </div>
            <div className="text-xs text-text-disabled font-mono">
              Saved automatically to browser local storage.
            </div>
          </div>

          {/* Connection tabs */}
          <div className="border-b border-border flex gap-1">
            <button
              onClick={() => setActiveTab("local")}
              className={`px-4 py-2 text-sm font-medium border-b-2 font-mono transition-colors flex items-center gap-2 ${
                activeTab === "local"
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <FolderOpen size={14} />
              Local Files & Folders
            </button>
            <button
              onClick={() => setActiveTab("github")}
              className={`px-4 py-2 text-sm font-medium border-b-2 font-mono transition-colors flex items-center gap-2 ${
                activeTab === "github"
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <Github size={14} />
              GitHub Repository Import
            </button>
          </div>

          {/* Content Pane */}
          {activeTab === "local" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* File Dropzone */}
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
                onClick={() => fileInputRef.current?.click()}
                className={`bg-panel rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors h-[200px] border-2 ${
                  dragOver ? "border-dashed border-primary" : "border-dashed border-border hover:border-text-disabled"
                }`}
              >
                <Upload size={28} className="text-text-disabled" />
                <div className="mt-3 text-text-secondary text-sm font-semibold">
                  Drag & Drop files or click to browse
                </div>
                <div className="mt-1.5 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="bg-secondary text-text-primary text-xs font-mono px-2.5 py-1 rounded border border-border hover:bg-elevated transition-colors"
                  >
                    Select Files
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      folderInputRef.current?.click();
                    }}
                    className="bg-secondary text-text-primary text-xs font-mono px-2.5 py-1 rounded border border-border hover:bg-elevated transition-colors flex items-center gap-1"
                  >
                    <FolderOpen size={11} />
                    Select Folder
                  </button>
                </div>
                <div className="mt-2 text-text-disabled text-xs font-mono">
                  Supported: .py .js .ts .tsx .java .sql
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => readFiles(e.target.files)}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  webkitdirectory=""
                  directory=""
                  hidden
                  onChange={(e) => readFiles(e.target.files)}
                  {...({} as any)}
                />
              </div>

              {/* Loader description card */}
              <div className="bg-panel border border-border rounded-lg p-5 flex flex-col justify-center space-y-3 font-mono text-[13px] text-text-secondary">
                <div className="flex items-center gap-2 text-text-primary font-bold">
                  <Code size={16} className="text-primary" />
                  <span>Developer Directory Scanner</span>
                </div>
                <p className="text-xs leading-relaxed text-text-muted">
                  Import entire codebase directories dynamically. Our parsing agent traverses loaded source lines recursively to isolate and run analysis on raw DML database statements.
                </p>
                <div className="border-t border-border pt-3 mt-1 grid grid-cols-2 gap-2 text-xs">
                  <div>• Supports nesting folders</div>
                  <div>• Parses in-memory safely</div>
                  <div>• No server file-storage</div>
                  <div>• Automatic language tagging</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-panel border border-border rounded-lg p-6">
              <div className="max-w-[640px] space-y-4">
                <div className="flex items-center gap-2">
                  <Github className="text-text-primary" size={20} />
                  <h3 className="text-text-primary font-mono font-bold text-sm">Import Public Repository</h3>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Provide a public GitHub repository URL. We'll automatically clone and traverse its file tree recursively using standard REST fetch queries to index SQL constructs.
                </p>
                <form onSubmit={importFromGithub} className="flex gap-2">
                  <input
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="flex-1 bg-code border border-border rounded-md px-3 py-2 font-mono text-[13px] text-text-primary focus:outline-none focus:border-primary placeholder:text-text-disabled"
                  />
                  <button
                    type="submit"
                    disabled={scanning || !githubUrl.trim()}
                    className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    Load Files
                  </button>
                </form>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 text-critical text-sm font-mono bg-panel border border-critical/30 rounded-lg">
              Error: {error}
            </div>
          )}

          {/* Files List Panel */}
          {files.length > 0 && (
            <div className="bg-panel border border-border rounded-lg overflow-hidden">
              <div className="h-10 px-4 flex items-center justify-between border-b border-border">
                <span className="section-label">Workspace Files</span>
                <span className="text-xs font-mono text-text-disabled">Total Size: {(files.reduce((a, b) => a + b.size, 0) / 1024).toFixed(1)} KB</span>
              </div>
              <div className="max-h-[220px] overflow-auto qm-scroll divide-y divide-elevated">
                {files.map((f, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm hover:bg-elevated/20 transition-colors">
                    <span className="font-mono text-text-primary truncate max-w-[500px]">{f.name}</span>
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
            </div>
          )}

          {/* Scanned/Streaming Results View */}
          {(scanning || done) && (
            <div className="grid grid-cols-1 lg:grid-cols-[40fr_60fr] gap-4 min-h-[520px]">
              <div className="bg-panel border border-border rounded-lg overflow-hidden flex flex-col">
                <ActivityLog entries={log} active={scanning} emptyText="Waiting..." />
              </div>

              <div className="bg-panel border border-border rounded-lg flex flex-col overflow-hidden">
                <div className="h-10 px-4 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="section-label">Queries Discovered</span>
                    <span className="text-[11px] font-mono bg-secondary text-text-secondary px-1.5 py-0.5 rounded">
                      {done ? queries.length : 0}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-auto qm-scroll">
                  {done && queries.length === 0 && (
                    <div className="h-full flex items-center justify-center font-mono text-[13px] text-text-disabled">
                      0 SQL statements discovered
                    </div>
                  )}
                  {done &&
                    queries.map((q, i) => (
                      <div
                        key={i}
                        className="px-4 py-3 border-b border-elevated flex items-center gap-3 hover:bg-elevated/40 transition-colors"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-warning shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[12px] text-primary truncate">
                            {q.path}
                          </div>
                          <div className="font-mono text-[12.5px] text-text-secondary truncate mt-0.5">
                            {q.preview}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono bg-secondary text-text-secondary px-1.5 py-0.5 rounded shrink-0">
                          {q.language}
                        </span>
                        <Link
                          to="/quick"
                          search={{ q: q.sql }}
                          className="text-primary text-xs font-mono font-medium hover:text-primary/80 transition-colors shrink-0 px-2 py-1 rounded bg-secondary border border-border"
                        >
                          Analyze →
                        </Link>
                      </div>
                    ))}
                </div>
                {done && queries.length > 0 && (
                  <div className="border-t border-border p-3 flex items-center justify-end">
                    <div className="text-xs font-mono text-text-disabled flex-1">
                      Click "Analyze" to copy any slow query into the quick optimizer sandbox.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
