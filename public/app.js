// ═══════════════════════════════════════════
// CleanMap — Frontend Application
// ═══════════════════════════════════════════

const API_BASE = window.location.origin + '/api';
const CENTER = [12.8231, 80.0444];

let reports = [];
let activeFilter = 'all';
let currentMapStyle = 'liberty';

// ═══════════════════════════════════════════
// THEME MANAGEMENT
// ═══════════════════════════════════════════

function getStoredTheme() {
  return localStorage.getItem('cleanmap_theme') || 'light';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('cleanmap_theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

setTheme(getStoredTheme());
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

// ═══════════════════════════════════════════
// MAP TILE LAYERS
// ═══════════════════════════════════════════

const TILE_STYLES = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron'
};

let mainTileLayer = null;
let reportTileLayer = null;

function createTileLayer(map, styleKey) {
  return L.maplibreGL({
    style: TILE_STYLES[styleKey],
    attribution: '<a href="https://openfreemap.org">OpenFreeMap</a>'
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

document.querySelectorAll('.style-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
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
  } catch (err) {
    console.error(err);
    showToast(false, 'Failed to connect to server.');
  }
  return [];
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
  } catch (err) {
    showToast(false, 'Submission failed');
  }
  return null;
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
      showToast(true, 'Task assigned to you.');
      await refreshAll();
    }
  } catch (err) {}
}

async function markCleaned(id) {
  try {
    const res = await fetch(`${API_BASE}/reports/${id}/clean`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(true, 'Marked as resolved.');
      await refreshAll();
    }
  } catch (err) {}
}

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();
    if (data.success) return data.data;
  } catch (err) {}
  return null;
}

window.claimReport = claimReport;
window.markCleaned = markCleaned;

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════

const navBtns = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.panel');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.panel;
    navBtns.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(`panel-${target}`).classList.add('active');

    if (target === 'map') { setTimeout(() => mainMap.invalidateSize(), 50); }
    if (target === 'report') { setTimeout(() => reportMap.invalidateSize(), 50); }
    if (target === 'dashboard') { renderDashboard(); }
  });
});

// ═══════════════════════════════════════════
// MAP MARKERS & POPUPS
// ═══════════════════════════════════════════

const mainMap = L.map('map', { zoomControl: false }).setView(CENTER, 14);
mainTileLayer = createTileLayer(mainMap, currentMapStyle);
L.control.zoom({ position: 'topright' }).addTo(mainMap);

let mainMarkers = {};
let reportTabMarkers = {};

