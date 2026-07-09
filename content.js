// AWS Console Lens — content script
// Detects the current AWS service from the URL, then scans page text for
// instance/resource types and stores the result for the popup.

// Debug logging — set to false before publishing. Only logs on an explicit
// SCAN_NOW (popup open), never on the MutationObserver, so it won't spam.
const LENS_DEBUG = false;

// ── Service detection from URL ───────────────────────────────────────────────
// Maps URL substrings to service keys. Checked in order; first match wins.
const URL_SERVICE_MAP = [
  ['/elasticache/',        'elasticache'],
  ['/rds/',                'rds'],
  ['/opensearch/',         'opensearch'],
  ['/aos/',                'opensearch'],   // Amazon OpenSearch Service new console path
  ['/es/',                 'opensearch'],   // legacy OpenSearch subdomain
  ['/msk/',                'msk'],
  ['/redshift/',           'redshift'],
  ['/mwaa/',               'mwaa'],
  ['/lambda/',             'lambda'],
  ['/ecs/',                'ecs'],
  ['/eks/',                'ec2'],         // EKS node groups use EC2 instance types
  ['/emr/',                'ec2'],         // EMR uses EC2 instance types
  ['/ec2/',                'ec2'],
  ['ec2.console.',         'ec2'],
  ['rds.console.',         'rds'],
  ['elasticache.console.', 'elasticache'],
  ['msk.console.',         'msk'],
  ['redshift.console.',    'redshift'],
];

function detectServiceFromUrl(url) {
  for (const [fragment, svc] of URL_SERVICE_MAP) {
    if (url.includes(fragment)) return svc;
  }
  return null;
}

// ── Per-service label+value patterns ────────────────────────────────────────
// [labelRegex, valueRegex]
// Label regex matches the section heading; value regex finds the type nearby.
const SERVICE_PATTERNS = {
  ec2:         [/instance\s+type/i,                    /(?<!\.)(?<![a-z]\.)([a-z][0-9][a-z0-9]*\.[0-9]*[a-z]+)(?!\.search)/i],
  opensearch:  [/instance\s+type/i,                    /([a-z][0-9][a-z0-9]*\.[0-9]*[a-z]+\.search)/i],
  rds:         [/db\s+instance\s+class|class|size/i,   /(db\.[a-z][0-9][a-z0-9]*\.[0-9]*[a-z]+)/i],
  elasticache: [/node\s+type/i,                        /(cache\.[a-z][0-9][a-z0-9]*\.[0-9]*[a-z]+)/i],
  // MSK console uses both "Broker instance type" and just "Instance type"
  msk:         [/broker\s+(?:instance\s+)?type|instance\s+type/i, /(kafka\.[a-z][0-9][a-z0-9]*\.[0-9]*[a-z]+)/i],
  redshift:    [/node\s+type/i,                        /(ra3\.[a-z0-9]+|dc2\.[a-z0-9]+|ds2\.[a-z0-9]+)/i],
  mwaa:        [/environment\s+(?:class|size)/i,       /(mw1\.[a-z0-9]+)/i],
  // Lambda: "Function memory" or "Memory" followed by MB value
  lambda:      [/(?:function\s+)?memory(?!\s+gb)/i,    /([0-9]+)\s*mb/i],
};

