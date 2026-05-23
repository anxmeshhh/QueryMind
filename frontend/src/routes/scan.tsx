import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Upload, X, Github, FolderOpen, RefreshCw, Trash2, Code, Play, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, Trophy, Star, Zap, Key, Table2, ArrowUpRight, Clock, Layers } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { AuthGuard } from "@/components/AuthGuard";
import { ActivityLog, type LogEntry } from "@/components/ActivityLog";
import { scanFiles, analyzeBatch, type SSEEvent } from "@/lib/api";
import { saveScanResult, fetchRecentScans, type DBAnalysis } from "@/lib/history";
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

interface SchemaTable {
  name: string;
  columns: any[];
  indexes: any[];
  primary_key: string[];
  foreign_keys: any[];
}

interface CodebaseOptimization {
  file: string;
  line: string;
  original: string;
  optimized: string;
  scoreBefore: number;
  scoreAfter: number;
  issues: any[];
  indexes: any[];
  guard?: any;
}

interface AggregateImpact {
  avgScoreBefore: number;
  avgScoreAfter: number;
  speedupFactor: string;
  totalIssuesCount: number;
  uniqueIndexes: any[];
  optimizations: CodebaseOptimization[];
  unchangedCount: number;
  blockedIndexes: number;
  safetyScore: number;
}

// Gamification
const XP_PER_QUERY = 25;
const XP_PER_ISSUE = 10;
const BADGES = [
  { id: "first_scan", icon: "🔍", name: "First Scan", desc: "Scan your first project", threshold: 1 },
  { id: "bug_hunter", icon: "🐛", name: "Bug Hunter", desc: "Find 10+ anti-patterns", threshold: 10 },
  { id: "optimizer", icon: "⚡", name: "Optimizer", desc: "Optimize 5+ queries", threshold: 5 },
  { id: "guardian", icon: "🛡️", name: "Schema Guardian", desc: "100% safety score", threshold: 100 },
  { id: "completionist", icon: "🏆", name: "Completionist", desc: "Analyze 20+ queries", threshold: 20 },
];