function createIcon(r) {
  let color = 'var(--color-medium)';
  if (r.status === 'cleaned') color = 'var(--color-cleaned)';
  else if (r.status === 'in-progress') color = 'var(--color-progress)';
  else if (r.severity === 'high') color = 'var(--color-high)';
  else if (r.severity === 'low') color = 'var(--color-low)';

  return L.divIcon({
    className: '',
    html: `<div class="marker-pin" style="color: ${color}"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14]
  });
}

function popupContent(r) {
  const photoHtml = r.photo ? `<img class="popup-img" src="${r.photo}" alt="Report photo" />` : '';
  const dateStr = new Date(r.created_at || r.date).toLocaleDateString();
  
  let actions = '';
  if (r.status === 'reported') {
    actions = `<button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="claimReport('${r.id}')"><i class="ph ph-handshake"></i> Claim Task</button>`;
  } else if (r.status === 'in-progress') {
    actions = `<button class="btn btn-secondary btn-block" style="margin-top:12px;" onclick="markCleaned('${r.id}')"><i class="ph ph-check-circle"></i> Mark Resolved</button>`;
  }

  const volHtml = r.volunteer ? `<br/>Assigned: ${r.volunteer}` : '';

  return `
    ${photoHtml}
    <div class="popup-title">${r.title}</div>
    <div class="popup-loc"><i class="ph ph-map-pin"></i> ${r.location}</div>
    <div class="popup-desc">${r.description || 'No description provided.'}</div>
    <div>
      <span class="badge sev-${r.severity}"><span class="badge-dot"></span> ${r.severity}</span>
      <span class="status-pill ${r.status}" style="float:right;">${r.status.replace('-', ' ')}</span>
    </div>
    ${actions}
    <div class="popup-footer">
      Filed by ${r.reporter} on ${dateStr}${volHtml}
    </div>
  `;
}

function renderMapMarkers() {
  Object.values(mainMarkers).forEach(m => mainMap.removeLayer(m));
  mainMarkers = {};

  if (typeof reportMap !== 'undefined' && reportMap) {
    Object.values(reportTabMarkers).forEach(m => reportMap.removeLayer(m));
    reportTabMarkers = {};
  }

  reports.forEach(r => {
    // Add to main map
    const mainMarker = L.marker([r.lat, r.lng], { icon: createIcon(r) })
      .bindPopup(popupContent(r), { className: 'custom-popup' })
      .addTo(mainMap);
    mainMarkers[r.id] = mainMarker;

    // Add to report map (if loaded)
    if (typeof reportMap !== 'undefined' && reportMap) {
      const rmMarker = L.marker([r.lat, r.lng], { icon: createIcon(r), opacity: 0.6 })
        .bindPopup(popupContent(r), { className: 'custom-popup' })
        .addTo(reportMap);
      reportTabMarkers[r.id] = rmMarker;
    }
  });
}

// ═══════════════════════════════════════════
// CARDS LIST (Sidebar)
// ═══════════════════════════════════════════

function renderReportCards() {
  const list = document.getElementById('reports-list');
  list.innerHTML = '';

  const filtered = reports.filter(r => {
    if (activeFilter === 'all') return true;
    return r.status === activeFilter;
  });

  document.getElementById('report-count').textContent = filtered.length;

  if (filtered.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding: 40px 0; color: var(--text-light);">No items to show.</div>`;
    return;
  }

  filtered.forEach(r => {
    const card = document.createElement('div');
    card.className = 'report-card';
    card.addEventListener('click', () => {
      mainMap.flyTo([r.lat, r.lng], 16, { duration: 1 });
      setTimeout(() => mainMarkers[r.id]?.openPopup(), 600);
    });

    const dateStr = new Date(r.created_at || r.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    
    let btnHtml = '';
    if (r.status === 'reported') {
      btnHtml = `<button class="btn btn-primary btn-action" onclick="event.stopPropagation(); claimReport('${r.id}')">Claim Task</button>`;
    } else if (r.status === 'in-progress') {
      btnHtml = `<button class="btn btn-secondary btn-action" onclick="event.stopPropagation(); markCleaned('${r.id}')">Resolve Target</button>`;
    }

    card.innerHTML = `
      <div class="card-top">
        <div class="card-title">${r.title}</div>
        <div class="badge sev-${r.severity}"><span class="badge-dot"></span>${r.severity}</div>
      </div>
      <div class="card-loc"><i class="ph ph-map-pin-line"></i> ${r.location}</div>
      <div class="card-meta">
        <span class="status-pill ${r.status}">
          <i class="ph ${r.status === 'cleaned' ? 'ph-check-circle' : 'ph-clock'}"></i>
          ${r.status.replace('-',' ')}
        </span>
        <span class="card-date">${dateStr}</span>
      </div>
      ${btnHtml}
    `;

    list.appendChild(card);
  });
}

document.querySelectorAll('.filter-tab').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(c => c.classList.remove('active'));
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
  searchClear.style.display = q ? 'block' : 'none';

  searchTimeout = setTimeout(async () => {
    if (q.length >= 2) await fetchReports({ search: q });
    else await fetchReports();
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
  const pct = (n) => total > 0 ? ((n / total) * 100).toFixed(1) : 0;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <div class="stat-val">${total}</div>
      <div class="stat-title">Total Logs</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color:var(--color-medium)">${reported}</div>
      <div class="stat-title">Pending Action</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color:var(--color-progress)">${inProgress}</div>
      <div class="stat-title">In Progress</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color:var(--color-cleaned)">${cleaned}</div>
      <div class="stat-title">Resolved</div>
    </div>
  `;

  document.getElementById('severity-bars').innerHTML = `
    <div class="sev-row">
      <span class="sev-label">High</span>
      <div class="sev-track"><div class="sev-fill high" style="width:${pct(severity.high)}%"></div></div>
      <span style="font-size:0.8rem; font-weight:600; width:40px; text-align:right">${severity.high}</span>
    </div>
    <div class="sev-row">
      <span class="sev-label">Medium</span>
      <div class="sev-track"><div class="sev-fill medium" style="width:${pct(severity.medium)}%"></div></div>
      <span style="font-size:0.8rem; font-weight:600; width:40px; text-align:right">${severity.medium}</span>
    </div>
    <div class="sev-row">
      <span class="sev-label">Low</span>
      <div class="sev-track"><div class="sev-fill low" style="width:${pct(severity.low)}%"></div></div>
      <span style="font-size:0.8rem; font-weight:600; width:40px; text-align:right">${severity.low}</span>
    </div>
  `;

  const feed = document.getElementById('activity-feed');
  if (recentActivity && recentActivity.length > 0) {
    feed.innerHTML = recentActivity.map(a => {
      let icon = 'ph-info';
      if (a.action === 'created') icon = 'ph-plus';
      if (a.action === 'claimed') icon = 'ph-handshake';
      if (a.action === 'cleaned') icon = 'ph-check';
      
      return `
        <div class="activity-item">
          <div class="act-icon"><i class="ph ${icon}"></i></div>
          <div class="act-body">
            <div class="act-title">${a.report_title}</div>
            <div class="act-desc">${a.details}</div>
            <div class="act-time">${new Date(a.created_at).toLocaleString()}</div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    feed.innerHTML = `<div style="text-align:center; padding: 20px 0; color: var(--text-light);">No activity.</div>`;
  }
}

document.getElementById('refresh-dashboard').addEventListener('click', function () {
  renderDashboard();
});

// ═══════════════════════════════════════════
// REPORT FORM + COMPRESSION
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
      html: `<div class="marker-pin" style="color: var(--color-progress);"></div>`,
      iconSize: [24, 24], iconAnchor: [12, 12]
    }),
    zIndexOffset: 1000
  }).addTo(reportMap);

  const pinBox = document.getElementById('pin-indicator');
  pinBox.classList.add('active');
  pinBox.innerHTML = `<i class="ph-fill ph-map-pin"></i><span>Set to: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}</span>`;
  checkFormValidity();
});