// ── Per-service direct (no-label) patterns for fallback ──────────────────────
const DIRECT_PATTERNS = {
  // EC2/EKS/EMR: plain instance types, NOT preceded by dot (avoids db.r6g.large etc.)
  ec2:         /(?<!\.)\b([a-z][0-9][a-z0-9]*\.[0-9]*(?:nano|micro|small|medium|large|xlarge|metal|[0-9]+xlarge))(?!\.search)\b/gi,
  opensearch:  /\b([a-z][0-9][a-z0-9]*\.[0-9]*(?:nano|micro|small|medium|large|xlarge|metal|[0-9]+xlarge)\.search)\b/gi,
  rds:         /\b(db\.[a-z][0-9][a-z0-9]*\.[0-9]*(?:nano|micro|small|medium|large|xlarge|metal|[0-9]+xlarge))\b/gi,
  elasticache: /\b(cache\.[a-z][0-9][a-z0-9]*\.[0-9]*(?:nano|micro|small|medium|large|xlarge|metal|[0-9]+xlarge))\b/gi,
  msk:         /\b(kafka\.[a-z][0-9][a-z0-9]*\.[0-9]*(?:nano|micro|small|medium|large|xlarge|metal|[0-9]+xlarge))\b/gi,
  redshift:    /\b(ra3\.[a-z0-9]+|dc2\.[a-z0-9]+|ds2\.[a-z0-9]+)\b/gi,
  mwaa:        /\b(mw1\.[a-z0-9]+)\b/gi,
  // Lambda: memory value in MB (128, 512, 1024 … 10240)
  lambda:      /\b((?:12[89]|1[3-9][0-9]|[2-9][0-9]{2}|[1-9][0-9]{3}|10[01][0-9]{2}|102[0-3][0-9]|10240))\s*mb\b/gi,
};

// ── Storage ──────────────────────────────────────────────────────────────────
let _lastStored = '';

function store(service, raw) {
  const key = `${service}:${raw}`;
  if (key === _lastStored) return;
  _lastStored = key;
  chrome.storage.local.set({
    aws_lens_detected: { service, raw, url: location.href, ts: Date.now() }
  });
}

// ── Scan logic ───────────────────────────────────────────────────────────────
function scanPage() {
  const text = document.body?.innerText || '';
  if (!text) return;

  const urlService = detectServiceFromUrl(location.href);

  // Build ordered list of services to try.
  // If URL tells us the service, try that one first; still fall back to others.
  const allServices = ['rds', 'elasticache', 'msk', 'opensearch', 'redshift', 'mwaa', 'lambda', 'ec2'];
  const ordered = urlService
    ? [urlService, ...allServices.filter(s => s !== urlService)]
    : allServices;

  // Phase 1: label + value within a 600-char window after a label match.
  // Check ALL label occurrences (last first — detail panels are usually lower
  // on the page), so a stray earlier/later "class"/"size" word doesn't hide the
  // real value.
  for (const svc of ordered) {
    const [labelRe, valueRe] = SERVICE_PATTERNS[svc] || [];
    if (!labelRe) continue;
    const allLabels = [...text.matchAll(new RegExp(labelRe.source, 'gi'))];
    if (!allLabels.length) continue;
    let found = null;
    for (let i = allLabels.length - 1; i >= 0 && !found; i--) {
      const window = text.slice(allLabels[i].index, allLabels[i].index + 600);
      const vm = window.match(valueRe);
      if (vm) found = vm[1];
    }
    if (!found) continue;
    const raw = found.toLowerCase().replace(/\s+/g, ' ').trim();
    store(svc, raw);
    return;
  }

  // Phase 2: full-page direct regex — only for the URL-detected service (or all if unknown)
  const directServices = urlService ? [urlService] : ordered;
  for (const svc of directServices) {
    const re = DIRECT_PATTERNS[svc];
    if (!re) continue;
    re.lastIndex = 0;
    const allMatches = [...text.matchAll(re)];
    if (!allMatches.length) continue;
    // Take the LAST match — selected/detail panels are typically at the bottom
    const raw = allMatches[allMatches.length - 1][1].toLowerCase().replace(/\s+/g, ' ').trim();
    store(svc, raw);
    return;
  }
}

// ── Message listener (popup requests an immediate scan) ──────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'SCAN_NOW') {
    _lastStored = '';
    scanPage();
    if (LENS_DEBUG) logScanDiagnostics();
    sendResponse({ ok: true, frame: location.href.slice(0, 80) });
  }
});

