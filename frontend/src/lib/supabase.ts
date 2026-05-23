/**
 * Supabase client — singleton for auth + database operations.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ylbroirhuniglfeubqdi.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYnJvaXJodW5pZ2xmZXVicWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzI0MDIsImV4cCI6MjA5NTEwODQwMn0.z5u5LNzW0M1RPojMif3MhGlMavnwBn87dUB8FsD20ZE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
