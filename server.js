const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Database Setup ──
const db = new Database(path.join(__dirname, 'wastewatch.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT DEFAULT '',
    severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'reported' CHECK(status IN ('reported', 'in-progress', 'cleaned')),
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    reporter TEXT NOT NULL DEFAULT 'Anonymous',
    volunteer TEXT DEFAULT NULL,
    photo TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Try to add the photo column for existing databases (this will fail silently if it already exists, which is fine for sqlite or we can check first)
  -- SQLite does not have "ADD COLUMN IF NOT EXISTS" natively before 3.32, but better-sqlite3 handles try/catch well.
`);

try {
  db.exec('ALTER TABLE reports ADD COLUMN photo TEXT;');
} catch (e) {
  // Column likely already exists
}

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT DEFAULT 'System',
    details TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
  );
`);

// ── Seed Initial Data ──
const count = db.prepare('SELECT COUNT(*) as cnt FROM reports').get();
if (count.cnt === 0) {
  const insert = db.prepare(`
    INSERT INTO reports (id, title, location, description, severity, status, lat, lng, reporter, volunteer, created_at)
    VALUES (@id, @title, @location, @description, @severity, @status, @lat, @lng, @reporter, @volunteer, @created_at)
  `);

  const seedData = [
    {
      id: 'r1', title: 'Plastic waste piled near lake', location: 'Potheri Lake, SRM Nagar',
      description: 'Large accumulation of plastic bottles and carry bags along the northern bank. Approx 50kg.',
      severity: 'high', status: 'reported', lat: 12.8235, lng: 80.0395,
      reporter: 'Ananya S.', volunteer: null, created_at: '2026-04-08T09:30:00'
    },
    {
      id: 'r2', title: 'Construction debris on sidewalk', location: 'Near SRM Main Gate, GST Road',
      description: 'Broken bricks, concrete pieces, and metal rods left on the pedestrian walkway.',
      severity: 'medium', status: 'in-progress', lat: 12.8190, lng: 80.0470,
      reporter: 'Rahul K.', volunteer: 'Priya M.', created_at: '2026-04-07T14:15:00'
    },
    {
      id: 'r3', title: 'Food waste dumped behind canteen', location: 'SRM Food Court Area',
      description: 'Rotting food waste and packaging attracting stray animals. Hygiene concern.',
      severity: 'high', status: 'reported', lat: 12.8240, lng: 80.0460,
      reporter: 'Kavitha R.', volunteer: null, created_at: '2026-04-09T18:00:00'
    },
    {
      id: 'r4', title: 'E-waste near bus stop', location: 'Guduvanchery Bus Terminal',
      description: 'Old monitors, keyboards, and cables dumped behind the shelter. About 10 items.',
      severity: 'medium', status: 'reported', lat: 12.8440, lng: 80.0620,
      reporter: 'Deepak V.', volunteer: null, created_at: '2026-04-06T11:45:00'
    },
    {
      id: 'r5', title: 'Paper and cardboard litter', location: 'Chengalpattu Railway Station',
      description: 'Scattered newspapers and packaging boxes around platform 2 entrance.',
      severity: 'low', status: 'cleaned', lat: 12.6929, lng: 79.9752,
      reporter: 'Sundar M.', volunteer: 'Campus Green Club', created_at: '2026-04-05T08:20:00'
    },
    {
      id: 'r6', title: 'Textile waste in empty plot', location: 'Behind SRM Hostel Block 12',
      description: 'Old clothes, mattress stuffing and torn fabric piled up. Potential fire hazard.',
      severity: 'low', status: 'reported', lat: 12.8210, lng: 80.0415,
      reporter: 'Meera J.', volunteer: null, created_at: '2026-04-09T07:30:00'
    },
    {
      id: 'r7', title: 'Medical waste near clinic', location: 'SRM Medical College Road',
      description: 'Used syringes and bandages found in open bin outside the clinic. Biohazard risk.',
      severity: 'high', status: 'in-progress', lat: 12.8200, lng: 80.0500,
      reporter: 'Dr. Arun P.', volunteer: 'Health Committee', created_at: '2026-04-08T16:00:00'
    },
    {
      id: 'r8', title: 'Tire dump near highway', location: 'GST Road, Near Potheri Flyover',
      description: 'Over 30 used tires stacked and abandoned on the service road shoulder.',
      severity: 'medium', status: 'reported', lat: 12.8300, lng: 80.0520,
      reporter: 'Vikram S.', volunteer: null, created_at: '2026-04-09T12:00:00'
    }
  ];

  const insertMany = db.transaction((data) => {
    for (const item of data) {
      insert.run(item);
    }
  });

  insertMany(seedData);
  console.log('✅ Seeded database with initial reports');
}

// ── API Routes ──

// GET all reports
app.get('/api/reports', (req, res) => {
  try {
    const { status, severity, search } = req.query;
    let query = 'SELECT * FROM reports WHERE 1=1';
    const params = {};

    if (status && status !== 'all') {
      query += ' AND status = @status';
      params.status = status;
    }
    if (severity && severity !== 'all') {
      query += ' AND severity = @severity';
      params.severity = severity;
    }
    if (search) {
      query += ' AND (title LIKE @search OR location LIKE @search OR description LIKE @search)';
      params.search = `%${search}%`;
    }

    query += ' ORDER BY created_at DESC';
    const reports = db.prepare(query).all(params);
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single report
app.get('/api/reports/:id', (req, res) => {
  try {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create report
app.post('/api/reports', (req, res) => {
  try {
    const { title, location, description, severity, lat, lng, reporter, photoBase64 } = req.body;

    if (!title || !location || !severity || lat == null || lng == null) {
      return res.status(400).json({ success: false, error: 'Missing required fields: title, location, severity, lat, lng' });
    }

    const id = 'r' + Date.now();
    const now = new Date().toISOString();
    let photoUrl = null;

    if (photoBase64) {
      // Remove data URL scheme if present
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${id}.jpg`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, buffer);
      photoUrl = `/uploads/${filename}`;
    }

    db.prepare(`
      INSERT INTO reports (id, title, location, description, severity, status, lat, lng, reporter, photo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'reported', ?, ?, ?, ?, ?, ?)
    `).run(id, title, location, description || '', severity, lat, lng, reporter || 'Anonymous', photoUrl, now, now);

    db.prepare(`
      INSERT INTO activity_log (report_id, action, actor, details) VALUES (?, 'created', ?, ?)
    `).run(id, reporter || 'Anonymous', `New ${severity} severity report: ${title}`);

    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH claim report
app.patch('/api/reports/:id/claim', (req, res) => {
  try {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    if (report.status !== 'reported') return res.status(400).json({ success: false, error: 'Can only claim reported spots' });

    const volunteer = req.body.volunteer || 'Volunteer';
    const now = new Date().toISOString();

    db.prepare(`UPDATE reports SET status = 'in-progress', volunteer = ?, updated_at = ? WHERE id = ?`)
      .run(volunteer, now, req.params.id);

    db.prepare(`INSERT INTO activity_log (report_id, action, actor, details) VALUES (?, 'claimed', ?, ?)`)
      .run(req.params.id, volunteer, `Claimed for cleanup by ${volunteer}`);

    const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH mark cleaned
app.patch('/api/reports/:id/clean', (req, res) => {
  try {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    if (report.status !== 'in-progress') return res.status(400).json({ success: false, error: 'Can only clean in-progress spots' });

    const now = new Date().toISOString();
    db.prepare(`UPDATE reports SET status = 'cleaned', updated_at = ? WHERE id = ?`)
      .run(now, req.params.id);

    db.prepare(`INSERT INTO activity_log (report_id, action, actor, details) VALUES (?, 'cleaned', ?, ?)`)
      .run(req.params.id, report.volunteer || 'Unknown', `Marked as cleaned`);

    const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE report
app.delete('/api/reports/:id', (req, res) => {
  try {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

    db.prepare('DELETE FROM reports WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET dashboard stats
app.get('/api/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM reports').get().count;
    const reported = db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'reported'").get().count;
    const inProgress = db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'in-progress'").get().count;
    const cleaned = db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'cleaned'").get().count;
    const high = db.prepare("SELECT COUNT(*) as count FROM reports WHERE severity = 'high'").get().count;
    const medium = db.prepare("SELECT COUNT(*) as count FROM reports WHERE severity = 'medium'").get().count;
    const low = db.prepare("SELECT COUNT(*) as count FROM reports WHERE severity = 'low'").get().count;

    const recentActivity = db.prepare(`
      SELECT al.*, r.title as report_title 
      FROM activity_log al 
      JOIN reports r ON al.report_id = r.id 
      ORDER BY al.created_at DESC LIMIT 10
    `).all();

    res.json({
      success: true,
      data: {
        total, reported, inProgress, cleaned,
        severity: { high, medium, low },
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET activity log
app.get('/api/activity', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT al.*, r.title as report_title 
      FROM activity_log al 
      LEFT JOIN reports r ON al.report_id = r.id 
      ORDER BY al.created_at DESC LIMIT 50
    `).all();
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for SPA
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log(`\n🌿 WasteWatch Server running at http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api/reports`);
  console.log(`📋 Dashboard stats at http://localhost:${PORT}/api/stats\n`);
});
