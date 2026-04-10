require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: SUPABASE_URL or SUPABASE_KEY is missing from environment variables.");
}

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files (Primarily for local development)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// ── API Endpoints ──

// Health check for Vercel debugging
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    supabase_configured: !!supabase,
    env: process.env.NODE_ENV
  });
});

// Deliver public keys to frontend for WebSockets
app.get('/api/config', (req, res) => {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ success: false, error: "Supabase keys missing in Vercel" });
  }
  res.json({
    success: true,
    data: {
      url: supabaseUrl,
      key: supabaseKey
    }
  });
});

// GET all reports
app.get('/api/reports', async (req, res) => {
  const { search } = req.query;
  
  let query = supabase.from('reports').select('*').order('created_at', { ascending: false });

  if (search) {
    query = query.or(`title.ilike.%${search}%,location.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  res.json({ success: true, data });
});

// POST a new report (with Cloud Storage for Photo)
app.post('/api/reports', async (req, res) => {
  const { title, location, description, severity, lat, lng, reporter, photoBase64 } = req.body;

  let photoUrl = null;

  // Process and upload base64 image if present
  if (photoBase64) {
    try {
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `evidence_${Date.now()}_${uuidv4().substring(0,6)}.jpg`;

      // Upload directly to Supabase Storage bucket
      const { data, error } = await supabase.storage
        .from('cleanmap-evidence')
        .upload(filename, buffer, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) throw error;

      // Construct public URL
      const { data: publicUrlData } = supabase.storage
        .from('cleanmap-evidence')
        .getPublicUrl(filename);
        
      photoUrl = publicUrlData.publicUrl;
    } catch (err) {
      console.error('Image upload failed to cloud storage:', err.message);
    }
  }

  const newReport = {
    title, location, description, severity, lat, lng, reporter,
    photo: photoUrl,
    status: 'reported'
  };

  const { data, error } = await supabase
    .from('reports')
    .insert([newReport])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  res.json({ success: true, data });
});

// PATCH: Claim a report
app.patch('/api/reports/:id/claim', async (req, res) => {
  const { id } = req.params;
  const { volunteer } = req.body;

  const { data, error } = await supabase
    .from('reports')
    .update({ status: 'in-progress', volunteer: volunteer || 'Anonymous' })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data });
});

// PATCH: Mark cleaned (With Before/After photo logic)
app.patch('/api/reports/:id/clean', async (req, res) => {
  const { id } = req.params;
  const { afterPhotoBase64 } = req.body;

  let afterPhotoUrl = null;

  if (afterPhotoBase64) {
    try {
      const base64Data = afterPhotoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `proof_${Date.now()}_${uuidv4().substring(0,6)}.jpg`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('cleanmap-evidence')
        .upload(filename, buffer, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('cleanmap-evidence')
        .getPublicUrl(filename);
      
      afterPhotoUrl = publicUrlData.publicUrl;
    } catch (err) {
      console.error('Proof image upload failed:', err.message);
    }
  }

  const { data, error } = await supabase
    .from('reports')
    .update({ status: 'cleaned', after_photo: afterPhotoUrl })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data });
});

// GET Dash Stats
app.get('/api/stats', async (req, res) => {
  try {
    const { data: reports, error } = await supabase.from('reports').select('*');
    if (error) throw error;

    let total = 0, reported = 0, inProgress = 0, cleaned = 0;
    let severityCounts = { low: 0, medium: 0, high: 0 };

    reports.forEach(r => {
      total++;
      if (r.status === 'reported') reported++;
      if (r.status === 'in-progress') inProgress++;
      if (r.status === 'cleaned') cleaned++;
      
      if (severityCounts[r.severity] !== undefined) {
        severityCounts[r.severity]++;
      }
    });

    const recentActivity = reports
      .filter(r => r.status !== 'reported' || new Date(r.created_at) > new Date(Date.now() - 86400000))
      .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(r => ({
        id: r.id,
        action: r.status === 'cleaned' ? 'cleaned' : (r.status === 'in-progress' ? 'claimed' : 'created'),
        report_title: r.title,
        details: r.status === 'cleaned' ? 'Cleanup confirmed' : (r.status === 'in-progress' ? `Claimed by ${r.volunteer}` : 'New report filed'),
        created_at: r.created_at
      }));

    res.json({
      success: true,
      data: {
        total, reported, inProgress, cleaned,
        severity: severityCounts,
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// For Vercel Serverless exporting, express instance must be exported
module.exports = app;

// Local development binding
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🌿 CleanMap (Supabase) Server running locally at http://localhost:${PORT}`);
  });
}
