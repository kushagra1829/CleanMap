// ═══════════════════════════════════════════
// CleanMap — Frontend Logic (Round 3)
// ═══════════════════════════════════════════

const API_BASE = window.location.origin + '/api';
const CENTER = [12.8231, 80.0444];

let reports = [];
let activeFilter = 'all';
let currentMapStyle = 'liberty';
let sbClient = null;

// ── Points Configuration ──
const POINTS = { low: 10, medium: 25, high: 50 };
let volunteerScores = {}; // Global cache for scores

// ═══════════════════════════════════════════
// INTERNATIONALIZATION (i18n)
// ═══════════════════════════════════════════

const translations = {
  en: {
    theme: "Theme", volunteer_leaderboard: "Volunteer Leaderboard",
    severity_breakdown: "Severity Breakdown", recent_action: "Recent Action Log",
    upload_proof_title: "Submit Cleanup Proof",
    upload_proof_desc: "Please provide an 'After' photo to verify this spot is completely resolved.",
    after_photo_label: "📸 After Photo (Required)", cancel: "Cancel", submit_proof: "Submit Proof",
    global_map: "Global Map", dashboard: "Dashboard", new_report: "New Report",
    active_reports: "Active Reports", all_tab: "All", pending_tab: "Pending",
    in_progress_tab: "In Progress", cleaned_tab: "Cleaned",
    platform_stats: "Platform Statistics", platform_subs: "Real-time overview of community activity",
    file_report: "File strong report", file_report_sub: "Pinpoint a location and add details.",
    map_loc_ref: "Map Location Reference", brief_title: "Brief Title",
    landmark: "Landmark / Street", detailed_desc: "Detailed Description",
    your_name: "Your Initials/Name", evidence_image: "Evidence Image (Before)",
    severity_class: "Severity Classification", submit_system: "Submit into System",
    legend: "Legend"
  },
  es: {
    theme: "Tema", volunteer_leaderboard: "Tabla de Voluntarios",
    severity_breakdown: "Desglose de Severidad", recent_action: "Registro Reciente",
    upload_proof_title: "Subir Prueba",
    upload_proof_desc: "Proporcione una foto del 'Después' para verificar que este lugar está resuelto.",
    after_photo_label: "📸 Foto del Después (Obligatorio)", cancel: "Cancelar", submit_proof: "Subir Prueba",
    global_map: "Mapa Global", dashboard: "Panel", new_report: "Nuevo Reporte",
    active_reports: "Reportes Activos", all_tab: "Todos", pending_tab: "Pendiente",
    in_progress_tab: "En Progreso", cleaned_tab: "Limpiado",
    platform_stats: "Estadísticas de la Plataforma", platform_subs: "Resumen en tiempo real de la comunidad",
    file_report: "Registrar reporte", file_report_sub: "Señala una ubicación y añade detalles.",
    map_loc_ref: "Referencia de Ubicación en el Mapa", brief_title: "Título Breve",
    landmark: "Punto de Referencia / Calle", detailed_desc: "Descripción Detallada",
    your_name: "Tus Iniciales/Nombre", evidence_image: "Imagen de Evidencia (Antes)",
    severity_class: "Clasificación de Severidad", submit_system: "Enviar al Sistema",
    legend: "Leyenda"
  },
  hi: {
    theme: "थीम", volunteer_leaderboard: "स्वयंसेवक लीडरबोर्ड",
    severity_breakdown: "गंभीरता का विवरण", recent_action: "हाल की कार्रवाई",
    upload_proof_title: "प्रमाण अपलोड करें",
    upload_proof_desc: "यह सत्यापित करने के लिए कि यह स्थान पूरी तरह से साफ हो गया है, कृपया एक 'बाद' की फोटो दें।",
    after_photo_label: "📸 बाद की फोटो (आवश्यक)", cancel: "रद्द करें", submit_proof: "प्रमाण जमा करें",
    global_map: "वैश्विक मानचित्र", dashboard: "डैशबोर्ड", new_report: "नया रिपोर्ट",
    active_reports: "सक्रिय रिपोर्ट", all_tab: "सभी", pending_tab: "लंबित",
    in_progress_tab: "प्रगति पर", cleaned_tab: "साफ किया",
    platform_stats: "प्लेटफ़ॉर्म आँकड़े", platform_subs: "समुदाय की गतिविधि का रीयल-टाइम अवलोकन",
    file_report: "रिपोर्ट दर्ज करें", file_report_sub: "स्थान को पिनपॉइंट करें और विवरण जोड़ें।",
    map_loc_ref: "मानचित्र स्थान संदर्भ", brief_title: "संक्षिप्त शीर्षक",
    landmark: "लैंडमार्क / सड़क", detailed_desc: "विस्तृत विवरण",
    your_name: "आपका नाम/प्रारंभिक", evidence_image: "साक्ष्य छवि (पहले)",
    severity_class: "गंभीरता वर्गीकरण", submit_system: "सिस्टम में सबमिट करें",
    legend: "संकेतकों"
  }
};

