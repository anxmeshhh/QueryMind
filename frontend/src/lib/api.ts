/**
 * API service — connects frontend to Flask backend via SSE.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export interface SSEEvent {
  type: "agent_start" | "agent_done" | "agent_error" | "agent_finding" | "complete" | "error";
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

/** Health check */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    return res.ok;
  } catch {
    return false;
  }
}
