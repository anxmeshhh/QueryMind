/**
 * AiChat — Sliding chat panel for conversational AI assistant.
 * Supports streaming responses, markdown rendering, SQL extraction,
 * and contextual follow-up suggestions.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Copy,
  Check,
  Trash2,
  ChevronRight,
  Bot,
  User,
  Loader2,
  Zap,
} from "lucide-react";
import { API_BASE } from "@/lib/api";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sql?: string | null;
  suggestions?: string[];
  timestamp: number;
}

interface AiChatProps {
  isOpen: boolean;
  onClose: () => void;
  currentQuery?: string;
  dialect?: string;
  currentResult?: any;
}

export function AiChat({
  isOpen,
  onClose,
  currentQuery = "",
  dialect = "postgresql",
  currentResult = null,
}: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || loading) return;

      setInput("");
      const userMsg: ChatMessage = {
        role: "user",
        content: msg,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        // Get schema from localStorage
        let schema: any[] = [];
        try {
          const raw = localStorage.getItem("qm_global_schema");
          if (raw) schema = JSON.parse(raw);
        } catch {}

        const res = await fetch(`${API_BASE}/api/v1/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            session_id: sessionId,
            schema,
            dialect,
            current_query: currentQuery,
            current_result: currentResult,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        // Parse SSE stream
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith("data: ")) {
              try {
                const event = JSON.parse(cleanLine.slice(6));
                if (event.type === "chat_response") {
                  const assistantMsg: ChatMessage = {
                    role: "assistant",
                    content: event.response || "",
                    sql: event.sql || null,
                    suggestions: event.suggestions || [],
                    timestamp: Date.now(),
                  };
                  setMessages((prev) => [...prev, assistantMsg]);
                } else if (event.type === "error") {
                  const errorMsg: ChatMessage = {
                    role: "assistant",
                    content: `⚠️ Error: ${event.message || "An unexpected error occurred."}`,
                    timestamp: Date.now(),
                  };
                  setMessages((prev) => [...prev, errorMsg]);
                }
              } catch {}
            }
          }
        }
      } catch (err) {
        const errorMsg: ChatMessage = {
          role: "assistant",
          content: `⚠️ ${err instanceof Error ? err.message : "Connection failed"}. Please check that the backend is running.`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, sessionId, dialect, currentQuery, currentResult]
  );

  const clearChat = async () => {
    setMessages([]);
    try {
      await fetch(`${API_BASE}/api/v1/chat/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch {}
    toast.success("Chat cleared");
  };

  const quickActions = [
    { label: "Explain this query", icon: Sparkles, msg: "Explain what my current query does step by step" },
    { label: "Optimize query", icon: Zap, msg: "Optimize my current query for better performance" },
    { label: "Suggest indexes", icon: ChevronRight, msg: "What indexes would improve my current query?" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Chat Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-panel border-l border-border z-[61] flex flex-col shadow-2xl shadow-black/30"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <Sparkles size={16} className="text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-primary">QueryMind AI</div>
                  <div className="text-[10px] text-text-muted font-mono">Database Engineering Assistant</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="p-1.5 text-text-disabled hover:text-text-muted rounded-lg hover:bg-elevated transition-colors"
                  title="Clear chat"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 text-text-disabled hover:text-text-muted rounded-lg hover:bg-elevated transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 qm-scroll">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <MessageSquare size={24} className="text-primary" />
                  </div>
                  <h3 className="text-text-primary font-semibold text-sm mb-1">
                    Ask me anything about SQL
                  </h3>
                  <p className="text-text-muted text-xs mb-6 leading-relaxed">
                    I can explain queries, optimize performance, suggest indexes, generate SQL from descriptions, and more.
                  </p>

                  {/* Quick Actions */}
                  <div className="w-full space-y-2">
                    {quickActions.map((action, i) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={i}
                          onClick={() => sendMessage(action.msg)}
                          className="w-full flex items-center gap-2.5 bg-elevated/50 border border-border rounded-lg px-3 py-2.5 text-text-secondary text-xs hover:bg-elevated hover:text-text-primary hover:border-primary/20 transition-all text-left"
                        >
                          <Icon size={13} className="text-text-muted shrink-0" />
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} onSuggestionClick={sendMessage} />
              ))}

              {loading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                    <Bot size={14} className="text-primary" />
                  </div>
                  <div className="bg-elevated/60 border border-border rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2 text-text-muted text-xs">
                      <Loader2 size={12} className="animate-spin" />
                      Thinking...
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask about your SQL..."
                  rows={1}
                  className="flex-1 bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all resize-none max-h-[100px]"
                  style={{
                    height: "auto",
                    minHeight: "38px",
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = Math.min(target.scrollHeight, 100) + "px";
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="bg-primary text-primary-foreground p-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1">
                <span className="text-[9px] text-text-disabled font-mono">
                  Enter to send · Shift+Enter for new line
                </span>
                <span className="text-[9px] text-text-disabled font-mono">
                  Powered by Groq
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function MessageBubble({
  message,
  onSuggestionClick,
}: {
  message: ChatMessage;
  onSuggestionClick: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple markdown-like rendering for code blocks
  const renderContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.split("\n");
        const lang = lines[0].replace("```", "").trim();
        const code = lines.slice(1, -1).join("\n");
        return (
          <div key={i} className="my-2">
            <div className="flex items-center justify-between bg-code/80 border border-border rounded-t-md px-3 py-1.5">
              <span className="text-[10px] font-mono text-text-disabled uppercase">{lang || "code"}</span>
              <button
                onClick={() => copyToClipboard(code)}
                className="text-text-disabled hover:text-text-muted transition-colors"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
            <pre className="bg-code border border-t-0 border-border rounded-b-md px-3 py-2.5 overflow-x-auto qm-scroll">
              <code className="font-mono text-[12px] text-text-primary leading-relaxed whitespace-pre">
                {code}
              </code>
            </pre>
          </div>
        );
      }

      // Inline code
      const inlineParts = part.split(/(`[^`]+`)/g);
      return (
        <span key={i}>
          {inlineParts.map((ip, j) =>
            ip.startsWith("`") && ip.endsWith("`") ? (
              <code key={j} className="bg-elevated/80 text-primary px-1 py-0.5 rounded text-[11px] font-mono">
                {ip.slice(1, -1)}
              </code>
            ) : (
              <span key={j}>{ip}</span>
            )
          )}
        </span>
      );
    });
  };

  return (
    <div className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          isUser
            ? "bg-secondary border border-border"
            : "bg-primary/15 border border-primary/25"
        }`}
      >
        {isUser ? (
          <User size={14} className="text-text-muted" />
        ) : (
          <Bot size={14} className="text-primary" />
        )}
      </div>

      {/* Content */}
      <div className={`max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`rounded-xl px-3 py-2.5 text-[13px] leading-relaxed ${
            isUser
              ? "bg-primary/15 text-text-primary border border-primary/20"
              : "bg-elevated/60 text-text-secondary border border-border"
          }`}
        >
          {renderContent(message.content)}
        </div>

        {/* Suggestions */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick(s)}
                className="text-[10px] bg-elevated/50 border border-border text-text-muted px-2 py-1 rounded-md hover:bg-elevated hover:text-text-secondary hover:border-primary/20 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Extracted SQL action */}
        {!isUser && message.sql && (
          <button
            onClick={() => {
              // Dispatch event to inject SQL into editor
              window.dispatchEvent(
                new CustomEvent("qm-inject-sql", { detail: message.sql })
              );
              toast.success("SQL injected into editor");
            }}
            className="mt-2 flex items-center gap-1.5 text-[10px] text-primary bg-primary/8 border border-primary/15 px-2 py-1 rounded-md hover:bg-primary/15 transition-all"
          >
            <Zap size={10} />
            Use this SQL in editor
          </button>
        )}
      </div>
    </div>
  );
}

/** Chat toggle button for TopBar */
export function AiChatTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-text-muted hover:text-primary p-1.5 rounded-lg hover:bg-elevated transition-all"
      title="Open AI Chat (Ctrl+J)"
    >
      <MessageSquare size={15} />
      <span className="text-[10px] font-mono hidden sm:inline">AI</span>
    </button>
  );
}
