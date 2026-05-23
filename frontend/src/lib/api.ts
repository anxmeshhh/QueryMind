/**
 * API service — connects frontend to Flask backend via SSE.
 */

export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname.includes("workers.dev")
    ? "https://querymind-api-xrer.onrender.com"
    : "http://localhost:5000");

export interface SSEEvent {
  type: "agent_start" | "agent_done" | "agent_error" | "agent_finding" | "complete" | "error" | "batch_start" | "batch_progress" | "batch_item_done" | "batch_item_error";
  agent?: string;
  message?: string;
  severity?: string;
  time?: number;
  data?: any;
  result?: any;
  error?: string;
}

/**
 * Send a request to the backend and consume the SSE stream.
 * Calls onEvent for each SSE event received.
 */
export function streamAnalysis(
  endpoint: string,
  body: Record<string, any>,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: string) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Request failed" }));
        onError?.(err.error || `HTTP ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError?.("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: SSEEvent = JSON.parse(line.slice(6));
              onEvent(event);
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onError?.(err.message || "Connection failed");
      }
    });

  return controller;
}

/** Quick Analyze — POST /api/v1/analyze */
export function analyzeQuery(
  sql: string,
  dialect: string,
  schema: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: string) => void,
) {
  return streamAnalysis("/api/v1/analyze", { sql, dialect: dialect.toLowerCase(), schema }, onEvent, onError);
}

/** Project Scan — POST /api/v1/scan */
export function scanFiles(
  files: { name: string; content: string }[],
  onEvent: (event: SSEEvent) => void,
  onError?: (error: string) => void,
) {
  return streamAnalysis("/api/v1/scan", { files }, onEvent, onError);
}

/** Connect to DB — POST /api/v1/connect */
export function connectDatabase(
  connectionString: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: string) => void,
) {
  return streamAnalysis("/api/v1/connect", { connection_string: connectionString }, onEvent, onError);
}

/** EXPLAIN Analyze — POST /api/v1/explain */
export function explainQuery(
  connectionString: string,
  sql: string,
  dialect: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: string) => void,
) {
  return streamAnalysis(
    "/api/v1/explain",
    { connection_string: connectionString, sql, dialect: dialect.toLowerCase() },
    onEvent,
    onError,
  );
}

/** Batch Analyze — POST /api/v1/analyze-batch */
export function analyzeBatch(
  queries: { sql: string; file: string; line: number }[],
  projectSchema: any[],
  dialect: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: string) => void,
) {
  return streamAnalysis(
    "/api/v1/analyze-batch",
    { queries, project_schema: projectSchema, dialect: dialect.toLowerCase() },
    onEvent,
    onError,
  );
}

/** Health check */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Scan a GitHub repository — clone & return source files */
export async function scanGithubRepo(repoUrl: string): Promise<{ files: { name: string; content: string; size: number }[]; count: number; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/scan-github`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url: repoUrl }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { files: [], count: 0, error: data.error || "Failed to scan repository" };
    }
    return { files: data.files || [], count: data.count || 0 };
  } catch (e) {
    return { files: [], count: 0, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Natural Language to SQL conversion */
export async function nlToSql(
  prompt: string,
  dialect: string = "postgresql",
  schema: any[] = [],
): Promise<{ sql: string; explanation: string; tables_used: string[]; confidence: number; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/nl-to-sql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, dialect, schema }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { sql: "", explanation: "", tables_used: [], confidence: 0, error: data.error };
    }
    return data;
  } catch (e) {
    return { sql: "", explanation: "", tables_used: [], confidence: 0, error: e instanceof Error ? e.message : "Network error" };
  }
}

