// ═══════════════════════════════════════════
// WasteWatch — Frontend Application
// ═══════════════════════════════════════════

const API_BASE = window.location.origin + '/api';
const CENTER = [12.8231, 80.0444]; // SRM / Chengalpattu area

let reports = [];
let activeFilter = 'all';
let currentMapStyle = 'liberty';

// ═══════════════════════════════════════════
// THEME MANAGEMENT
// ═══════════════════════════════════════════

function getStoredTheme() {
  return localStorage.getItem('wastewatch_theme') || 'dark';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('wastewatch_theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// Initialize theme
setTheme(getStoredTheme());

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

// ═══════════════════════════════════════════
// MAP TILE LAYERS (OpenFreeMap via MapLibre GL Leaflet)
// ═══════════════════════════════════════════

const TILE_STYLES = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty', // Google Maps-like
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron' // Clean/Light
};

let mainTileLayer = null;
let reportTileLayer = null;

function createTileLayer(map, styleKey) {
  return L.maplibreGL({
    style: TILE_STYLES[styleKey],
    attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>'
  }).addTo(map);
}

function updateMapTiles() {
  if (mainTileLayer && mainMap) {
    mainMap.removeLayer(mainTileLayer);
    mainTileLayer = createTileLayer(mainMap, currentMapStyle);
  }

  if (reportTileLayer && reportMap) {
    reportMap.removeLayer(reportTileLayer);
    reportTileLayer = createTileLayer(reportMap, currentMapStyle);
  }
}

// Map style switcher
document.querySelectorAll('.map-style-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.map-style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMapStyle = btn.dataset.style;
    updateMapTiles();
  });
});

// ═══════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════

async function fetchReports(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/reports${query ? '?' + query : ''}`);
    const data = await res.json();
    if (data.success) {
      reports = data.data;
      return reports;
    }
    throw new Error(data.error);
  } catch (err) {
    console.error('Failed to fetch reports:', err);
    showToast('⚠️', 'Failed to load reports from server');
    return [];
  }
}

async function createReport(reportData) {
  try {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    });
    const data = await res.json();
    if (data.success) return data.data;
    throw new Error(data.error);
  } catch (err) {
    console.error('Failed to create report:', err);
    showToast('⚠️', 'Failed to submit report');
    return null;
  }
}

async function claimReport(id) {
  try {
    const res = await fetch(`${API_BASE}/reports/${id}/claim`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volunteer: 'You' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('🤝', `Claimed "${data.data.title}" — you're a hero!`);
      await refreshAll();
      return data.data;
    }
    throw new Error(data.error);
  } catch (err) {
    console.error('Failed to claim report:', err);
    showToast('⚠️', 'Failed to claim report');
    return null;
  }
}

async function markCleaned(id) {
  try {
    const res = await fetch(`${API_BASE}/reports/${id}/clean`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎉', `"${data.data.title}" marked as cleaned!`);
      await refreshAll();
      return data.data;
    }
    throw new Error(data.error);
  } catch (err) {
    console.error('Failed to mark cleaned:', err);
    showToast('⚠️', 'Failed to update report');
    return null;
  }
}

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();
    if (data.success) return data.data;
    throw new Error(data.error);
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    return null;
  }
}

// Expose to global for popup buttons
window.claimReport = claimReport;
window.markCleaned = markCleaned;

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════

const navBtns = document.querySelectorAll('.nav-btn');
const panels = document.querySelectorAll('.panel');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.panel;
    navBtns.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`panel-${target}`).classList.add('active');

    if (target === 'map') { setTimeout(() => mainMap.invalidateSize(), 100); }
    if (target === 'report') { setTimeout(() => reportMap.invalidateSize(), 100); }
    if (target === 'dashboard') { renderDashboard(); }
  });
});

// ═══════════════════════════════════════════
// MAP SETUP
// ═══════════════════════════════════════════

function markerClass(report) {
  if (report.status === 'cleaned') return 'cleaned';
  if (report.status === 'in-progress') return 'in-progress';
  return report.severity;
}

