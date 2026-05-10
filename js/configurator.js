// ── NAV SCROLL ──────────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
});

// ── STATE ────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const config = {
  tier: params.get('tier') || 'print',
  gpx:  null,
  label: { title: '', subtitle: '', name: '', date: '', distance: '', place: '', elevation: '' },
};

const basePrices = { print: 89, framed: 109, gift: 129 };
const tierNames  = { print: 'The Print', framed: 'The Print + Frame', gift: 'The Gift Edition' };
const tierOrder  = ['print', 'framed', 'gift'];

// ── TIER SELECTOR ────────────────────────────────────
function setTier(tier) {
  config.tier = tier;
  document.querySelectorAll('.tier-btn').forEach(b => b.classList.toggle('active', b.dataset.tier === tier));
  updateTabVisibility();
  updatePreviewMode();
  updateSummary();
}

document.querySelectorAll('.tier-btn').forEach(btn => {
  btn.addEventListener('click', () => setTier(btn.dataset.tier));
});

// ── TAB VISIBILITY ───────────────────────────────────
function updateTabVisibility() {
  document.querySelectorAll('.tier-tab').forEach(tab => {
    const allowed = tierOrder.indexOf(config.tier) >= tierOrder.indexOf(tab.dataset.minTier);
    tab.classList.toggle('hidden', !allowed);
  });
}

