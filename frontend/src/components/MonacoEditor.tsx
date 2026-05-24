/**
 * MonacoEditor — reusable SQL editor with QueryMind theming,
 * schema-driven autocomplete, and inline error markers.
 */

import { useRef, useCallback, useEffect, useState } from "react";
import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import type { editor, languages, IDisposable } from "monaco-editor";
import { useTheme } from "@/hooks/useTheme";

// ── QueryMind theme definitions ────────────────────────────────

const QM_DARK_THEME: editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "06b6d4", fontStyle: "bold" },
    { token: "keyword.sql", foreground: "06b6d4", fontStyle: "bold" },
    { token: "string", foreground: "22c55e" },
    { token: "string.sql", foreground: "22c55e" },
    { token: "number", foreground: "eab308" },
    { token: "number.sql", foreground: "eab308" },
    { token: "comment", foreground: "52525b", fontStyle: "italic" },
    { token: "comment.sql", foreground: "52525b", fontStyle: "italic" },
    { token: "operator", foreground: "a1a1aa" },
    { token: "operator.sql", foreground: "a1a1aa" },
    { token: "identifier", foreground: "e4e4e7" },
    { token: "delimiter", foreground: "71717a" },
    { token: "type", foreground: "a855f7" },
    { token: "predefined", foreground: "ec4899" },
  ],
  colors: {
    "editor.background": "#0d0d10",
    "editor.foreground": "#e4e4e7",
    "editor.lineHighlightBackground": "#1a1a2e",
    "editor.selectionBackground": "#06b6d430",
    "editor.inactiveSelectionBackground": "#06b6d415",
    "editorLineNumber.foreground": "#52525b",
    "editorLineNumber.activeForeground": "#a1a1aa",
    "editorCursor.foreground": "#06b6d4",
    "editorIndentGuide.background": "#1c1c20",
    "editorIndentGuide.activeBackground": "#27272a",
    "editorWidget.background": "#111113",
    "editorWidget.border": "#27272a",
    "editorSuggestWidget.background": "#111113",
    "editorSuggestWidget.border": "#27272a",
    "editorSuggestWidget.selectedBackground": "#1a1a2e",
    "editorSuggestWidget.highlightForeground": "#06b6d4",
    "input.background": "#0d0d10",
    "input.border": "#27272a",
    "focusBorder": "#06b6d450",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#27272a80",
    "scrollbarSlider.hoverBackground": "#3f3f46",
    "scrollbarSlider.activeBackground": "#52525b",
  },
};

const QM_LIGHT_THEME: editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "0891b2", fontStyle: "bold" },
    { token: "keyword.sql", foreground: "0891b2", fontStyle: "bold" },
    { token: "string", foreground: "16a34a" },
    { token: "string.sql", foreground: "16a34a" },
    { token: "number", foreground: "ca8a04" },
    { token: "number.sql", foreground: "ca8a04" },
    { token: "comment", foreground: "a1a1aa", fontStyle: "italic" },
    { token: "comment.sql", foreground: "a1a1aa", fontStyle: "italic" },
    { token: "operator", foreground: "52525b" },
    { token: "operator.sql", foreground: "52525b" },
    { token: "identifier", foreground: "18181b" },
    { token: "delimiter", foreground: "71717a" },
    { token: "type", foreground: "9333ea" },
    { token: "predefined", foreground: "db2777" },
  ],
  colors: {
    "editor.background": "#fafafa",
    "editor.foreground": "#18181b",
    "editor.lineHighlightBackground": "#f4f4f5",
    "editor.selectionBackground": "#0891b230",
    "editor.inactiveSelectionBackground": "#0891b215",
    "editorLineNumber.foreground": "#a1a1aa",
    "editorLineNumber.activeForeground": "#52525b",
    "editorCursor.foreground": "#0891b2",
    "editorIndentGuide.background": "#e4e4e7",
    "editorIndentGuide.activeBackground": "#d4d4d8",
    "editorWidget.background": "#ffffff",
    "editorWidget.border": "#e4e4e7",
    "editorSuggestWidget.background": "#ffffff",
    "editorSuggestWidget.border": "#e4e4e7",
    "editorSuggestWidget.selectedBackground": "#f4f4f5",
    "editorSuggestWidget.highlightForeground": "#0891b2",
    "input.background": "#fafafa",
    "input.border": "#e4e4e7",
    "focusBorder": "#0891b250",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#d4d4d850",
    "scrollbarSlider.hoverBackground": "#a1a1aa60",
    "scrollbarSlider.activeBackground": "#71717a",
  },
};

// ── Schema types ───────────────────────────────────────────────

interface SchemaTable {
  name?: string;
  table?: string;
  columns?: number | (string | { name: string; type?: string })[];
  column_details?: { name: string; type?: string; nullable?: boolean }[];
}

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  placeholder?: string;
  readOnly?: boolean;
  schema?: SchemaTable[];
  height?: string;
  className?: string;
}

// ── Component ──────────────────────────────────────────────────