// Diagnostics: prints, per service, how many label hits and which instance-type
// strings exist on the page, plus the final stored result. Helps pinpoint why a
// given page did/didn't detect. Copy the whole group to share.
function logScanDiagnostics() {
  const text = document.body?.innerText || '';
  const urlService = detectServiceFromUrl(location.href);
  console.group('%c[AWS Lens] scan diagnostics', 'color:#f90;font-weight:bold');
  console.log('frame URL     :', location.href);
  console.log('URL service   :', urlService);
  console.log('body text len :', text.length);
  for (const svc of Object.keys(SERVICE_PATTERNS)) {
    const [labelRe, valueRe] = SERVICE_PATTERNS[svc];
    const labels = [...text.matchAll(new RegExp(labelRe.source, 'gi'))].length;
    let direct = [];
    if (DIRECT_PATTERNS[svc]) {
      DIRECT_PATTERNS[svc].lastIndex = 0;
      direct = [...text.matchAll(DIRECT_PATTERNS[svc])].map(m => m[1]).slice(0, 12);
    }
    console.log(
      `  ${svc.padEnd(12)} labels:${String(labels).padStart(3)}  direct:`,
      direct.length ? direct : '(none)'
    );
  }
  console.log('stored result :', _lastStored || '(nothing detected)');
  console.groupEnd();
}

// ── Floating overlay (triggered by configurable keyboard shortcut) ────────────
const SERVICE_DISPLAY = {
  ec2: 'EC2', rds: 'RDS', opensearch: 'OpenSearch', msk: 'MSK (Kafka)',
  elasticache: 'ElastiCache', redshift: 'Redshift', mwaa: 'MWAA Airflow',
  lambda: 'Lambda', ecs: 'ECS / Fargate',
};

let _overlayHost = null;
let _specsCache = null;

async function fetchSpecs() {
  if (_specsCache) return _specsCache;
  try {
    const r = await fetch(chrome.runtime.getURL('data/instance_specs.json'));
    _specsCache = await r.json();
  } catch (_) { _specsCache = {}; }
  return _specsCache;
}

