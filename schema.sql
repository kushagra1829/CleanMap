-- IMPORTANT FOR THE USER!
-- Paste all of the code below into the SQL Editor (left sidebar "SQL") in your Supabase Dashboard
-- and press RUN to create your database structure and file storage.

-- 1. Create the reports table
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

-- 2. Create the Cloudinary/S3 Equivalent image bucket in Supabase Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cleanmap-evidence', 'cleanmap-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Adjust permissions so anyone can read/write directly
-- Note: Policies cannot use IF NOT EXISTS easily in standard SQL, 
-- but we can drop and recreate them to ensure they are correct.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'cleanmap-evidence');

DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cleanmap-evidence');
