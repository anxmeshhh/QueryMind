/**
 * SQL Query Complexity Calculator — deterministic, non-AI.
 * Returns a 1-10 score with a human-readable label.
 */

export interface ComplexityResult {
  score: number;
  label: "Simple" | "Moderate" | "Complex" | "Heavy";
  color: string;
  factors: string[];
}

const PATTERNS: { regex: RegExp; points: number; label: string }[] = [
  { regex: /\bJOIN\b/gi, points: 1.5, label: "JOIN" },
  { regex: /\bLEFT\s+JOIN\b/gi, points: 1, label: "LEFT JOIN" },
  { regex: /\bSUBQUERY\b|\bIN\s*\(\s*SELECT\b|\bEXISTS\s*\(\s*SELECT\b|\bFROM\s*\(\s*SELECT\b/gi, points: 2, label: "Subquery" },
  { regex: /\bUNION\b/gi, points: 2, label: "UNION" },
  { regex: /\bCASE\b/gi, points: 1, label: "CASE" },
  { regex: /\bGROUP\s+BY\b/gi, points: 1, label: "GROUP BY" },
  { regex: /\bHAVING\b/gi, points: 1.5, label: "HAVING" },
  { regex: /\bDISTINCT\b/gi, points: 0.5, label: "DISTINCT" },
  { regex: /\bORDER\s+BY\b/gi, points: 0.5, label: "ORDER BY" },
  { regex: /\bCOUNT\b|\bSUM\b|\bAVG\b|\bMIN\b|\bMAX\b/gi, points: 0.5, label: "Aggregate" },
  { regex: /\bWINDOW\b|\bOVER\s*\(/gi, points: 2, label: "Window Function" },
  { regex: /\bCTE\b|\bWITH\s+\w+\s+AS\s*\(/gi, points: 2, label: "CTE" },
  { regex: /\bLIKE\s+'%/gi, points: 1, label: "Leading wildcard LIKE" },
  { regex: /\bOR\b/gi, points: 0.5, label: "OR condition" },
];

export function calculateComplexity(sql: string): ComplexityResult {
  if (!sql.trim()) return { score: 0, label: "Simple", color: "text-success", factors: [] };

  let total = 0;
  const factors: string[] = [];

  for (const pattern of PATTERNS) {
    const matches = sql.match(pattern.regex);
    if (matches && matches.length > 0) {
      total += pattern.points * matches.length;
      factors.push(`${pattern.label}${matches.length > 1 ? ` ×${matches.length}` : ""}`);
    }
  }

  // Bonus for very long queries
  const lineCount = sql.split("\n").length;
  if (lineCount > 20) { total += 1; factors.push("Long query"); }
  if (lineCount > 50) { total += 1; factors.push("Very long query"); }

  const score = Math.min(10, Math.max(1, Math.round(total)));

  let label: ComplexityResult["label"];
  let color: string;
  if (score <= 2) { label = "Simple"; color = "text-success"; }
  else if (score <= 4) { label = "Moderate"; color = "text-info"; }
  else if (score <= 7) { label = "Complex"; color = "text-warning"; }
  else { label = "Heavy"; color = "text-critical"; }

  return { score, label, color, factors };
}