function useGeolocation() {
  if (!navigator.geolocation) { showToast(false, 'Geolocation not supported'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
    reportLatLng = latlng;
    reportMap.flyTo(latlng, 16);
    if (reportPin) reportMap.removeLayer(reportPin);
    
    reportPin = L.marker(latlng, {
      icon: L.divIcon({
        className: '',
        html: `<div class="marker-pin" style="color: var(--color-progress);"></div>`,
        iconSize: [24, 24], iconAnchor: [12, 12]
      }),
      zIndexOffset: 1000
    }).addTo(reportMap);
    
    const pinBox = document.getElementById('pin-indicator');
    pinBox.classList.add('active');
    pinBox.innerHTML = `<i class="ph-fill ph-crosshair"></i><span>GPS Lock: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}</span>`;
    checkFormValidity();
  });
}

document.getElementById('geo-btn').addEventListener('click', useGeolocation);

document.querySelectorAll('.sev-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.sev-opt').forEach(o => o.classList.remove('selected'));
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
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
}

document.getElementById('submit-report').addEventListener('click', async () => {
  const btn = document.getElementById('submit-report');
  btn.disabled = true;
  btn.textContent = 'Processing...';

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
    document.getElementById('report-title').value = '';
    document.getElementById('report-location').value = '';
    document.getElementById('report-desc').value = '';
    document.getElementById('report-reporter').value = '';
    document.getElementById('report-photo').value = '';
    document.querySelectorAll('.sev-opt').forEach(o => o.classList.remove('selected'));
    selectedSeverity = null;
    if (reportPin) { reportMap.removeLayer(reportPin); reportPin = null; }
    reportLatLng = null;
    
    document.getElementById('pin-indicator').classList.remove('active');
    document.getElementById('pin-indicator').innerHTML = `<i class="ph ph-map-pin"></i><span>Click on map to register coordinates</span><button class="btn-text" id="geo-btn">Use GPS</button>`;
    document.getElementById('geo-btn').addEventListener('click', useGeolocation);

    showToast(true, 'File recorded to global system.');

    document.querySelector('[data-panel="map"]').click();
    await refreshAll();
    setTimeout(() => {
      mainMap.flyTo([newReport.lat, newReport.lng], 16, { duration: 1 });
      setTimeout(() => mainMarkers[newReport.id]?.openPopup(), 600);
    }, 300);
  }

  btn.disabled = false;
  btn.textContent = 'Submit into System';
  checkFormValidity();
});

function showToast(success, msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-icon').className = success ? 'ph ph-check-circle' : 'ph ph-warning-circle';
  document.getElementById('toast-icon').style.color = success ? 'var(--color-cleaned)' : 'var(--color-medium)';
  document.getElementById('toast-msg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

async function refreshAll() {
  await fetchReports();
  renderMapMarkers();
  renderReportCards();
}

(async function init() {
  await fetchReports();
  renderMapMarkers();
  renderReportCards();
  setTimeout(() => mainMap.invalidateSize(), 150);
})();