function createIcon(report) {
  return L.divIcon({
    className: '',
    html: `<div class="custom-marker ${markerClass(report)}"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -32]
  });
}

// ── Main Map ──
const mainMap = L.map('map', { zoomControl: false }).setView(CENTER, 14);
mainTileLayer = createTileLayer(mainMap, currentMapStyle);
L.control.zoom({ position: 'topright' }).addTo(mainMap);

let mainMarkers = {};
let reportTabMarkers = {}; // Markers for the report tab

function popupContent(r) {
  const sevColors = {
    high: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    medium: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    low: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' }
  };
  const statusColors = {
    cleaned: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    'in-progress': { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
    reported: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
  };

  const sc = sevColors[r.severity];
  const stc = statusColors[r.status];

  const sevBadge = `<span class="popup-badge" style="background:${sc.bg};color:${sc.color}">${r.severity}</span>`;
  const statusBadge = `<span class="popup-badge" style="background:${stc.bg};color:${stc.color}">${r.status.replace('-', ' ')}</span>`;

  let actions = '';
  if (r.status === 'reported') {
    actions = `<div class="popup-actions"><button class="popup-btn popup-btn-claim" onclick="claimReport('${r.id}')">🤝 Claim for Cleanup</button></div>`;
  } else if (r.status === 'in-progress') {
    actions = `<div class="popup-actions"><button class="popup-btn popup-btn-clean" onclick="markCleaned('${r.id}')">✅ Mark Cleaned</button></div>`;
  }

  const dateStr = new Date(r.created_at || r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const photoHtml = r.photo ? `<img class="popup-img" src="${r.photo}" alt="Report photo" />` : '';

  return `
    ${photoHtml}
    <div class="popup-title">${r.title}</div>
    <div class="popup-loc">📍 ${r.location}</div>
    <div class="popup-desc">${r.description || 'No description provided.'}</div>
    <div>${sevBadge} ${statusBadge}</div>
    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;">Reported by ${r.reporter} · ${dateStr}</div>
    ${r.volunteer ? `<div style="font-size:0.72rem;color:#3b82f6;margin-top:2px;">👤 Volunteer: ${r.volunteer}</div>` : ''}
    ${actions}
  `;
}

function renderMapMarkers() {
  // Clear both maps
  Object.values(mainMarkers).forEach(m => mainMap.removeLayer(m));
  mainMarkers = {};

  if (typeof reportMap !== 'undefined' && reportMap) {
    Object.values(reportTabMarkers).forEach(m => reportMap.removeLayer(m));
    reportTabMarkers = {};
  }

  reports.forEach(r => {
    // Add to main map
    const mainMarker = L.marker([r.lat, r.lng], { icon: createIcon(r) })
      .bindPopup(popupContent(r), { maxWidth: 320, className: 'custom-popup' })
      .addTo(mainMap);
    mainMarkers[r.id] = mainMarker;

    // Add to report map (if loaded)
    if (typeof reportMap !== 'undefined' && reportMap) {
      const rmMarker = L.marker([r.lat, r.lng], { icon: createIcon(r), opacity: 0.7 })
        .bindPopup(popupContent(r), { maxWidth: 320, className: 'custom-popup' })
        .addTo(reportMap);
      reportTabMarkers[r.id] = rmMarker;
    }
  });
}

// ═══════════════════════════════════════════
// REPORT CARDS (Sidebar)
// ═══════════════════════════════════════════

function renderReportCards() {
  const list = document.getElementById('reports-list');
  list.innerHTML = '';

  const filtered = reports.filter(r => {
    if (activeFilter === 'all') return true;
    if (['high', 'medium', 'low'].includes(activeFilter)) return r.severity === activeFilter;
    return r.status === activeFilter;
  });

  document.getElementById('report-count').textContent = filtered.length;

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">No reports match this filter.</div>
      </div>
    `;
    return;
  }

  filtered.forEach(r => {
    const card = document.createElement('div');
    card.className = 'report-card';
    card.dataset.severity = r.severity;
    card.dataset.status = r.status;

    let actionBtns = '';
    if (r.status === 'reported') {
      actionBtns = `<button class="action-btn btn-claim" onclick="event.stopPropagation(); claimReport('${r.id}')">🤝 Claim Cleanup</button>`;
    } else if (r.status === 'in-progress') {
      actionBtns = `<button class="action-btn btn-clean" onclick="event.stopPropagation(); markCleaned('${r.id}')">✅ Mark Cleaned</button>`;
    }

    const dateStr = new Date(r.created_at || r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const statusLabel = r.status === 'in-progress' ? 'In Progress' : r.status.charAt(0).toUpperCase() + r.status.slice(1);

    card.innerHTML = `
      <div class="report-card-top">
        <div class="report-title">${r.title}</div>
        <span class="severity-badge ${r.severity}">${r.severity}</span>
      </div>
      <div class="report-location">📍 ${r.location}</div>
      <div class="report-meta">
        <span class="status-pill ${r.status}">
          <span class="status-dot ${r.status}"></span>
          ${statusLabel}
        </span>
        <span class="report-date">${dateStr}</span>
      </div>
      ${actionBtns ? `<div class="card-actions">${actionBtns}</div>` : ''}
    `;

    card.addEventListener('click', () => {
      mainMap.flyTo([r.lat, r.lng], 17, { duration: 1.2 });
      setTimeout(() => mainMarkers[r.id]?.openPopup(), 800);
    });

    list.appendChild(card);
  });
}

// Filters
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    renderReportCards();
  });
});

