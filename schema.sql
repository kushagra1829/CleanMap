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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create the Cloudinary/S3 Equivalent image bucket in Supabase Storage
insert into storage.buckets (id, name, public) 
values ('cleanmap-evidence', 'cleanmap-evidence', true);

-- 3. Adjust permissions so anyone can read/write directly (since we have no authentication system yet)
create policy "Public Access" on storage.objects for select using (bucket_id = 'cleanmap-evidence');
create policy "Public Insert" on storage.objects for insert with check (bucket_id = 'cleanmap-evidence');