export function MonacoEditor({
  value,
  onChange,
  language = "sql",
  placeholder,
  readOnly = false,
  schema = [],
  height = "100%",
  className = "",
}: MonacoEditorProps) {
  const { isDark } = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);
  const [isReady, setIsReady] = useState(false);

  // Register custom themes before mount
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    monaco.editor.defineTheme("qm-dark", QM_DARK_THEME);
    monaco.editor.defineTheme("qm-light", QM_LIGHT_THEME);
  }, []);

  // Setup editor on mount
  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      setIsReady(true);

      // Register SQL autocomplete provider with schema context
      const completionProvider = monaco.languages.registerCompletionItemProvider(
        "sql",
        {
          triggerCharacters: [".", " ", "("],
          provideCompletionItems: (model: editor.ITextModel, position: any) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };

            const suggestions: languages.CompletionItem[] = [];

            // SQL keywords
            const keywords = [
              "SELECT", "FROM", "WHERE", "JOIN", "INNER JOIN", "LEFT JOIN",
              "RIGHT JOIN", "FULL JOIN", "ON", "AND", "OR", "NOT", "IN",
              "EXISTS", "BETWEEN", "LIKE", "IS NULL", "IS NOT NULL",
              "ORDER BY", "GROUP BY", "HAVING", "LIMIT", "OFFSET",
              "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM",
              "CREATE TABLE", "ALTER TABLE", "DROP TABLE", "CREATE INDEX",
              "AS", "DISTINCT", "COUNT", "SUM", "AVG", "MAX", "MIN",
              "CASE", "WHEN", "THEN", "ELSE", "END", "UNION", "UNION ALL",
              "WITH", "RECURSIVE", "EXPLAIN", "ANALYZE", "COALESCE",
              "NULLIF", "CAST", "EXTRACT", "DATE_TRUNC",
            ];

            keywords.forEach((kw) => {
              suggestions.push({
                label: kw,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: kw,
                range,
                detail: "SQL Keyword",
                sortText: "2_" + kw,
              });
            });

            // Schema-driven table/column completions
            if (schema && schema.length > 0) {
              schema.forEach((table) => {
                const tableName =
                  table.name || table.table || "unknown";

                suggestions.push({
                  label: tableName,
                  kind: monaco.languages.CompletionItemKind.Class,
                  insertText: tableName,
                  range,
                  detail: "Table",
                  documentation: `Table: ${tableName}`,
                  sortText: "0_" + tableName,
                });

                // Columns
                const cols = Array.isArray(table.columns)
                  ? table.columns
                  : Array.isArray(table.column_details)
                  ? table.column_details
                  : [];
                cols.forEach((col) => {
                  const colName =
                    typeof col === "string" ? col : col.name;
                  const colType =
                    typeof col === "object" ? col.type || "" : "";

                  suggestions.push({
                    label: `${tableName}.${colName}`,
                    kind: monaco.languages.CompletionItemKind.Field,
                    insertText: `${tableName}.${colName}`,
                    range,
                    detail: colType ? `${colType} — ${tableName}` : tableName,
                    sortText: "1_" + tableName + "." + colName,
                  });

                  suggestions.push({
                    label: colName,
                    kind: monaco.languages.CompletionItemKind.Field,
                    insertText: colName,
                    range,
                    detail: colType
                      ? `${colType} — ${tableName}`
                      : `Column — ${tableName}`,
                    sortText: "1_" + colName,
                  });
                });
              });
            }

            return { suggestions };
          },
        }
      );

      disposablesRef.current.push(completionProvider);

      // Focus editor
      editor.focus();
    },
    [schema]
  );

  // Update theme when it changes
  useEffect(() => {
    if (editorRef.current) {
      const monaco = (window as any).monaco;
      if (monaco) {
        monaco.editor.setTheme(isDark ? "qm-dark" : "qm-light");
      }
    }
  }, [isDark]);

  // Cleanup disposables on unmount
  useEffect(() => {
    return () => {
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
    };
  }, []);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {/* Placeholder overlay */}
      {!value && placeholder && isReady && (
        <div className="absolute inset-0 pointer-events-none z-10 flex p-4 pl-16 pt-2">
          <pre className="font-mono text-[13px] leading-[19px] text-text-disabled/40 whitespace-pre-wrap">
            {placeholder}
          </pre>
        </div>
      )}

      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v || "")}
        theme={isDark ? "qm-dark" : "qm-light"}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        loading={
          <div className="h-full flex items-center justify-center">
            <div className="flex items-center gap-2 text-text-muted text-sm font-mono">
              <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Loading editor...
            </div>
          </div>
        }
        options={{
          fontSize: 13,
          lineHeight: 19,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          readOnly,
          renderLineHighlight: "line",
          lineNumbers: "on",
          glyphMargin: false,
          folding: true,
          lineDecorationsWidth: 8,
          lineNumbersMinChars: 3,
          padding: { top: 8, bottom: 8 },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            useShadows: false,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
            preview: true,
            showIcons: true,
          },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false,
          },
          acceptSuggestionOnEnter: "on",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          contextmenu: true,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          renderWhitespace: "none",
          matchBrackets: "always",
        }}
      />
    </div>
  );
}
