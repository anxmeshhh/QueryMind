-- ==========================================
-- QueryMind — Supabase Database Migration Schema
-- Run this in your Supabase Dashboard SQL Editor
-- ==========================================

-- 1. Create Analyses Table (History)
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('quick', 'scan', 'connect')),
    original_query TEXT NOT NULL,
    optimized_query TEXT,
    dialect TEXT DEFAULT 'postgresql',
    performance_score_before INT,
    performance_score_after INT,
    issues_count INT DEFAULT 0,
    issues JSONB,                  -- List of detected SQL anti-patterns
    index_recommendations JSONB,     -- Suggested index commands
    execution_plan JSONB,           -- Real/estimated execution nodes
    schema_context JSONB,           -- CREATE TABLE structures parsed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Saved Queries Table (Bookmarks)
CREATE TABLE IF NOT EXISTS saved_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Usage Analytics Table (Aggregate counts, privacy safe)
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,       -- 'analysis', 'scan', 'connect'
    dialect TEXT,
    issues_found INT DEFAULT 0,
    improvement_pct FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- 5. Establish Row Level Security Policies
-- Analyses Policies
CREATE POLICY "Users can only read their own analyses" ON analyses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analyses" ON analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses" ON analyses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses" ON analyses
    FOR DELETE USING (auth.uid() = user_id);

-- Saved Queries Policies
CREATE POLICY "Users can read their own saved queries" ON saved_queries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved queries" ON saved_queries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved queries" ON saved_queries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved queries" ON saved_queries
    FOR DELETE USING (auth.uid() = user_id);

-- Analytics Policies (Insert only for telemetry, no user reads)
CREATE POLICY "System can record analytics events" ON analytics
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin check for analytics reads" ON analytics
    FOR SELECT USING (false); -- Admin dashboard accesses via service role only