let currentLang = localStorage.getItem('cleanmap_lang') || 'en';
document.getElementById('lang-select').value = currentLang;

function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('cleanmap_lang', lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
}

document.getElementById('lang-select').addEventListener('change', (e) => {
  applyLanguage(e.target.value);
});

// ═══════════════════════════════════════════
// THEME MANAGEMENT
// ═══════════════════════════════════════════
function getStoredTheme() { return localStorage.getItem('cleanmap_theme') || 'light'; }
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('cleanmap_theme', theme);
}
document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});
setTheme(getStoredTheme());

// ═══════════════════════════════════════════
// MAP TILE LAYERS
// ═══════════════════════════════════════════
const TILE_STYLES = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron'
};

let mainTileLayer = null, reportTileLayer = null;

function createTileLayer(map, styleKey) {
  return L.maplibreGL({ style: TILE_STYLES[styleKey], attribution: '<a href="https://openfreemap.org">OpenFreeMap</a>' }).addTo(map);
}
function updateMapTiles() {
  if (mainTileLayer && mainMap) { mainMap.removeLayer(mainTileLayer); mainTileLayer = createTileLayer(mainMap, currentMapStyle); }
  if (reportTileLayer && reportMap) { reportMap.removeLayer(reportTileLayer); reportTileLayer = createTileLayer(reportMap, currentMapStyle); }
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
// SUPABASE REALTIME INITIALIZATION & CORE FETCH
// ═══════════════════════════════════════════
async function init() {
  applyLanguage(currentLang);

  // Grab keys safely generated by our Node Server / Vercel API
  const confRes = await fetch(`${API_BASE}/config`);
  const confData = await confRes.json();
  
  if (confData.success && confData.data.url) {
    sbClient = window.supabase.createClient(confData.data.url, confData.data.key);
    
    // Subscribe to Postgres changes for EVENT-DRIVEN UI
    sbClient.channel('custom-reports-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, payload => {
        // We do a smart data refresh. Since we know a state change happened locally or globally:
        refreshAllQuietly();
      })
      .subscribe();
  }

  await refreshAllQuietly();
  setTimeout(() => mainMap.invalidateSize(), 150);
}

