// ── NAV SCROLL ──────────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
});

// ── STATE ────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const config = {
  tier:        params.get('tier') || 'print',
  colour:      '#e8e4df',
  colourName:  'Bone White',
  gpx:         null,
  label:       { name: '', route: '', competition: '', desc: '' },
};

const basePrices = { print: 89, framed: 109, gift: 129 };
const tierNames  = { print: 'The Print', framed: 'The Print + Frame', gift: 'The Gift Edition' };
const tierOrder  = ['print', 'framed', 'gift'];

// ── TIER SELECTOR ────────────────────────────────────
const tierBtns = document.querySelectorAll('.tier-btn');

function setTier(tier) {
  config.tier = tier;
  tierBtns.forEach(b => b.classList.toggle('active', b.dataset.tier === tier));
  updateTabVisibility();
  updateSummary();
}

tierBtns.forEach(btn => {
  btn.addEventListener('click', () => setTier(btn.dataset.tier));
});

// ── TAB VISIBILITY BY TIER ───────────────────────────
function updateTabVisibility() {
  document.querySelectorAll('.tier-tab').forEach(tab => {
    const minTier = tab.dataset.minTier;
    const allowed = tierOrder.indexOf(config.tier) >= tierOrder.indexOf(minTier);
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
  gpxDrop.hidden   = true;
  gpxLoaded.hidden = false;
  unlockTabs();
  updateSummary();
  parseAndRenderGPX(file);
}

// ── GPX PARSING & RENDERING ──────────────────────────
function parseAndRenderGPX(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const xml    = new DOMParser().parseFromString(e.target.result, 'application/xml');

    // Grab all trackpoints — try trkpt first, then rtept for routes
    let points = Array.from(xml.querySelectorAll('trkpt'));
    if (points.length === 0) points = Array.from(xml.querySelectorAll('rtept'));
    if (points.length === 0) points = Array.from(xml.querySelectorAll('wpt'));
    if (points.length === 0) return;

    // Extract lat/lon
    const coords = points.map(pt => ({
      lat: parseFloat(pt.getAttribute('lat')),
      lon: parseFloat(pt.getAttribute('lon')),
    }));

    // Simplify — keep every Nth point so the SVG path isn't enormous
    const maxPoints = 300;
    const step      = Math.max(1, Math.floor(coords.length / maxPoints));
    const simplified = coords.filter((_, i) => i % step === 0);

    // Find bounds
    const lats = simplified.map(c => c.lat);
    const lons = simplified.map(c => c.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);

    // Map to SVG canvas (400×400 viewBox, with padding)
    const pad    = 40;
    const width  = 400 - pad * 2;
    const height = 300 - pad * 2; // leave bottom space for labels

    const latRange = maxLat - minLat || 0.001;
    const lonRange = maxLon - minLon || 0.001;

    // Preserve aspect ratio
    const scale  = Math.min(width / lonRange, height / latRange);
    const offX   = pad + (width  - lonRange * scale) / 2;
    const offY   = pad + (height - latRange * scale) / 2;

    function toSVG(coord) {
      return {
        x: offX + (coord.lon - minLon) * scale,
        // Invert Y — latitude increases upward, SVG Y increases downward
        y: offY + (maxLat - coord.lat) * scale,
      };
    }

    // Build SVG path string
    const svgPoints = simplified.map(toSVG);
    const d = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    // Update the route path and dots
    const routePath = document.getElementById('preview-route');
    routePath.setAttribute('d', d);

    const dotStart = document.getElementById('preview-dot-start');
    dotStart.setAttribute('cx', svgPoints[0].x.toFixed(1));
    dotStart.setAttribute('cy', svgPoints[0].y.toFixed(1));

    const dotEnd = document.getElementById('preview-dot-end');
    const last   = svgPoints[svgPoints.length - 1];
    dotEnd.setAttribute('cx', last.x.toFixed(1));
    dotEnd.setAttribute('cy', last.y.toFixed(1));

    // ── STATS ──────────────────────────────────────────
    // Distance — Haversine formula between consecutive points
    function haversine(a, b) {
      const R    = 6371000; // Earth radius in metres
      const dLat = (b.lat - a.lat) * Math.PI / 180;
      const dLon = (b.lon - a.lon) * Math.PI / 180;
      const x    = Math.sin(dLat/2) * Math.sin(dLat/2)
                 + Math.cos(a.lat * Math.PI/180) * Math.cos(b.lat * Math.PI/180)
                 * Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }

    let totalMetres = 0;
    for (let i = 1; i < coords.length; i++) {
      totalMetres += haversine(coords[i - 1], coords[i]);
    }
    const distanceKm = (totalMetres / 1000).toFixed(1);

    // Elevation gain — sum of all positive ascents
    const elevEls = points.map(pt => parseFloat(pt.querySelector('ele')?.textContent || '0'));
    let elevGain  = 0;
    for (let i = 1; i < elevEls.length; i++) {
      const diff = elevEls[i] - elevEls[i - 1];
      if (diff > 0) elevGain += diff;
    }

    // Duration — from first to last timestamp if available
    const times = points.map(pt => pt.querySelector('time')?.textContent).filter(Boolean);
    let durationStr = '—';
    if (times.length >= 2) {
      const ms      = new Date(times[times.length - 1]) - new Date(times[0]);
      const totalMin= Math.round(ms / 60000);
      const hrs     = Math.floor(totalMin / 60);
      const mins    = totalMin % 60;
      durationStr   = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    }

    // Render stats
    document.getElementById('stat-distance').textContent  = `${distanceKm} km`;
    document.getElementById('stat-elevation').textContent = elevGain > 0 ? `${Math.round(elevGain)} m` : '—';
    document.getElementById('stat-duration').textContent  = durationStr;
    document.getElementById('route-stats').style.display  = 'flex';

    showPreview();
  };
  reader.readAsText(file);
}

function unlockTabs() {
  tabs.forEach(tab => {
    if (tab.dataset.tab !== 'gpx') tab.classList.remove('locked');
  });
}

function lockTabs() {
  tabs.forEach(tab => {
    if (tab.dataset.tab !== 'gpx') tab.classList.add('locked');
  });
}

gpxInput.addEventListener('change', () => handleGPX(gpxInput.files[0]));
gpxDrop.addEventListener('click', () => gpxInput.click());
gpxDrop.addEventListener('dragover', e => { e.preventDefault(); gpxDrop.classList.add('dragover'); });
gpxDrop.addEventListener('dragleave', () => gpxDrop.classList.remove('dragover'));
gpxDrop.addEventListener('drop', e => {
  e.preventDefault();
  gpxDrop.classList.remove('dragover');
  handleGPX(e.dataTransfer.files[0]);
});

gpxRemove.addEventListener('click', () => {
  config.gpx      = null;
  gpxInput.value  = '';
  gpxDrop.hidden  = false;
  gpxLoaded.hidden= true;
  lockTabs();
  hidePreview();
  document.getElementById('route-stats').style.display = 'none';
  updateSummary();
});

// ── COLOUR ───────────────────────────────────────────
document.querySelectorAll('.colour-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.colour-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    config.colour     = swatch.dataset.colour;
    config.colourName = swatch.dataset.name;
    document.getElementById('colour-name').textContent = config.colourName;
    updatePreviewColour();
    updateSummary();
  });
});