// ═══════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════

const searchInput = document.getElementById('map-search-input');
const searchClear = document.getElementById('search-clear');
let searchTimeout = null;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  searchClear.style.display = q ? 'flex' : 'none';

  searchTimeout = setTimeout(async () => {
    if (q.length >= 2) {
      await fetchReports({ search: q });
    } else {
      await fetchReports();
    }
    renderMapMarkers();
    renderReportCards();
  }, 300);
});

searchClear.addEventListener('click', async () => {
  searchInput.value = '';
  searchClear.style.display = 'none';
  await fetchReports();
  renderMapMarkers();
  renderReportCards();
});

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════

async function renderDashboard() {
  const stats = await fetchStats();
  if (!stats) return;

  const { total, reported, inProgress, cleaned, severity, recentActivity } = stats;
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card total">
      <div class="stat-label">📊 Total Reports</div>
      <div class="stat-value">${total}</div>
      <div class="stat-sub">All submitted waste spots</div>
    </div>
    <div class="stat-card reported-stat">
      <div class="stat-label">⏳ Awaiting Pickup</div>
      <div class="stat-value">${reported}</div>
      <div class="stat-sub">${pct(reported)}% of total reports</div>
    </div>
    <div class="stat-card progress">
      <div class="stat-label">🔄 In Progress</div>
      <div class="stat-value">${inProgress}</div>
      <div class="stat-sub">${pct(inProgress)}% being cleaned</div>
    </div>
    <div class="stat-card cleaned-stat">
      <div class="stat-label">✅ Cleaned</div>
      <div class="stat-value">${cleaned}</div>
      <div class="stat-sub">${pct(cleaned)}% resolved 🎉</div>
    </div>
  `;

  document.getElementById('severity-bars').innerHTML = `
    <div class="sev-bar-row">
      <span class="sev-bar-label" style="color:var(--accent-red)">🔴 High</span>
      <div class="sev-bar-track"><div class="sev-bar-fill high" style="width:${pct(severity.high)}%"></div></div>
      <span class="sev-bar-count">${severity.high}</span>
    </div>
    <div class="sev-bar-row">
      <span class="sev-bar-label" style="color:var(--accent-orange)">🟠 Medium</span>
      <div class="sev-bar-track"><div class="sev-bar-fill medium" style="width:${pct(severity.medium)}%"></div></div>
      <span class="sev-bar-count">${severity.medium}</span>
    </div>
    <div class="sev-bar-row">
      <span class="sev-bar-label" style="color:var(--accent-green)">🟢 Low</span>
      <div class="sev-bar-track"><div class="sev-bar-fill low" style="width:${pct(severity.low)}%"></div></div>
      <span class="sev-bar-count">${severity.low}</span>
    </div>
  `;

  // Activity Feed
  const activityFeed = document.getElementById('activity-feed');
  if (recentActivity && recentActivity.length > 0) {
    activityFeed.innerHTML = recentActivity.map(a => {
      const timeAgo = getTimeAgo(new Date(a.created_at));
      return `
        <div class="activity-item">
          <div class="activity-dot ${a.action}"></div>
          <div class="activity-content">
            <div class="activity-title">${a.report_title || 'Unknown Report'}</div>
            <div class="activity-detail">${a.details}</div>
          </div>
          <div class="activity-time">${timeAgo}</div>
        </div>
      `;
    }).join('');
  } else {
    activityFeed.innerHTML = `<div class="empty-state"><div class="empty-state-text">No activity yet</div></div>`;
  }
}

function getTimeAgo(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

document.getElementById('refresh-dashboard').addEventListener('click', function () {
  this.classList.add('spinning');
  renderDashboard().then(() => {
    setTimeout(() => this.classList.remove('spinning'), 600);
  });
});

// ═══════════════════════════════════════════
// REPORT FORM + MAP
// ═══════════════════════════════════════════

const reportMap = L.map('report-map', { zoomControl: false }).setView(CENTER, 14);
reportTileLayer = createTileLayer(reportMap, currentMapStyle);
L.control.zoom({ position: 'topright' }).addTo(reportMap);

let reportPin = null;
let reportLatLng = null;
let selectedSeverity = null;

reportMap.on('click', (e) => {
  reportLatLng = e.latlng;
  if (reportPin) reportMap.removeLayer(reportPin);
  reportPin = L.marker(e.latlng, {
    icon: L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;background:var(--accent-blue);border:3px solid white;border-radius:50%;box-shadow:0 2px 12px rgba(59,130,246,0.5);animation:pulse-dot 1.5s infinite;"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    })
  }).addTo(reportMap);

  const pinEl = document.getElementById('pin-indicator');
  pinEl.className = 'pin-indicator has-pin';
  pinEl.innerHTML = `<span>📌 ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}</span><button class="geo-btn" onclick="useGeolocation()">📡 My Location</button>`;
  checkFormValidity();
});

// Geolocation
function useGeolocation() {
  if (!navigator.geolocation) {
    showToast('⚠️', 'Geolocation not supported in this browser');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
    reportLatLng = latlng;
    reportMap.flyTo(latlng, 16);
    if (reportPin) reportMap.removeLayer(reportPin);
    reportPin = L.marker(latlng, {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;background:var(--accent-blue);border:3px solid white;border-radius:50%;box-shadow:0 2px 12px rgba(59,130,246,0.5);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).addTo(reportMap);
    const pinEl = document.getElementById('pin-indicator');
    pinEl.className = 'pin-indicator has-pin';
    pinEl.innerHTML = `<span>📌 ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)} (GPS)</span>`;
    checkFormValidity();
  }, () => {
    showToast('⚠️', 'Could not get your location');
  });
}
window.useGeolocation = useGeolocation;

document.getElementById('geo-btn').addEventListener('click', useGeolocation);

// Severity selector
document.querySelectorAll('.sev-option').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.sev-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedSeverity = opt.dataset.sev;
    checkFormValidity();
  });
});

function checkFormValidity() {
  const title = document.getElementById('report-title').value.trim();
  const loc = document.getElementById('report-location').value.trim();
  document.getElementById('submit-report').disabled = !(title && loc && reportLatLng && selectedSeverity);
}

document.getElementById('report-title').addEventListener('input', checkFormValidity);
document.getElementById('report-location').addEventListener('input', checkFormValidity);

// Image Compression Utility
function compressImage(file, maxWidth = 800) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to 70% JPEG quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
    };
  });
}

// Submit
document.getElementById('submit-report').addEventListener('click', async () => {
  const btn = document.getElementById('submit-report');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Submitting...';

  const photoFile = document.getElementById('report-photo').files[0];
  const photoBase64 = await compressImage(photoFile);

  const reportData = {
    title: document.getElementById('report-title').value.trim(),
    location: document.getElementById('report-location').value.trim(),
    description: document.getElementById('report-desc').value.trim(),
    severity: selectedSeverity,
    lat: reportLatLng.lat,
    lng: reportLatLng.lng,
    reporter: document.getElementById('report-reporter').value.trim() || 'Anonymous',
    photoBase64: photoBase64
  };

  const newReport = await createReport(reportData);

  if (newReport) {
    // Reset form
    document.getElementById('report-title').value = '';
    document.getElementById('report-location').value = '';
    document.getElementById('report-desc').value = '';
    document.getElementById('report-reporter').value = '';
    document.getElementById('report-photo').value = '';
    document.querySelectorAll('.sev-option').forEach(o => o.classList.remove('selected'));
    selectedSeverity = null;
    if (reportPin) { reportMap.removeLayer(reportPin); reportPin = null; }
    reportLatLng = null;
    const pinEl = document.getElementById('pin-indicator');
    pinEl.className = 'pin-indicator';
    pinEl.innerHTML = `<span>👆 Click on the map to place a pin</span><button class="geo-btn" id="geo-btn" onclick="useGeolocation()">📡 My Location</button>`;

    showToast('✅', `Report "${newReport.title}" submitted!`);

    // Switch to map and fly to new report
    document.querySelector('[data-panel="map"]').click();
    await refreshAll();
    setTimeout(() => {
      mainMap.flyTo([newReport.lat, newReport.lng], 17, { duration: 1.2 });
      setTimeout(() => mainMarkers[newReport.id]?.openPopup(), 800);
    }, 300);
  }

  btn.disabled = false;
  btn.innerHTML = '🚀 Submit Report';
  checkFormValidity();
});

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════

function showToast(icon, msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-icon').textContent = icon;
  document.getElementById('toast-msg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ═══════════════════════════════════════════
// REFRESH ALL
// ═══════════════════════════════════════════

async function refreshAll() {
  await fetchReports();
  renderMapMarkers();
  renderReportCards();
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════

(async function init() {
  // Load reports from backend
  await fetchReports();
  renderMapMarkers();
  renderReportCards();

  // Fix map sizes
  setTimeout(() => mainMap.invalidateSize(), 200);
})();
