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

/** Helper to execute queries/discoveries directly on the client machine via QueryMind Local Bridge */
function streamLocalBridge(
  action: "schema" | "explain",
  connectionString: string,
  sql: string,
  dialect: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: string) => void,
  bridgeToken?: string,
): AbortController {
  const controller = new AbortController();

  setTimeout(async () => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (bridgeToken) {
        headers["Authorization"] = `Bearer ${bridgeToken}`;
      }

      if (action === "schema") {
        onEvent({ type: "agent_start", agent: "connector", message: "Connecting to local QueryMind Bridge (port 9999)...", time: 0.1 });
        
        // Test connection
        const testRes = await fetch("http://localhost:9999", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "test", connection_string: connectionString }),
          signal: controller.signal,
        });
        const testData = await testRes.json();
        if (testData.status === "error") {
          onEvent({ type: "agent_error", agent: "connector", message: testData.message });
          return;
        }

        const dbType = connectionString.toLowerCase().includes("mysql") ? "MySQL" : connectionString.toLowerCase().includes("sqlite") ? "SQLite" : "PostgreSQL";
        onEvent({
          type: "agent_done",
          agent: "connector",
          message: "Successfully connected locally.",
          data: { type: dbType, version: "Local Instance", database: connectionString.split("/").pop() || "local" },
        });

        // Get Schema
        onEvent({ type: "agent_start", agent: "schema", message: "Extracting table schemas locally...", time: 0.5 });
        const schemaRes = await fetch("http://localhost:9999", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "schema", connection_string: connectionString }),
          signal: controller.signal,
        });
        const schemaData = await schemaRes.json();
        if (schemaData.status === "error") {
          onEvent({ type: "agent_error", agent: "schema", message: schemaData.message });
          return;
        }

        onEvent({ type: "agent_done", agent: "schema", data: { tables: schemaData.tables } });
        onEvent({ type: "complete", message: "Database schema successfully mapped." });
      } else if (action === "explain") {
        onEvent({ type: "agent_start", agent: "explain", message: "Running EXPLAIN locally on your database...", time: 0.1 });

        // Run Explain
        const explainRes = await fetch("http://localhost:9999", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "explain", connection_string: connectionString, query: sql }),
          signal: controller.signal,
        });
        const explainData = await explainRes.json();
        if (explainData.status === "error") {
          onEvent({ type: "agent_error", agent: "explain", message: explainData.message });
          return;
        }

        onEvent({ type: "agent_done", agent: "explain", data: { plan: explainData.plan } });

        // Run rest of optimization pipeline using cloud backend (AI rules and indexes)
        onEvent({ type: "agent_start", agent: "parser", message: "Analyzing query structure via QueryMind Brain...", time: 0.4 });
        
        // Convert local columns to a schema DDL text
        let schemaText = "";
        try {
          const globalSchemaRaw = localStorage.getItem("qm_global_schema");
          if (globalSchemaRaw) {
            const schemaObj = JSON.parse(globalSchemaRaw);
            schemaText = schemaObj.map((t: any) => {
              const cols = (t.column_details || []).map((c: any) => `${c.name} ${c.type}`).join(", ");
              return `CREATE TABLE ${t.table} (${cols});`;
            }).join("\n");
          }
        } catch {}

        const analyzeRes = await fetch(`${API_BASE}/api/v1/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql, dialect: dialect.toLowerCase(), schema: schemaText }),
          signal: controller.signal,
        });

        if (!analyzeRes.ok) {
          onEvent({ type: "complete", message: "Local query plan fetched. Cloud analysis offline." });
          return;
        }

        const reader = analyzeRes.body?.getReader();
        if (reader) {
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
                const event: SSEEvent = JSON.parse(line.slice(6));
                // Forward AI analysis events only (connector and explain was done locally)
                if (event.agent !== "connector" && event.agent !== "schema" && event.agent !== "explain") {
                  onEvent(event);
                }
              }
            }
          }
        }
        onEvent({ type: "complete", message: "Optimization analysis completed successfully." });
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        onError?.("Could not reach local bridge. Please make sure to run 'python querymind_bridge.py' locally in your terminal.");
      }
    }
  }, 0);

  return controller;
}

/** Connect to DB — POST /api/v1/connect */
export function connectDatabase(
  connectionString: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: string) => void,
  bridgeToken?: string,
) {
  if (connectionString.includes("localhost") || connectionString.includes("127.0.0.1")) {
    return streamLocalBridge("schema", connectionString, "", "postgresql", onEvent, onError, bridgeToken);
  }
  return streamAnalysis("/api/v1/connect", { connection_string: connectionString }, onEvent, onError);
}

/** EXPLAIN Analyze — POST /api/v1/explain */
export function explainQuery(
  connectionString: string,
  sql: string,
  dialect: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: string) => void,
  bridgeToken?: string,
) {
  if (connectionString.includes("localhost") || connectionString.includes("127.0.0.1")) {
    return streamLocalBridge("explain", connectionString, sql, dialect, onEvent, onError, bridgeToken);
  }
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