// ── LABEL FIELDS ─────────────────────────────────────
document.getElementById('label-name').addEventListener('input', e => {
  config.label.name = e.target.value;
  document.getElementById('preview-name').textContent = e.target.value;
});
document.getElementById('label-route').addEventListener('input', e => {
  config.label.route = e.target.value;
  document.getElementById('preview-route-name').textContent = e.target.value;
  updateSummary();
});
document.getElementById('label-competition').addEventListener('input', e => {
  config.label.competition = e.target.value;
  document.getElementById('preview-competition').textContent = e.target.value;
});
document.getElementById('label-desc').addEventListener('input', e => {
  config.label.desc = e.target.value;
  document.getElementById('preview-desc').textContent = e.target.value;
});

// ── PREVIEW ──────────────────────────────────────────
const previewPlaceholder = document.getElementById('preview-placeholder');
const previewSVG         = document.getElementById('preview-svg');
const previewHint        = document.getElementById('preview-hint');

function showPreview() {
  previewPlaceholder.style.display = 'none';
  previewSVG.style.display         = 'block';
  previewHint.textContent          = 'Preview is illustrative — your GPX route will render here.';
  updatePreviewColour();
}

function hidePreview() {
  previewPlaceholder.style.display = 'flex';
  previewSVG.style.display         = 'none';
  previewHint.textContent          = 'Upload your GPX file to begin.';
}

function updatePreviewColour() {
  document.getElementById('preview-route').setAttribute('stroke', config.colour);
  document.getElementById('preview-dot-start').setAttribute('fill', config.colour);
}

// ── SUMMARY ──────────────────────────────────────────
function updateSummary() {
  document.getElementById('summary-tier').textContent   = tierNames[config.tier];
  document.getElementById('summary-colour').textContent = config.colourName;
  document.getElementById('summary-gpx').textContent    = config.gpx ? config.gpx.name : 'Not uploaded';
  document.getElementById('summary-price').textContent  = `$${basePrices[config.tier]}`;

  const routeRow = document.getElementById('summary-row-label');
  if (config.label.route) {
    routeRow.style.display = 'flex';
    document.getElementById('summary-route-name').textContent = config.label.route;
  } else {
    routeRow.style.display = 'none';
  }
}

// ── INIT ─────────────────────────────────────────────
setTier(config.tier);
updateSummary();