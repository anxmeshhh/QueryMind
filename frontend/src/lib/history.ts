import { supabase } from "./supabase";
import { AnalysisResult } from "@/components/ResultsPanel";

export interface DBAnalysis {
  id: string;
  user_id: string;
  mode: "quick" | "scan" | "connect";
  original_query: string;
  optimized_query: string | null;
  dialect: string;
  performance_score_before: number | null;
  performance_score_after: number | null;
  issues_count: number;
  issues: any;
  index_recommendations: any;
  execution_plan: any;
  schema_context: any;
  created_at: string;
}

/**
 * Saves a completed analysis result to Supabase.
 */
export async function saveAnalysis(
  mode: "quick" | "scan" | "connect",
  originalQuery: string,
  result: AnalysisResult,
  dialect: string = "postgresql",
  schemaContext: any = null
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Convert keys to database column names
    const insertData = {
      user_id: user.id,
      mode,
      original_query: originalQuery,
      optimized_query: result.optimizedSql || null,
      dialect: dialect.toLowerCase(),
      performance_score_before: result.scoreBefore,
      performance_score_after: result.scoreAfter,
      issues_count: result.issues?.length || 0,
      issues: result.issues || [],
      index_recommendations: result.indexes || [],
      schema_context: schemaContext || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("analyses")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error saving analysis to DB:", error);
      return null;
    }

    // Record Telemetry Analytics
    await supabase.from("analytics").insert({
      event_type: mode,
      dialect: dialect.toLowerCase(),
      issues_found: result.issues?.length || 0,
      improvement_pct: result.scoreBefore && result.scoreAfter 
        ? ((result.scoreAfter - result.scoreBefore) / result.scoreBefore) * 100
        : 0,
    });

    return data as DBAnalysis;
  } catch (err) {
    console.error("Failed to run saveAnalysis:", err);
    return null;
  }
}

/**
 * Fetches all analysis history for the current user.
 */
export async function fetchAnalyses() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching analyses:", error);
      return [];
    }

    return data as DBAnalysis[];
  } catch (err) {
    console.error("Failed to run fetchAnalyses:", err);
    return [];
  }
}

/**
 * Deletes a past analysis from database.
 */
export async function deleteAnalysis(id: string) {
  try {
    const { error } = await supabase
      .from("analyses")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting analysis:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to run deleteAnalysis:", err);
    return false;
  }
}

/**
 * Saves a completed scan batch result to Supabase.
 */
export async function saveScanResult(
  queriesCount: number,
  aggregateResult: any,
  dialect: string = "postgresql",
  projectSchemaContext: any = null,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const insertData = {
      user_id: user.id,
      mode: "scan",
      original_query: `[Batch scan: ${queriesCount} queries analyzed]`,
      optimized_query: null,
      dialect: dialect.toLowerCase(),
      performance_score_before: aggregateResult?.avgScoreBefore ?? null,
      performance_score_after: aggregateResult?.avgScoreAfter ?? null,
      issues_count: aggregateResult?.totalIssuesCount ?? 0,
      issues: aggregateResult?.optimizations?.flatMap((o: any) => o.issues || []).slice(0, 20) || [],
      index_recommendations: aggregateResult?.uniqueIndexes || [],
      schema_context: projectSchemaContext,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("analyses")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error saving scan result:", error);
      return null;
    }

    // Telemetry
    await supabase.from("analytics").insert({
      event_type: "scan",
      dialect: dialect.toLowerCase(),
      issues_found: aggregateResult?.totalIssuesCount || 0,
      improvement_pct: aggregateResult?.avgScoreBefore && aggregateResult?.avgScoreAfter
        ? ((aggregateResult.avgScoreAfter - aggregateResult.avgScoreBefore) / aggregateResult.avgScoreBefore) * 100
        : 0,
    });

    return data as DBAnalysis;
  } catch (err) {
    console.error("Failed to saveScanResult:", err);
    return null;
  }
}

/**
 * Fetches recent scan-mode analyses for the empty state display.
 */
export async function fetchRecentScans(limit: number = 5) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("mode", "scan")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent scans:", error);
      return [];
    }

    return data as DBAnalysis[];
  } catch (err) {
    console.error("Failed to fetchRecentScans:", err);
    return [];
  }
}