async function fetchReports(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/reports${query ? '?' + query : ''}`);
    const data = await res.json();
    if (data.success) reports = data.data;
  } catch (err) { console.error(err); }
}

async function refreshAllQuietly() {
  await fetchReports();
  calculateLeaderboard(); // Update points cache globally
  renderMapMarkers();
  renderReportCards();
  renderDashboard();
}

// ═══════════════════════════════════════════
// LEADERBOARD COMPUTATION
// ═══════════════════════════════════════════
function calculateLeaderboard() {
  volunteerScores = {};
  
  reports.forEach(r => {
    if (r.status === 'cleaned' && r.volunteer) {
      if (!volunteerScores[r.volunteer]) {
        volunteerScores[r.volunteer] = { name: r.volunteer, points: 0, count: 0 };
      }
      volunteerScores[r.volunteer].points += POINTS[r.severity] || 0;
      volunteerScores[r.volunteer].count += 1;
    }
  });

  const sortedLeaderboard = Object.values(volunteerScores).sort((a,b) => b.points - a.points);
  
  const lbContainer = document.getElementById('leaderboard-list');
  lbContainer.innerHTML = '';
  
  if (sortedLeaderboard.length === 0) {
    // Inject 5 mock values if the leaderboard is empty (Hackathon Mode)
    const mockValues = [
      { name: "EcoWarrior_99", points: 250, count: 5 },
      { name: "GreenGuardian", points: 180, count: 4 },
      { name: "CleanCity_Pro", points: 120, count: 2 },
      { name: "NatureLover", points: 80, count: 3 },
      { name: "WasteWatcher", points: 50, count: 1 }
    ];
    mockValues.forEach((vol, idx) => {
      lbContainer.innerHTML += `
        <div class="lb-row mock">
          <div class="lb-rank">#${idx + 1}</div>
          <div class="lb-name">${vol.name} <span style="font-size:0.6rem;opacity:0.6;">(Demo)</span></div>
          <div class="lb-score">
            <span class="lb-count">${vol.count} cleans</span>
            <span class="lb-points">${vol.points} PTS</span>
          </div>
        </div>
      `;
    });
    return;
  }

  sortedLeaderboard.forEach((vol, idx) => {
    lbContainer.innerHTML += `
      <div class="lb-row">
        <div class="lb-rank">#${idx + 1}</div>
        <div class="lb-name">${vol.name}</div>
        <div class="lb-score">
          <span class="lb-count">${vol.count} cleans</span>
          <span class="lb-points">${vol.points} PTS</span>
        </div>
      </div>
    `;
  });
}

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
  });
});

// ═══════════════════════════════════════════
// MAP ENGINE
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
    iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14]
  });
}

function generateBeforeAfterHtml(r) {
  if (r.status === 'cleaned' && r.after_photo && r.photo) {
    return `
      <div class="ba-card">
        <div class="ba-img-wrapper">
          <span class="ba-label">Before</span>
          <img class="ba-img" src="${r.photo}" />
        </div>
        <div class="ba-img-wrapper">
          <span class="ba-label">After</span>
          <img class="ba-img" src="${r.after_photo}" />
        </div>
      </div>
    `;
  } else if (r.photo) {
    return `<img class="popup-img" src="${r.photo}" alt="Report photo" />`;
  }
  return '';
}

function popupContent(r) {
  const photoHtml = generateBeforeAfterHtml(r);
  const dateStr = new Date(r.created_at || r.date).toLocaleDateString();
  
  let actions = '';
  if (r.status === 'reported') {
    actions = `<button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="claimReport('${r.id}')"><i class="ph ph-handshake"></i> Claim Task</button>`;
  } else if (r.status === 'in-progress') {
    actions = `<button class="btn btn-secondary btn-block" style="margin-top:12px;" onclick="triggerProofModal('${r.id}')"><i class="ph ph-camera-plus"></i> Upload Proof & Clean</button>`;
  }

  let volHtml = '';
  if (r.volunteer) {
    let pts = volunteerScores[r.volunteer] ? volunteerScores[r.volunteer].points : 0;
    volHtml = `<br/><span style="color:var(--color-progress);font-weight:600;">👤 ${r.volunteer} <span style="font-size:0.75rem;background:rgba(59,130,246,0.1);padding:1px 4px;border-radius:4px;">(${pts} pts)</span></span>`;
  }

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
    <div class="popup-footer">Filed by ${r.reporter} on ${dateStr}${volHtml}</div>
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
    const mainMarker = L.marker([r.lat, r.lng], { icon: createIcon(r) })
      .bindPopup(popupContent(r), { className: 'custom-popup' }).addTo(mainMap);
    mainMarkers[r.id] = mainMarker;

    if (typeof reportMap !== 'undefined' && reportMap) {
      const rmMarker = L.marker([r.lat, r.lng], { icon: createIcon(r), opacity: 0.6 })
        .bindPopup(popupContent(r), { className: 'custom-popup' }).addTo(reportMap);
      reportTabMarkers[r.id] = rmMarker;
    }
  });
}

// ═══════════════════════════════════════════
// API INTERACTIONS (Claims & Clean)
// ═══════════════════════════════════════════
window.claimReport = async function(id) {
  const volName = prompt("Enter your Volunteer Name:", "John D.");
  if (!volName) return;
  try {
    const res = await fetch(`${API_BASE}/reports/${id}/claim`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volunteer: volName.trim() })
    });
    if ((await res.json()).success) showToast(true, 'Task assigned to you! Resolving in background...');
  } catch(e) {}
};

// Modals Setup
let targetCleanId = null;

window.triggerProofModal = function(id) {
  targetCleanId = id;
  document.getElementById('proof-modal').style.display = 'flex';
};

document.getElementById('close-proof-modal').addEventListener('click', () => {
  document.getElementById('proof-modal').style.display = 'none';
  targetCleanId = null;
  document.getElementById('after-photo').value = '';
});

document.getElementById('submit-proof-btn').addEventListener('click', async () => {
  const photoFile = document.getElementById('after-photo').files[0];
  if (!photoFile) {
    alert("An 'After' photo is absolutely required to prove this spot is clean.");
    return;
  }

  const btn = document.getElementById('submit-proof-btn');
  btn.disabled = true;
  btn.textContent = "Uploading...";

  const photoBase64 = await compressImage(photoFile, 800);

  try {
    const res = await fetch(`${API_BASE}/reports/${targetCleanId}/clean`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ afterPhotoBase64: photoBase64 })
    });
    const data = await res.json();
    if (data.success) {
      showToast(true, 'Proof accepted! Spot marked Cleaned.');
      document.getElementById('close-proof-modal').click();
      refreshAllQuietly();
    } else {
      showToast(false, `Upload error: ${data.error || 'Check Supabase Keys'}`);
    }
  } catch(e) {
    showToast(false, 'Network failure or file too large.');
  }
  btn.disabled = false;
  btn.textContent = "Submit Proof";
});

// ═══════════════════════════════════════════
// CARDS LIST (Sidebar)
// ═══════════════════════════════════════════
function renderReportCards() {
  const list = document.getElementById('reports-list');
  list.innerHTML = '';
  
  const filtered = reports.filter(r => (activeFilter === 'all' ? true : r.status === activeFilter));
  document.getElementById('report-count').textContent = filtered.length;
  
  if (filtered.length === 0) { list.innerHTML = `<div style="text-align:center; padding: 40px 0; color: var(--text-light);">No items to show.</div>`; return; }

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
      btnHtml = `<button class="btn btn-primary btn-action" onclick="event.stopPropagation(); window.claimReport('${r.id}')">Claim Task</button>`;
    } else if (r.status === 'in-progress') {
      btnHtml = `<button class="btn btn-secondary btn-action" onclick="event.stopPropagation(); window.triggerProofModal('${r.id}')">Upload Proof</button>`;
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

// SEARCH
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
  searchInput.value = ''; searchClear.style.display = 'none';
  refreshAllQuietly();
});

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
async function renderDashboard() {
  const stats = await (await fetch(`${API_BASE}/stats`)).json();
  if (!stats.success) return;

  const { total, reported, inProgress, cleaned, severity, recentActivity } = stats.data;
  const pct = (n) => total > 0 ? ((n / total) * 100).toFixed(1) : 0;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-val">${total}</div><div class="stat-title">Total Logs</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--color-medium)">${reported}</div><div class="stat-title">Pending Action</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--color-progress)">${inProgress}</div><div class="stat-title">In Progress</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--color-cleaned)">${cleaned}</div><div class="stat-title">Resolved</div></div>
  `;

  document.getElementById('severity-bars').innerHTML = `
    <div class="sev-row"><span class="sev-label">High</span><div class="sev-track"><div class="sev-fill high" style="width:${pct(severity.high)}%"></div></div><span style="font-size:0.8rem; font-weight:600; width:40px; text-align:right">${severity.high}</span></div>
    <div class="sev-row"><span class="sev-label">Medium</span><div class="sev-track"><div class="sev-fill medium" style="width:${pct(severity.medium)}%"></div></div><span style="font-size:0.8rem; font-weight:600; width:40px; text-align:right">${severity.medium}</span></div>
    <div class="sev-row"><span class="sev-label">Low</span><div class="sev-track"><div class="sev-fill low" style="width:${pct(severity.low)}%"></div></div><span style="font-size:0.8rem; font-weight:600; width:40px; text-align:right">${severity.low}</span></div>
  `;

  const feed = document.getElementById('activity-feed');
  if (recentActivity && recentActivity.length > 0) {
    feed.innerHTML = recentActivity.map(a => {
      let icon = a.action === 'created' ? 'ph-plus' : (a.action === 'claimed' ? 'ph-handshake' : 'ph-check');
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
  } else feed.innerHTML = `<div style="text-align:center; padding: 20px 0; color: var(--text-light);">No activity.</div>`;
}

document.getElementById('refresh-dashboard').addEventListener('click', renderDashboard);

// ═══════════════════════════════════════════
// REPORT FORM + COMPRESSION
// ═══════════════════════════════════════════
const reportMap = L.map('report-map', { zoomControl: false }).setView(CENTER, 14);
reportTileLayer = createTileLayer(reportMap, currentMapStyle);
L.control.zoom({ position: 'topright' }).addTo(reportMap);

let reportPin = null, reportLatLng = null, selectedSeverity = null;

reportMap.on('click', (e) => {
  reportLatLng = e.latlng;
  if (reportPin) reportMap.removeLayer(reportPin);
  reportPin = L.marker(e.latlng, { icon: L.divIcon({ className: '', html: `<div class="marker-pin" style="color: var(--color-progress);"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] }), zIndexOffset: 1000 }).addTo(reportMap);
  const pinBox = document.getElementById('pin-indicator');
  pinBox.classList.add('active');
  pinBox.innerHTML = `<i class="ph-fill ph-map-pin"></i><span>Set to: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}</span>`;
  checkFormValidity();
});

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
      const img = new Image(); img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > maxWidth) { height = Math.round(height * (maxWidth / width)); width = maxWidth; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
  });
}

document.getElementById('submit-report').addEventListener('click', async () => {
  const btn = document.getElementById('submit-report');
  btn.disabled = true; btn.textContent = 'Processing...';

  const photoFile = document.getElementById('report-photo').files[0];
  const photoBase64 = await compressImage(photoFile);

  const reportData = {
    title: document.getElementById('report-title').value.trim(),
    location: document.getElementById('report-location').value.trim(),
    description: document.getElementById('report-desc').value.trim(),
    severity: selectedSeverity,
    lat: reportLatLng.lat, lng: reportLatLng.lng,
    reporter: document.getElementById('report-reporter').value.trim() || 'Anonymous',
    photoBase64: photoBase64
  };

  const newReport = await (await fetch(`${API_BASE}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reportData) })).json();

  if (newReport.success) {
    document.getElementById('report-title').value = ''; document.getElementById('report-location').value = '';
    document.getElementById('report-desc').value = ''; document.getElementById('report-reporter').value = '';
    document.getElementById('report-photo').value = '';
    document.querySelectorAll('.sev-opt').forEach(o => o.classList.remove('selected'));
    selectedSeverity = null;
    if (reportPin) { reportMap.removeLayer(reportPin); reportPin = null; }
    reportLatLng = null;
    
    document.getElementById('pin-indicator').classList.remove('active');
    document.getElementById('pin-indicator').innerHTML = `<i class="ph ph-map-pin"></i><span>Click on map to register coordinates</span><button class="btn-text" id="geo-btn">Use GPS</button>`;
    
    showToast(true, 'File recorded to global system.');
    document.querySelector('[data-panel="map"]').click();
  } else {
    showToast(false, 'Submission failed');
  }

  btn.disabled = false; btn.textContent = 'Submit into System';
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

// ── BOOTSTRAP ──
init();