async function toggleOverlay() {
  if (_overlayHost) {
    _overlayHost.remove();
    _overlayHost = null;
    return;
  }

  scanPage();
  const [allSpecs, stored] = await Promise.all([
    fetchSpecs(),
    chrome.storage.local.get('aws_lens_detected'),
  ]);
  const detected = stored.aws_lens_detected;
  const isRecent = detected && (Date.now() - detected.ts) < 5 * 60 * 1000;
  const urlSvc = detectServiceFromUrl(location.href);
  const svc = urlSvc || (isRecent ? detected?.service : null) || 'ec2';
  const raw = isRecent ? detected?.raw : null;
  const svcSpecs = raw ? (allSpecs[svc]?.[raw] || allSpecs[svc]?.[raw?.toLowerCase()]) : null;

  let bodyHtml = '';
  if (svcSpecs && raw) {
    const rows = [];
    if (svcSpecs.vcpu !== undefined)      rows.push(`<tr><td class="k">vCPUs</td><td class="v">${svcSpecs.vcpu}</td></tr>`);
    if (svcSpecs.ram_gb !== undefined)    rows.push(`<tr><td class="k">RAM</td><td class="v">${svcSpecs.ram_gb} GB</td></tr>`);
    if (svcSpecs.memory_gb !== undefined) rows.push(`<tr><td class="k">Memory</td><td class="v">${svcSpecs.memory_gb} GB</td></tr>`);
    if (svcSpecs.network)                 rows.push(`<tr><td class="k">Network</td><td class="v">${svcSpecs.network}</td></tr>`);
    if (svcSpecs.storage)                 rows.push(`<tr><td class="k">Storage</td><td class="v">${svcSpecs.storage}</td></tr>`);
    if (svcSpecs.gpu)                     rows.push(`<tr><td class="k">GPU</td><td class="v">${svcSpecs.gpu}</td></tr>`);
    let priceHtml = '';
    if (svcSpecs.price_usd_hr) {
      const hr = parseFloat(svcSpecs.price_usd_hr);
      priceHtml = `<div class="price">$${hr.toFixed(4)}/hr &nbsp;·&nbsp; ~$${(hr * 730).toFixed(2)}/mo</div>`;
    }
    bodyHtml = `
      <div class="card-head">
        <span class="svc">${SERVICE_DISPLAY[svc] || svc}</span>
        <span class="type">${raw}</span>
      </div>
      <table>${rows.join('')}</table>
      ${priceHtml}`;
  } else if (raw) {
    bodyHtml = `<div class="empty">No specs found for <code>${raw}</code></div>`;
  } else {
    bodyHtml = `<div class="empty">No instance detected yet.<br>Navigate to a resource detail page first.</div>`;
  }

  _overlayHost = document.createElement('div');
  const shadow = _overlayHost.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; position: fixed; top: 16px; right: 16px; z-index: 2147483647; display: block; }
      .panel { background:#1a1a2e; color:#e0e0e0; border-radius:8px; box-shadow:0 4px 28px rgba(0,0,0,.65); width:290px; font-family:Arial,sans-serif; border:1px solid #333; overflow:hidden; }
      .phead { background:#f90; color:#000; padding:7px 12px; display:flex; align-items:center; justify-content:space-between; font-size:13px; font-weight:bold; }
      .xbtn { background:none; border:none; cursor:pointer; color:#000; font-size:15px; opacity:.55; padding:0; line-height:1; }
      .xbtn:hover { opacity:1; }
      .card-head { padding:9px 13px 3px; }
      .svc { display:block; font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#f90; }
      .type { font-size:17px; font-family:monospace; font-weight:bold; color:#fff; }
      table { width:100%; border-collapse:collapse; }
      td { padding:5px 13px; font-size:12px; border-bottom:1px solid #1e1e1e; }
      .k { color:#aaa; width:95px; }
      .v { color:#fff; font-weight:600; }
      .price { padding:8px 13px; background:rgba(0,200,83,.08); font-size:12px; color:#00c853; font-weight:bold; border-top:1px solid #2a2a2a; }
      .empty { padding:15px 13px; font-size:12px; color:#888; text-align:center; line-height:1.5; }
      code { background:#111; padding:1px 5px; border-radius:3px; font-family:monospace; color:#fff; }
    </style>
    <div class="panel">
      <div class="phead"><span>🔍 AWS Console Lens</span><button class="xbtn" id="xbtn">✕</button></div>
      ${bodyHtml}
    </div>`;

  shadow.getElementById('xbtn').addEventListener('click', () => {
    _overlayHost.remove();
    _overlayHost = null;
  });
  document.body.appendChild(_overlayHost);
}

// Escape closes overlay
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _overlayHost) {
    _overlayHost.remove();
    _overlayHost = null;
  }
}, true);

// Custom shortcut listener — reads from storage and re-reads on change
let _shortcut = null;

function applyShortcut(sc) {
  _shortcut = sc || null;
}

chrome.storage.local.get('aws_lens_shortcut', d => applyShortcut(d.aws_lens_shortcut));
chrome.storage.onChanged.addListener(changes => {
  if (changes.aws_lens_shortcut) applyShortcut(changes.aws_lens_shortcut.newValue);
});

document.addEventListener('keydown', e => {
  if (!_shortcut) return;
  // Match by e.code (physical key) when stored, fallback to e.key for older saves
  const codeMatch = _shortcut.code ? e.code === _shortcut.code : null;
  const keyMatch  = e.key.length === 1 ? e.key.toUpperCase() === _shortcut.key : e.key === _shortcut.key;
  const keyOk = codeMatch !== null ? codeMatch : keyMatch;
  if (keyOk &&
      !!e.ctrlKey  === !!_shortcut.ctrl &&
      !!e.metaKey  === !!_shortcut.meta &&
      !!e.shiftKey === !!_shortcut.shift &&
      !!e.altKey   === !!_shortcut.alt) {
    e.preventDefault();
    e.stopPropagation();
    toggleOverlay();
  }
}, true);

// ── Setup ────────────────────────────────────────────────────────────────────
function setup() {
  scanPage();
  const observer = new MutationObserver(() => scanPage());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup);
} else {
  setup();
}