const langColor: Record<string, string> = {
  ".py": "qm-lang-py", ".js": "qm-lang-js", ".ts": "qm-lang-ts",
  ".tsx": "qm-lang-ts", ".java": "qm-lang-java", ".sql": "qm-lang-sql",
  ".go": "qm-lang-go", ".rb": "qm-lang-rb", ".php": "qm-lang-php",
};

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

  // Project context
  const [projectSchema, setProjectSchema] = useState<SchemaTable[]>([]);
  const [ormModels, setOrmModels] = useState<any[]>([]);
  const [fileStats, setFileStats] = useState<any[]>([]);
  const [schemaDdl, setSchemaDdl] = useState<any[]>([]);

  // Batch analysis
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [aggregateResult, setAggregateResult] = useState<AggregateImpact | null>(null);
  const [selectedOptQuery, setSelectedOptQuery] = useState<CodebaseOptimization | null>(null);

  // Gamification
  const [xp, setXp] = useState(() => parseInt(localStorage.getItem("qm_xp") || "0"));
  const [recentScans, setRecentScans] = useState<DBAnalysis[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage for Workspace Persistence
  useEffect(() => {
    try {
      const savedFiles = localStorage.getItem("qm_scan_files");
      const savedQueries = localStorage.getItem("qm_scan_queries");
      const savedLog = localStorage.getItem("qm_scan_log");
      const savedDone = localStorage.getItem("qm_scan_done");
      const savedAggregate = localStorage.getItem("qm_scan_aggregate");
      const savedSchema = localStorage.getItem("qm_scan_project_schema");
      const savedFileStats = localStorage.getItem("qm_scan_file_stats");
      
      if (savedFiles) setFiles(JSON.parse(savedFiles));
      if (savedQueries) setQueries(JSON.parse(savedQueries));
      if (savedLog) setLog(JSON.parse(savedLog));
      if (savedDone) setDone(JSON.parse(savedDone));
      if (savedSchema) setProjectSchema(JSON.parse(savedSchema));
      if (savedFileStats) setFileStats(JSON.parse(savedFileStats));
      if (savedAggregate) {
        const parsed = JSON.parse(savedAggregate);
        setAggregateResult(parsed);
        if (parsed.optimizations?.length > 0) {
          setSelectedOptQuery(parsed.optimizations[0]);
        }
      }
    } catch (e) {
      console.error("Failed to restore workspace session state:", e);
    }
    // Load recent scans for empty state
    fetchRecentScans(5).then(setRecentScans);
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

  useEffect(() => {
    try {
      if (aggregateResult) {
        localStorage.setItem("qm_scan_aggregate", JSON.stringify(aggregateResult));
      } else {
        localStorage.removeItem("qm_scan_aggregate");
      }
    } catch {}
  }, [aggregateResult]);

  const clearWorkspace = () => {
    setFiles([]);
    setQueries([]);
    setLog([]);
    setDone(false);
    setError(null);
    setAggregateResult(null);
    setSelectedOptQuery(null);
    setProjectSchema([]);
    setOrmModels([]);
    setFileStats([]);
    setSchemaDdl([]);
    try {
      localStorage.removeItem("qm_scan_files");
      localStorage.removeItem("qm_scan_queries");
      localStorage.removeItem("qm_scan_log");
      localStorage.removeItem("qm_scan_done");
      localStorage.removeItem("qm_scan_aggregate");
      localStorage.removeItem("qm_scan_project_schema");
      localStorage.removeItem("qm_scan_file_stats");
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
    setAggregateResult(null);

    const logMsg = (msg: string, level: "info" | "success" | "critical" = "info") => {
      setLog((prev) => [...prev, { time: "", agent: "GitHub client", message: msg, level }]);
    };

    logMsg(`Accessing public GitHub tree for ${owner}/${repo}...`);

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
      if (!res.ok) {
        throw new Error("Repository main branch not found or private repository");
      }
      const treeData = await res.json();
      
      const codeFiles = treeData.tree.filter((node: any) => {
        if (node.type !== "blob") return false;
        const ext = node.path.split(".").pop()?.toLowerCase();
        return ["py", "js", "ts", "tsx", "java", "sql", "go", "rb", "php"].includes(ext || "");
      }).slice(0, 15);

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
    setAggregateResult(null);
    setError(null);
    setProjectSchema([]);
    setOrmModels([]);
    setSchemaDdl([]);

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

        // Capture project schema from schema_builder agent
        if (event.type === "agent_done" && event.agent === "schema_builder" && event.data?.tables) {
          setProjectSchema(event.data.tables);
          try { localStorage.setItem("qm_scan_project_schema", JSON.stringify(event.data.tables)); } catch {}
        }

        if (event.type === "complete" && event.result?.queries) {
          const discovered: DiscoveredQuery[] = event.result.queries.map((q: any) => ({
            severity: "warning" as const,
            path: `${q.file}:${q.line}`,
            preview: q.sql.slice(0, 80) + (q.sql.length > 80 ? "..." : ""),
            language: q.language,
            sql: q.sql,
          }));
          setQueries(discovered);

          // Capture project context
          if (event.result.project_schema) {
            setProjectSchema(event.result.project_schema);
            try { localStorage.setItem("qm_scan_project_schema", JSON.stringify(event.result.project_schema)); } catch {}
          }
          if (event.result.orm_models) setOrmModels(event.result.orm_models);
          if (event.result.schema_ddl) setSchemaDdl(event.result.schema_ddl);
          if (event.result.file_stats) {
            setFileStats(event.result.file_stats);
            try { localStorage.setItem("qm_scan_file_stats", JSON.stringify(event.result.file_stats)); } catch {}
          }

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

  // Batch analysis using the new /analyze-batch endpoint with project context
  const batchAnalyzeQueries = () => {
    if (queries.length === 0) return;
    setAnalyzingAll(true);
    setProgress({ current: 0, total: queries.length });
    setAggregateResult(null);

    const queryPayloads = queries.map((q) => ({
      sql: q.sql,
      file: q.path.split(":")[0],
      line: parseInt(q.path.split(":")[1]) || 0,
    }));

    const results: CodebaseOptimization[] = [];

    analyzeBatch(
      queryPayloads,
      projectSchema,
      "postgresql",
      (event: SSEEvent) => {
        if (event.type === "batch_progress" && event.data) {
          setProgress({ current: event.data.current, total: event.data.total });
        }

        if (event.type === "batch_item_done" && event.data) {
          const d = event.data;
          results.push({
            file: d.file,
            line: String(d.line),
            original: d.sql,
            optimized: d.optimized || d.sql,
            scoreBefore: d.score_before,
            scoreAfter: d.score_after,
            issues: d.issues || [],
            indexes: d.indexes || [],
            guard: d.guard,
          });
        }

        if (event.type === "complete" && event.result) {
          const agg = event.result.aggregate;
          const allIssues = results.flatMap((r) => r.issues);
          const allIndexes = results.flatMap((r) => r.indexes);
          const uniqueIndexes = allIndexes.filter((idx, index, self) =>
            self.findIndex((t) => JSON.stringify(t) === JSON.stringify(idx)) === index
          );

          const payload: AggregateImpact = {
            avgScoreBefore: agg?.avg_score_before ?? Math.round(results.reduce((a, b) => a + b.scoreBefore, 0) / Math.max(1, results.length)),
            avgScoreAfter: agg?.avg_score_after ?? Math.round(results.reduce((a, b) => a + b.scoreAfter, 0) / Math.max(1, results.length)),
            speedupFactor: ((agg?.avg_score_after ?? 75) / Math.max(1, agg?.avg_score_before ?? 50)).toFixed(1),
            totalIssuesCount: agg?.total_issues ?? allIssues.length,
            uniqueIndexes,
            optimizations: results,
            unchangedCount: agg?.unchanged_queries ?? 0,
            blockedIndexes: agg?.total_indexes_blocked ?? 0,
            safetyScore: results.length > 0 ? Math.round(results.reduce((a, r) => a + (r.guard?.safety_score ?? 100), 0) / results.length) : 100,
          };

          setAggregateResult(payload);
          if (results.length > 0) setSelectedOptQuery(results[0]);

          // Gamification: award XP
          const earnedXp = results.length * XP_PER_QUERY + allIssues.length * XP_PER_ISSUE;
          setXp((prev) => {
            const newXp = prev + earnedXp;
            try { localStorage.setItem("qm_xp", String(newXp)); } catch {}
            return newXp;
          });

          // Save to history
          saveScanResult(queries.length, payload, "postgresql", projectSchema);

          setAnalyzingAll(false);
        }

        if (event.type === "error") {
          setError(event.message || "Batch analysis failed");
          setAnalyzingAll(false);
        }
      },
      (errMsg) => {
        setError(errMsg);
        setAnalyzingAll(false);
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
          {/* ── Step Progress + Workspace Status Bar ─────────── */}
          <div className="bg-panel border border-border rounded-lg px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-text-primary text-[13px] font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <span>Workspace Session Active</span>
                <span className="text-text-disabled">|</span>
                <span className="text-text-muted">{files.length} Files loaded</span>
                {queries.length > 0 && (
                  <>
                    <span className="text-text-disabled">|</span>
                    <span className="text-primary">{queries.length} SQL queries</span>
                  </>
                )}
                {projectSchema.length > 0 && (
                  <>
                    <span className="text-text-disabled">|</span>
                    <span className="text-emerald-400">{projectSchema.length} tables mapped</span>
                  </>
                )}
              </div>
              {/* XP Badge */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <Trophy size={12} className="text-yellow-500" />
                  <span className="text-text-secondary">{xp} XP</span>
                  <span className="text-text-disabled">·</span>
                  <span className="text-text-muted">Lv.{Math.floor(xp / 200) + 1}</span>
                </div>
                <div className="qm-xp-bar w-20">
                  <div className="qm-xp-fill" style={{ width: `${(xp % 200) / 2}%` }} />
                </div>
              </div>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center gap-1">
              <div className="qm-step">
                <div className={`qm-step-badge ${files.length > 0 ? "done" : "active"}`}>1</div>
                <span className="text-xs font-mono text-text-secondary">Import</span>
              </div>
              <div className={`qm-step-connector ${files.length > 0 ? "done" : ""}`} />
              <div className="qm-step">
                <div className={`qm-step-badge ${done ? "done" : files.length > 0 ? "active" : ""}`}>2</div>
                <span className="text-xs font-mono text-text-secondary">Scan</span>
              </div>
              <div className={`qm-step-connector ${done ? "done" : ""}`} />
              <div className="qm-step">
                <div className={`qm-step-badge ${aggregateResult ? "done" : done ? "active" : ""}`}>3</div>
                <span className="text-xs font-mono text-text-secondary">Optimize</span>
              </div>
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

              <div className="bg-panel border border-border rounded-lg p-5 flex flex-col justify-center space-y-3 font-mono text-[13px] text-text-secondary">
                <div className="flex items-center gap-2 text-text-primary font-bold">
                  <Code size={16} className="text-primary" />
                  <span>Developer Directory Traversal</span>
                </div>
                <p className="text-xs leading-relaxed text-text-muted">
                  Import codebase directories dynamically. Our scanning pipeline extracts raw DML statements from source lines to run a complete, aggregate database safety check.
                </p>
                <div className="border-t border-border pt-3 mt-1 grid grid-cols-2 gap-2 text-xs">
                  <div>• Traverses folders</div>
                  <div>• Local sandbox safety</div>
                  <div>• No server file-storage</div>
                  <div>• Language tagging</div>
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
                  Provide a public GitHub repository URL. We'll recursively search its main tree and fetch files to map their queries directly to our AI scanning queue.
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
          {files.length > 0 && !scanning && !done && (
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

          {/* ── Project Overview (visible after files loaded, before scan) ── */}
          {files.length > 0 && !scanning && !done && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
              {/* File Explorer with Language Dots */}
              <div className="bg-panel border border-border rounded-lg overflow-hidden">
                <div className="h-10 px-4 flex items-center justify-between border-b border-border">
                  <span className="section-label flex items-center gap-1.5"><Layers size={12} className="text-primary" /> Project Files</span>
                  <span className="text-xs font-mono text-text-disabled">{(files.reduce((a, b) => a + b.size, 0) / 1024).toFixed(1)} KB</span>
                </div>
                <div className="max-h-[260px] overflow-auto qm-scroll p-2 space-y-0.5">
                  {files.map((f, i) => {
                    const ext = "." + f.name.split(".").pop()?.toLowerCase();
                    return (
                      <div key={i} className="qm-file-item group">
                        <span className={`qm-lang-dot ${langColor[ext] || "qm-lang-other"}`} />
                        <span className="truncate flex-1">{f.name}</span>
                        <span className="text-[10px] text-text-disabled">{(f.size / 1024).toFixed(1)}KB</span>
                        <button
                          onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                          className="text-text-disabled hover:text-critical opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {/* Language Distribution Bar */}
                {(() => {
                  const counts: Record<string, number> = {};
                  files.forEach((f) => {
                    const ext = "." + f.name.split(".").pop()?.toLowerCase();
                    counts[ext] = (counts[ext] || 0) + 1;
                  });
                  const total = files.length;
                  const colors: Record<string, string> = { ".py": "#3572A5", ".js": "#f1e05a", ".ts": "#3178c6", ".tsx": "#3178c6", ".java": "#b07219", ".sql": "#e38c00", ".go": "#00ADD8" };
                  return (
                    <div className="px-4 py-3 border-t border-border space-y-2">
                      <div className="qm-lang-bar">
                        {Object.entries(counts).map(([ext, c]) => (
                          <div key={ext} style={{ width: `${(c / total) * 100}%`, background: colors[ext] || "#52525b" }} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(counts).map(([ext, c]) => (
                          <div key={ext} className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
                            <span className={`qm-lang-dot ${langColor[ext] || "qm-lang-other"}`} style={{ width: 6, height: 6 }} />
                            {ext} ({c})
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Quick Stats + Scan CTA */}
              <div className="space-y-4">
                <div className="bg-panel border border-border rounded-lg p-5 space-y-4">
                  <div className="flex items-center gap-2 text-text-primary font-mono font-bold text-sm">
                    <Zap size={16} className="text-primary" />
                    Ready to Scan
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-code rounded-lg p-3 text-center">
                      <div className="text-2xl font-mono font-bold text-text-primary">{files.length}</div>
                      <div className="text-[10px] font-mono text-text-muted mt-1">SOURCE FILES</div>
                    </div>
                    <div className="bg-code rounded-lg p-3 text-center">
                      <div className="text-2xl font-mono font-bold text-text-primary">
                        {files.reduce((a, b) => a + b.content.split("\n").length, 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] font-mono text-text-muted mt-1">TOTAL LINES</div>
                    </div>
                    <div className="bg-code rounded-lg p-3 text-center">
                      <div className="text-2xl font-mono font-bold text-primary">
                        {Object.keys(files.reduce((a, f) => { const e = "." + f.name.split(".").pop(); a[e] = 1; return a; }, {} as Record<string, number>)).length}
                      </div>
                      <div className="text-[10px] font-mono text-text-muted mt-1">LANGUAGES</div>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted font-mono leading-relaxed">
                    Our scanner will parse every file for embedded SQL (SELECT, INSERT, UPDATE, DELETE), 
                    extract CREATE TABLE definitions to build a project schema, and detect ORM model definitions.
                  </p>
                  <button
                    onClick={runScan}
                    disabled={scanning}
                    className="w-full bg-primary text-primary-foreground text-sm font-bold py-2.5 rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Play size={14} /> Begin Codebase Scan
                  </button>
                </div>

                {/* Achievements Preview */}
                <div className="bg-panel border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={14} className="text-yellow-500" />
                    <span className="section-label">Achievements</span>
                  </div>
                  <div className="flex gap-2">
                    {BADGES.map((b) => {
                      const earned = b.id === "first_scan" ? xp > 0 : false;
                      return (
                        <div key={b.id} className={`qm-badge-icon ${earned ? "earned" : ""}`} title={`${b.name}: ${b.desc}`}>
                          {b.icon}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Recent Scans (shown only when no files loaded) ── */}
          {files.length === 0 && !scanning && !done && recentScans.length > 0 && (
            <div className="bg-panel border border-border rounded-lg overflow-hidden">
              <div className="h-10 px-4 flex items-center border-b border-border">
                <span className="section-label flex items-center gap-1.5"><Clock size={12} className="text-primary" /> Recent Scans</span>
              </div>
              <div className="divide-y divide-elevated">
                {recentScans.map((scan) => (
                  <div key={scan.id} className="px-4 py-3 flex items-center justify-between hover:bg-elevated/30 transition-colors">
                    <div>
                      <div className="text-xs font-mono text-text-primary">{scan.original_query}</div>
                      <div className="text-[10px] font-mono text-text-disabled mt-0.5">
                        {new Date(scan.created_at).toLocaleDateString()} · {scan.dialect}
                      </div>
                    </div>
                    {scan.performance_score_before !== null && (
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        <span className="text-critical">{scan.performance_score_before}</span>
                        <span className="text-text-disabled">→</span>
                        <span className="text-success">{scan.performance_score_after}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ERD Schema Diagram (shown after scan discovers schema) ── */}
          {done && projectSchema.length > 0 && !aggregateResult && (
            <div className="bg-panel border border-border rounded-lg overflow-hidden">
              <div className="h-10 px-4 flex items-center justify-between border-b border-border">
                <span className="section-label flex items-center gap-1.5"><Table2 size={12} className="text-primary" /> Discovered Database Schema (ERD)</span>
                <span className="text-[10px] font-mono text-text-disabled">{projectSchema.length} tables · {projectSchema.reduce((a, t) => a + (t.columns?.length || 0), 0)} columns</span>
              </div>
              <div className="p-4 qm-erd-grid">
                {projectSchema.map((table, i) => (
                  <div key={i} className="qm-schema-card qm-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="qm-schema-card-header">
                      <span>{table.name}</span>
                      {table.indexes?.length > 0 && (
                        <span className="text-[9px] bg-primary/10 text-primary px-1.5 rounded">{table.indexes.length} idx</span>
                      )}
                    </div>
                    <div className="qm-schema-card-body">
                      {(table.columns || []).slice(0, 8).map((col: any, j: number) => {
                        const isPk = table.primary_key?.includes(col.name);
                        const isFk = (table.foreign_keys || []).some((fk: any) => fk.column === col.name);
                        return (
                          <div key={j} className="qm-schema-col">
                            {isPk && <Key size={9} className="text-yellow-500" />}
                            {isFk && !isPk && <ArrowUpRight size={9} className="text-blue-400" />}
                            {!isPk && !isFk && <span className="w-[9px]" />}
                            <span className={isPk ? "qm-schema-col-pk" : isFk ? "qm-schema-col-fk" : ""}>{col.name}</span>
                            <span className="qm-schema-col-type">{col.type || "?"}</span>
                          </div>
                        );
                      })}
                      {(table.columns || []).length > 8 && (
                        <div className="qm-schema-col text-text-disabled text-[10px]">+{table.columns.length - 8} more columns</div>
                      )}
                    </div>
                    {/* FK Relationships */}
                    {(table.foreign_keys || []).length > 0 && (
                      <div className="px-3 py-2 border-t border-border space-y-1">
                        {table.foreign_keys.map((fk: any, k: number) => (
                          <div key={k} className="text-[9px] font-mono text-info flex items-center gap-1">
                            <ArrowUpRight size={8} /> {fk.column} → {fk.ref_table}.{fk.ref_column}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {ormModels.length > 0 && (
                <div className="px-4 py-3 border-t border-border">
                  <div className="text-[10px] font-mono text-text-muted">
                    ORM Models Detected: {ormModels.map((m) => `${m.name} (${m.orm})`).join(", ")}
                  </div>
                </div>
              )}
            </div>
          )}


          {(scanning || (done && !aggregateResult)) && (
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
                  {done && queries.length > 0 && (
                    <button
                      onClick={batchAnalyzeQueries}
                      disabled={analyzingAll}
                      className="bg-primary text-primary-foreground text-xs font-mono px-3 py-1 rounded hover:bg-primary/90 transition-colors flex items-center gap-1"
                    >
                      <Play size={11} />
                      Compute Codebase Impact
                    </button>
                  )}
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
              </div>
            </div>
          )}

          {/* Batch Analysis Progress Bar */}
          {analyzingAll && (
            <div className="bg-panel border border-border rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-center text-sm font-mono">
                <span className="text-text-primary flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
                  Optimizing all database queries recursively...
                </span>
                <span className="text-text-muted">{progress.current} / {progress.total} Completed</span>
              </div>
              <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden border border-border">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs font-mono text-text-disabled">
                Running 8 specialized AI agents sequentially per SQL instruction. Calculating latency index differentials, index plans, and rewrite validations.
              </p>
            </div>
          )}

          {/* 🚀 WHOLE-PROJECT DATABASE IMPACT DASHBOARD 🚀 */}
          {aggregateResult && !analyzingAll && (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <h2 className="text-text-primary text-lg font-mono font-bold flex items-center gap-2">
                  <ShieldCheck className="text-success" />
                  Whole-Codebase Database Impact Analysis
                </h2>
                <button
                  onClick={batchAnalyzeQueries}
                  className="border border-border text-text-secondary hover:text-primary text-xs font-mono px-3 py-1.5 rounded hover:bg-elevated/40 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  Recompute Dashboard
                </button>
              </div>

              {/* Grid 1: High Level Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* Performance Booster */}
                <div className="bg-panel border border-border rounded-lg p-5 flex flex-col justify-between qm-stat-card">
                  <span className="font-mono text-xs text-text-disabled">PERFORMANCE BOOSTER</span>
                  <div className="my-3">
                    <span className="text-4xl font-mono font-bold text-success leading-none">
                      {aggregateResult.speedupFactor}x
                    </span>
                  </div>
                  <span className="font-mono text-xs text-text-secondary">Avg latency reduction</span>
                </div>

                {/* Score Shift */}
                <div className="bg-panel border border-border rounded-lg p-5 flex flex-col justify-between qm-stat-card">
                  <span className="font-mono text-xs text-text-disabled">QUALITY SCORE</span>
                  <div className="my-3 flex items-center gap-3">
                    <span className="text-3xl font-mono font-bold text-critical">
                      {aggregateResult.avgScoreBefore}
                    </span>
                    <span className="text-text-disabled text-lg">➔</span>
                    <span className="text-3xl font-mono font-bold text-success">
                      {aggregateResult.avgScoreAfter}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-text-secondary">Calculated quality boost</span>
                </div>

                {/* Anti-Patterns */}
                <div className="bg-panel border border-border rounded-lg p-5 flex flex-col justify-between qm-stat-card">
                  <span className="font-mono text-xs text-text-disabled">ANTI-PATTERNS</span>
                  <div className="my-3">
                    <span className="text-4xl font-mono font-bold text-warning leading-none">
                      {aggregateResult.totalIssuesCount}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-text-secondary">Vulnerabilities corrected</span>
                </div>

                {/* Indexes */}
                <div className="bg-panel border border-border rounded-lg p-5 flex flex-col justify-between qm-stat-card">
                  <span className="font-mono text-xs text-text-disabled">INDEX SCHEMAS</span>
                  <div className="my-3 flex items-baseline gap-2">
                    <span className="text-4xl font-mono font-bold text-primary leading-none">
                      {aggregateResult.uniqueIndexes.length}
                    </span>
                    {aggregateResult.blockedIndexes > 0 && (
                      <span className="text-xs font-mono text-text-muted">({aggregateResult.blockedIndexes} dup blocked)</span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-text-secondary">Missing indexes advised</span>
                </div>

                {/* Schema Safety Score */}
                <div className="bg-panel border border-border rounded-lg p-5 flex flex-col justify-between qm-stat-card">
                  <span className="font-mono text-xs text-text-disabled">SCHEMA SAFETY</span>
                  <div className="my-3 flex items-center gap-2">
                    <span className={`text-4xl font-mono font-bold leading-none ${
                      aggregateResult.safetyScore >= 80 ? "text-success" :
                      aggregateResult.safetyScore >= 50 ? "text-warning" : "text-critical"
                    }`}>
                      {aggregateResult.safetyScore}
                    </span>
                    <span className="text-text-disabled text-sm">/100</span>
                  </div>
                  <div className={`qm-safety-badge ${
                    aggregateResult.safetyScore >= 80 ? "qm-safety-safe" :
                    aggregateResult.safetyScore >= 50 ? "qm-safety-warn" : "qm-safety-danger"
                  }`}>
                    {aggregateResult.safetyScore >= 80 ? "✓ Safe" : aggregateResult.safetyScore >= 50 ? "⚠ Caution" : "✗ Risk"}
                  </div>
                </div>
              </div>

              {/* Unchanged Queries Notice */}
              {aggregateResult.unchangedCount > 0 && (
                <div className="bg-code border border-success/20 rounded-lg px-4 py-3 flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-success shrink-0" />
                  <div className="font-mono text-xs">
                    <span className="text-success font-bold">{aggregateResult.unchangedCount}</span>
                    <span className="text-text-secondary"> queries are already well-optimized — no changes recommended.</span>
                  </div>
                </div>
              )}

              {/* Grid 2: comparative list + unified deployable script block */}
              <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-4 min-h-[500px]">
                {/* Left: Interactive list of optimizations */}
                <div className="bg-panel border border-border rounded-lg flex flex-col overflow-hidden">
                  <div className="h-10 px-4 flex items-center border-b border-border">
                    <span className="section-label">Queries Optimizations Diffs</span>
                  </div>
                  <div className="flex-1 overflow-auto qm-scroll divide-y divide-elevated">
                    {aggregateResult.optimizations.map((opt, i) => {
                      const isActive = selectedOptQuery?.file === opt.file && selectedOptQuery?.line === opt.line;
                      return (
                        <div
                          key={i}
                          onClick={() => setSelectedOptQuery(opt)}
                          className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                            isActive ? "bg-elevated" : "hover:bg-elevated/40"
                          }`}
                        >
                          <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded bg-secondary font-mono text-xs text-text-secondary">
                            #{i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[12.5px] text-text-primary truncate">
                              {opt.file}:{opt.line}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-mono bg-critical/15 text-critical px-1 rounded">
                                {opt.scoreBefore}
                              </span>
                              <ArrowRight size={10} className="text-text-disabled" />
                              <span className="text-[10px] font-mono bg-success/15 text-success px-1 rounded">
                                {opt.scoreAfter}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-mono text-success">
                            +{Math.round(((opt.scoreAfter - opt.scoreBefore) / Math.max(1, opt.scoreBefore)) * 100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Comparative before/after code differ */}
                <div className="bg-panel border border-border rounded-lg flex flex-col overflow-hidden">
                  {selectedOptQuery ? (
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="h-10 px-4 border-b border-border flex items-center justify-between shrink-0">
                        <span className="section-label font-mono text-[12px] text-primary truncate max-w-[320px]">
                          {selectedOptQuery.file}:{selectedOptQuery.line}
                        </span>
                        <Link
                          to="/quick"
                          search={{ q: selectedOptQuery.original }}
                          className="text-primary text-xs font-mono font-medium hover:underline"
                        >
                          Open in Sandbox →
                        </Link>
                      </div>

                      <div className="flex-1 overflow-auto p-4 space-y-4 qm-scroll">
                        {/* Before Query */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-critical font-bold flex items-center gap-1.5">
                              <AlertTriangle size={12} />
                              Original Statement (Score: {selectedOptQuery.scoreBefore})
                            </span>
                          </div>
                          <pre className="bg-code border border-border rounded p-3 font-mono text-xs text-text-secondary overflow-x-auto qm-scroll max-h-[160px]">
                            {selectedOptQuery.original}
                          </pre>
                        </div>

                        {/* After Query */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-success font-bold flex items-center gap-1.5">
                              <CheckCircle2 size={12} />
                              Optimized Statement (Score: {selectedOptQuery.scoreAfter})
                            </span>
                          </div>
                          <pre className="bg-code border border-border rounded p-3 font-mono text-xs text-text-primary overflow-x-auto qm-scroll max-h-[160px]">
                            {selectedOptQuery.optimized}
                          </pre>
                        </div>

                        {/* Direct deployable index schema for selected query */}
                        {selectedOptQuery.indexes.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <div className="text-xs font-mono text-primary font-bold">
                              Advised Indexes:
                            </div>
                            {selectedOptQuery.indexes.map((idx: any, index: number) => (
                              <div key={index} className="space-y-1">
                                <pre className="bg-secondary border border-border rounded px-3 py-2 font-mono text-[11.5px] text-text-primary overflow-x-auto qm-scroll">
                                  {idx.sql}
                                </pre>
                                <div className="text-[11px] font-mono text-text-disabled pl-1">
                                  {idx.note}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center font-mono text-xs text-text-disabled">
                      Select a query from the optimization logs
                    </div>
                  )}
                </div>
              </div>

              {/* Combined Deployable Index Schema Scripts */}
              {aggregateResult.uniqueIndexes.length > 0 && (
                <div className="bg-panel border border-border rounded-lg overflow-hidden">
                  <div className="h-10 px-4 flex items-center border-b border-border bg-secondary/30">
                    <span className="section-label font-mono">Deployable Index Schema Commands (Aggregate)</span>
                  </div>
                  <div className="p-4 space-y-2">
                    <pre className="bg-code border border-border rounded p-3 font-mono text-xs text-text-primary overflow-x-auto qm-scroll">
                      {aggregateResult.uniqueIndexes.map((idx: any) => idx.sql).join("\n")}
                    </pre>
                    <p className="text-[11px] font-mono text-text-disabled leading-relaxed">
                      Copy and run the above schema script directly in your database dashboard SQL editor to immediately resolve codebase query bottlenecks.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