// ── TAB SWITCHING ────────────────────────────────────
const tabs   = document.querySelectorAll('.config-tab');
const panels = document.querySelectorAll('.config-panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.classList.contains('locked')) return;
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

// ── GPX UPLOAD ───────────────────────────────────────
const gpxDrop     = document.getElementById('gpx-drop');
const gpxInput    = document.getElementById('gpx-input');
const gpxLoaded   = document.getElementById('gpx-loaded');
const gpxFilename = document.getElementById('gpx-filename');
const gpxRemove   = document.getElementById('gpx-remove');

function handleGPX(file) {
  if (!file || !file.name.endsWith('.gpx')) return;
  config.gpx = file;
  gpxFilename.textContent = file.name;
  gpxDrop.hidden    = true;
  gpxLoaded.hidden  = false;
  unlockTabs();
  updateSummary();
  parseAndRenderGPX(file);
}

function unlockTabs() {
  tabs.forEach(tab => { if (tab.dataset.tab !== 'gpx') tab.classList.remove('locked'); });
}

function lockTabs() {
  tabs.forEach(tab => { if (tab.dataset.tab !== 'gpx') tab.classList.add('locked'); });
}

gpxInput.addEventListener('change', () => handleGPX(gpxInput.files[0]));
gpxDrop.addEventListener('dragover', e => { e.preventDefault(); gpxDrop.classList.add('dragover'); });
gpxDrop.addEventListener('dragleave', () => gpxDrop.classList.remove('dragover'));
gpxDrop.addEventListener('drop', e => {
  e.preventDefault();
  gpxDrop.classList.remove('dragover');
  handleGPX(e.dataTransfer.files[0]);
});

gpxRemove.addEventListener('click', () => {
  config.gpx       = null;
  gpxInput.value   = '';
  gpxDrop.hidden   = false;
  gpxLoaded.hidden = true;
  lockTabs();
  hidePreviews();
  document.getElementById('route-stats').style.display = 'none';
  updateSummary();
});

// ── GPX PARSING ──────────────────────────────────────
function parseAndRenderGPX(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const xml    = new DOMParser().parseFromString(e.target.result, 'application/xml');
    let points   = Array.from(xml.querySelectorAll('trkpt'));
    if (!points.length) points = Array.from(xml.querySelectorAll('rtept'));
    if (!points.length) points = Array.from(xml.querySelectorAll('wpt'));
    if (!points.length) return;

    const coords = points.map(pt => ({
      lat: parseFloat(pt.getAttribute('lat')),
      lon: parseFloat(pt.getAttribute('lon')),
      ele: parseFloat(pt.querySelector('ele')?.textContent || '0'),
      time: pt.querySelector('time')?.textContent || null,
    }));

    // ── STATS ─────────────────────────────────────────
    function haversine(a, b) {
      const R = 6371000;
      const dLat = (b.lat - a.lat) * Math.PI / 180;
      const dLon = (b.lon - a.lon) * Math.PI / 180;
      const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
    }

    let totalMetres = 0;
    for (let i = 1; i < coords.length; i++) totalMetres += haversine(coords[i-1], coords[i]);
    const distanceKm = (totalMetres / 1000).toFixed(1);

    let elevGain = 0;
    for (let i = 1; i < coords.length; i++) {
      const diff = coords[i].ele - coords[i-1].ele;
      if (diff > 0) elevGain += diff;
    }

    const times = coords.map(c => c.time).filter(Boolean);
    let durationStr = '—';
    if (times.length >= 2) {
      const ms  = new Date(times[times.length-1]) - new Date(times[0]);
      const min = Math.round(ms / 60000);
      const hrs = Math.floor(min / 60);
      const rem = min % 60;
      durationStr = hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`;
    }

    // Auto-fill label fields
    const distStr = `${distanceKm} km`;
    const elevStr = elevGain > 0 ? `${Math.round(elevGain)} m` : '';

    document.getElementById('label-distance').value  = distStr;
    document.getElementById('label-elevation').value = elevStr;
    config.label.distance  = distStr;
    config.label.elevation = elevStr;

    // Today's date as default
    if (!config.label.date) {
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
      document.getElementById('label-date').value = dateStr;
      config.label.date = dateStr;
    }

    // Stats strip
    document.getElementById('stat-distance').textContent  = distStr;
    document.getElementById('stat-elevation').textContent = elevGain > 0 ? `${Math.round(elevGain)} m` : '—';
    document.getElementById('stat-duration').textContent  = durationStr;
    document.getElementById('route-stats').style.display  = 'flex';

    // ── ROUTE PATH ────────────────────────────────────
    const step       = Math.max(1, Math.floor(coords.length / 300));
    const simplified = coords.filter((_, i) => i % step === 0);

    const lats   = simplified.map(c => c.lat);
    const lons   = simplified.map(c => c.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const latRange = maxLat - minLat || 0.001;
    const lonRange = maxLon - minLon || 0.001;

    // Map for Tier 1 (280x280 viewBox, hex roughly 28-252 x 14-266)
    function toSVG1(coord) {
      const pad = 50; const w = 280 - pad*2; const h = 280 - pad*2;
      const scale = Math.min(w / lonRange, h / latRange);
      return {
        x: pad + (w - lonRange*scale)/2 + (coord.lon - minLon)*scale,
        y: pad + (h - latRange*scale)/2 + (maxLat - coord.lat)*scale,
      };
    }

    // Map for Tier 2 (240x240 viewBox, hex roughly 24-216 x 12-228)
    function toSVG2(coord) {
      const pad = 45; const w = 240 - pad*2; const h = 240 - pad*2;
      const scale = Math.min(w / lonRange, h / latRange);
      return {
        x: pad + (w - lonRange*scale)/2 + (coord.lon - minLon)*scale,
        y: pad + (h - latRange*scale)/2 + (maxLat - coord.lat)*scale,
      };
    }

    function buildPath(pts) {
      return pts.map((p, i) => `${i===0?'M':'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    }

    const pts1 = simplified.map(toSVG1);
    const pts2 = simplified.map(toSVG2);
    const d1   = buildPath(pts1);
    const d2   = buildPath(pts2);

    // Tier 1
    document.getElementById('t1-route').setAttribute('d', d1);
    document.getElementById('t1-dot-start').setAttribute('cx', pts1[0].x.toFixed(1));
    document.getElementById('t1-dot-start').setAttribute('cy', pts1[0].y.toFixed(1));
    document.getElementById('t1-dot-end').setAttribute('cx', pts1[pts1.length-1].x.toFixed(1));
    document.getElementById('t1-dot-end').setAttribute('cy', pts1[pts1.length-1].y.toFixed(1));

    // Tier 2
    document.getElementById('t2-route').setAttribute('d', d2);
    document.getElementById('t2-dot-start').setAttribute('cx', pts2[0].x.toFixed(1));
    document.getElementById('t2-dot-start').setAttribute('cy', pts2[0].y.toFixed(1));
    document.getElementById('t2-dot-end').setAttribute('cx', pts2[pts2.length-1].x.toFixed(1));
    document.getElementById('t2-dot-end').setAttribute('cy', pts2[pts2.length-1].y.toFixed(1));

    showPreview();
    renderStats();
  };
  reader.readAsText(file);
}

// ── LABEL INPUTS ─────────────────────────────────────
const labelFields = ['title', 'subtitle', 'name', 'date', 'distance', 'place', 'elevation'];
labelFields.forEach(field => {
  const el = document.getElementById(`label-${field}`);
  if (!el) return;
  el.addEventListener('input', () => {
    config.label[field] = el.value;
    if (field === 'title')    document.getElementById('print-title').textContent    = el.value || 'YOUR ROUTE';
    if (field === 'subtitle') document.getElementById('print-subtitle').textContent = el.value;
    if (field === 'name')     document.getElementById('print-name').textContent     = el.value;
    renderStats();
    updateSummary();
  });
});

// ── RENDER STATS DYNAMICALLY ─────────────────────────
function renderStats() {
  const statsEl = document.getElementById('print-stats');
  if (!statsEl) return;

  const entries = [
    { key: 'date',      label: 'Date',      icon: '📅' },
    { key: 'distance',  label: 'Distance',  icon: '↗' },
    { key: 'place',     label: 'Place',     icon: '📍' },
    { key: 'elevation', label: 'Elevation', icon: '▲' },
  ].filter(e => config.label[e.key] && config.label[e.key].trim() !== '');

  if (entries.length === 0) {
    statsEl.innerHTML = '';
    statsEl.style.borderTop = 'none';
    statsEl.style.paddingTop = '0';
    return;
  }

  statsEl.style.borderTop = '0.5px solid #ccc';
  statsEl.style.paddingTop = '6px';
  statsEl.innerHTML = entries.map(e => `
    <div class="print-stat">
      <span class="print-stat-icon">${e.icon}</span>
      <span class="print-stat-lbl">${e.label}</span>
      <span class="print-stat-val">${config.label[e.key]}</span>
    </div>
  `).join('');
}

// ── PREVIEW VISIBILITY ───────────────────────────────
function hidePreviews() {
  document.getElementById('preview-placeholder').style.display = 'flex';
  document.getElementById('preview-tier1').style.display       = 'none';
  document.getElementById('preview-tier2').style.display       = 'none';
  document.getElementById('preview-hint').textContent          = 'Upload your GPX file to begin.';
}

function showPreview() {
  document.getElementById('preview-placeholder').style.display = 'none';
  document.getElementById('preview-hint').textContent          = 'Preview is illustrative — your GPX route will render here.';
  updatePreviewMode();
}

function updatePreviewMode() {
  const isTier1 = config.tier === 'print';
  document.getElementById('preview-tier1').style.display = (config.gpx && isTier1)  ? 'flex' : 'none';
  document.getElementById('preview-tier2').style.display = (config.gpx && !isTier1) ? 'flex' : 'none';
  if (!config.gpx) {
    document.getElementById('preview-placeholder').style.display = 'flex';
  }
}

// ── SUMMARY ──────────────────────────────────────────
function updateSummary() {
  document.getElementById('summary-tier').textContent  = tierNames[config.tier];
  document.getElementById('summary-gpx').textContent   = config.gpx ? config.gpx.name : 'Not uploaded';
  document.getElementById('summary-price').textContent = `$${basePrices[config.tier]}`;

  const routeRow = document.getElementById('summary-row-route');
  if (config.label.title) {
    routeRow.style.display = 'flex';
    document.getElementById('summary-route').textContent = config.label.title;
  } else {
    routeRow.style.display = 'none';
  }
}

// ── STRIPE ───────────────────────────────────────────
const stripeLinks = {
  print:  'https://buy.stripe.com/test_fZu3cw18Bb0X8SRgbe5EY01',
  framed: 'https://buy.stripe.com/test_cNi28saJbglh9WV2ko5EY02',
  gift:   'https://buy.stripe.com/test_bJefZi3gJ7OL4CBbUY5EY00',
};

document.querySelector('.order-cta').addEventListener('click', e => {
  e.preventDefault();
  const url = stripeLinks[config.tier];
  if (url) window.location.href = url;
});

// ── INIT ─────────────────────────────────────────────
setTier(config.tier);
updateSummary();
hidePreviews();