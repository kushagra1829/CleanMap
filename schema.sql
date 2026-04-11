-- 1. Create the reports table (Fixed Schema)
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high')) NOT NULL,
    status TEXT CHECK (status IN ('reported', 'in-progress', 'cleaned')) DEFAULT 'reported' NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    reporter TEXT DEFAULT 'Anonymous',
    volunteer TEXT,
    photo TEXT,
    after_photo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure table is fully accessible for demo
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;

-- 2. ENABLE REALTIME for this table
-- This allows the map and leaderboard to update without refreshing
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE reports;
COMMIT;

-- 3. Create the image bucket in Supabase Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cleanmap-evidence', 'cleanmap-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Adjust permissions for storage
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'cleanmap-evidence');

DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cleanmap-evidence');
