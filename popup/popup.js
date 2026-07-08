const SERVICE_LABELS = {
  ec2: 'EC2', rds: 'RDS', opensearch: 'OpenSearch',
  msk: 'MSK (Kafka)', elasticache: 'ElastiCache',
  redshift: 'Redshift', mwaa: 'MWAA Airflow',
  lambda: 'Lambda', ecs: 'ECS / Fargate',
};

const URL_SVC_MAP = [
  ['/elasticache/',        'elasticache'], ['/rds/',       'rds'],
  ['/opensearch/',         'opensearch'],  ['/aos/',       'opensearch'],
  ['/es/',                 'opensearch'],  ['/msk/',       'msk'],
  ['/redshift/',           'redshift'],    ['/mwaa/',      'mwaa'],
  ['/lambda/',             'lambda'],      ['/ecs/',       'ecs'],
  ['/eks/',                'ec2'],         ['/emr/',       'ec2'],
  ['/ec2/',                'ec2'],         ['ec2.console.','ec2'],
  ['rds.console.',         'rds'],
  ['elasticache.console.', 'elasticache'], ['msk.console.','msk'],
  ['redshift.console.',    'redshift'],
];

function svcFromUrl(url) {
  for (const [frag, svc] of URL_SVC_MAP) {
    if (url && url.includes(frag)) return svc;
  }
  return null;
}

let specs = {};
let currentSvc = 'ec2';
let currentRegion = 'us-east-1';

const DEFAULT_REGION = 'us-east-1';
const POS_TTL_MS = 24 * 3600 * 1000; // successful lookups cached 24h
const NEG_TTL_MS = 10 * 60 * 1000;   // "not found" cached 10min to avoid hammering on typos

// ec2.shop path per service (undefined = not supported, fall back to bundled)
const EC2_SHOP_PATH = {
  ec2: '',
  rds: '/rds',
  elasticache: '/elasticache',
  opensearch: '/opensearch',
  redshift: '/redshift',
  msk: '/msk',
};

function ec2ShopSupports(svc) {
  return EC2_SHOP_PATH[svc] !== undefined;
}

async function fetchFromEc2Shop(svc, type, region) {
  const path = EC2_SHOP_PATH[svc];
  if (path === undefined) return null;

  const cacheKey = `ec2shop_${svc}_${region}_${type.toLowerCase()}`;
  const stored = await chrome.storage.local.get([cacheKey, cacheKey + '_ts']);
  const age = stored[cacheKey + '_ts'] ? Date.now() - stored[cacheKey + '_ts'] : Infinity;
  const cached = stored[cacheKey];
  if (cached) {
    // Negative result sentinel expires faster than positive ones
    if (cached._notFound && age < NEG_TTL_MS) return null;
    if (!cached._notFound && age < POS_TTL_MS) return cached;
  }

  try {
    const url = `https://ec2.shop${path}?filter=${encodeURIComponent(type)}&region=${encodeURIComponent(region)}`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return { _error: true }; // server/network issue — don't cache
    const data = await resp.json();
    const item = data.Prices?.[0];

    if (!item) {
      await chrome.storage.local.set({ [cacheKey]: { _notFound: true }, [cacheKey + '_ts']: Date.now() });
      return null;
    }

    const spec = {
      vcpu: item.VCPUS ?? null,
      ram_gb: item.Memory ? parseFloat(item.Memory) : null,
      network: item.Network || null,
      storage: item.Storage || null,
      price_usd_hr: item.Cost ? parseFloat(item.Cost) : null,
    };

    await chrome.storage.local.set({ [cacheKey]: spec, [cacheKey + '_ts']: Date.now() });
    return spec;
  } catch {
    return { _error: true }; // offline / fetch threw — don't cache
  }
}

async function loadRegion() {
  const stored = await chrome.storage.local.get('aws_lens_region');
  return stored.aws_lens_region || DEFAULT_REGION;
}

async function saveRegion(region) {
  currentRegion = region;
  await chrome.storage.local.set({ aws_lens_region: region });
}

async function loadSpecs() {
  const bundled = await fetch(chrome.runtime.getURL('data/instance_specs.json')).then(r => r.json()).catch(() => ({}));
  return bundled;
}

async function forceScanAllFrames(tabId) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => null);
    const frameIds = frames ? frames.map(f => f.frameId) : [0];
    await Promise.all(
      frameIds.map(fid =>
        chrome.tabs.sendMessage(tabId, { action: 'SCAN_NOW' }, { frameId: fid }).catch(() => {})
      )
    );
  } catch (_) {
    await chrome.tabs.sendMessage(tabId, { action: 'SCAN_NOW' }).catch(() => {});
  }
}

function row(key, val) {
  return `<tr><td class="key">${key}</td><td class="val">${val}</td></tr>`;
}

async function lookupAndRender(svc, raw) {
  document.getElementById('spec-card').style.display = 'none';
  document.getElementById('not-found').style.display = 'none';

  if (!raw) return;

  const bundled = specs[svc]?.[raw] || specs[svc]?.[raw.toLowerCase()];
  let svcSpecs = bundled;
  // Bundled data is us-east-1 priced; for other regions prefer a live, region-correct lookup.
  const needLive = ec2ShopSupports(svc) && (!bundled || currentRegion !== DEFAULT_REGION);
  let priceIsRegional = false;

  if (needLive) {
    document.getElementById('not-found').textContent = 'Looking up…';
    document.getElementById('not-found').style.display = 'block';
    const live = await fetchFromEc2Shop(svc, raw, currentRegion);
    if (live && live._error) {
      // Network/server error: fall back to bundled us-east-1 data if we have it.
      if (!bundled) {
        document.getElementById('not-found').textContent = 'Couldn\'t reach ec2.shop.\nCheck your connection and try again.';
        document.getElementById('not-found').style.display = 'block';
        return;
      }
    } else if (live) {
      svcSpecs = live;
      priceIsRegional = true;
    }
  }

  if (!svcSpecs) {
    document.getElementById('not-found').textContent = 'No specs found for this type.\nIt may be too new or the service/type combination is wrong.';
    document.getElementById('not-found').style.display = 'block';
    return;
  }

  document.getElementById('not-found').style.display = 'none';

  document.getElementById('spec-card').style.display = 'block';
  document.getElementById('card-service').textContent = SERVICE_LABELS[svc] || svc;
  document.getElementById('card-type').textContent = raw;

  const rows = [];
  if (svcSpecs.vcpu !== undefined)      rows.push(row('vCPUs', svcSpecs.vcpu));
  if (svcSpecs.ram_gb !== undefined)    rows.push(row('RAM', `${svcSpecs.ram_gb} GB`));
  if (svcSpecs.memory_gb !== undefined) rows.push(row('Memory', `${svcSpecs.memory_gb} GB`));
  if (svcSpecs.network)                 rows.push(row('Network', svcSpecs.network));
  if (svcSpecs.storage)                 rows.push(row('Storage', svcSpecs.storage));
  if (svcSpecs.gpu)                     rows.push(row('GPU', svcSpecs.gpu));
  if (svcSpecs.max_throughput)          rows.push(row('Throughput', svcSpecs.max_throughput));
  if (svcSpecs.node_type)               rows.push(row('Node type', svcSpecs.node_type));
  if (svcSpecs.max_workers)             rows.push(row('Max Workers', svcSpecs.max_workers));
  document.getElementById('spec-table').innerHTML = rows.join('');

  const priceRow = document.getElementById('price-row');
  if (svcSpecs.price_usd_hr) {
    const hr = parseFloat(svcSpecs.price_usd_hr);
    document.getElementById('price-amount').textContent = `$${hr.toFixed(4)}/hr`;
    document.getElementById('price-monthly').textContent = `~$${(hr * 730).toFixed(2)}/month`;
    // Live prices reflect the selected region; bundled fallback prices are us-east-1.
    const priceRegion = priceIsRegional ? currentRegion : DEFAULT_REGION;
    const note = document.getElementById('price-note');
    note.textContent = (!priceIsRegional && currentRegion !== DEFAULT_REGION)
      ? `💰 ${priceRegion} · Linux On-Demand (region price unavailable)`
      : `💰 ${priceRegion} · Linux On-Demand`;
    priceRow.style.display = 'block';
  } else {
    priceRow.style.display = 'none';
  }
}

function setActivePill(svc) {
  document.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('active', p.dataset.svc === svc);
  });
  currentSvc = svc;
}

async function readAndRender(urlSvc) {
  const data = await chrome.storage.local.get('aws_lens_detected');
  const detected = data.aws_lens_detected;
  const isRecent = detected && (Date.now() - detected.ts) < 5 * 60 * 1000;

  const input = document.getElementById('instance-input');
  const badge = document.getElementById('auto-badge');

  const storedUrlSvc = svcFromUrl(detected?.url || '');
  const crossService = urlSvc && storedUrlSvc && urlSvc !== storedUrlSvc;

  if (isRecent && detected?.raw && !crossService) {
    const bestSvc = urlSvc || detected.service || 'ec2';
    setActivePill(bestSvc);
    input.value = detected.raw;
    input.classList.add('auto');
    badge.textContent = '✓ Auto-detected from page';
    lookupAndRender(bestSvc, detected.raw);
  } else {
    if (urlSvc) setActivePill(urlSvc);
    input.classList.remove('auto');
    badge.textContent = crossService
      ? 'Switched service — type an instance type to look it up'
      : 'Type an instance type above to look it up';
  }
}

// ── Shortcut display helpers ──────────────────────────────────────────────────

function shortcutToString(sc) {
  if (!sc) return '';
  const parts = [];
  if (sc.meta)  parts.push('⌘');
  if (sc.ctrl)  parts.push('Ctrl');
  if (sc.alt)   parts.push('Alt');
  if (sc.shift) parts.push('Shift');
  parts.push(sc.key.length === 1 ? sc.key.toUpperCase() : sc.key);
  return parts.join('+');
}

function updateShortcutDisplay(sc) {
  const el = document.getElementById('shortcut-display');
  if (sc) {
    el.textContent = shortcutToString(sc);
    el.classList.remove('placeholder');
  } else {
    el.textContent = 'Not set';
    el.classList.add('placeholder');
  }
}

async function loadShortcut() {
  const stored = await chrome.storage.local.get('aws_lens_shortcut');
  return stored.aws_lens_shortcut || null;
}

async function saveShortcut(sc) {
  await chrome.storage.local.set({ aws_lens_shortcut: sc });
}

// ── Main init ─────────────────────────────────────────────────────────────────

async function init() {
  specs = await loadSpecs();

  currentRegion = await loadRegion();
  const regionSelect = document.getElementById('region-select');
  regionSelect.value = currentRegion;

  document.getElementById('update-time').textContent = 'Live via ec2.shop';

  let tab = null;
  let tabUrl = '';
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabUrl = tab?.url || '';
  } catch (_) {}

  const urlSvc = svcFromUrl(tabUrl);

  if (tab?.id) {
    await forceScanAllFrames(tab.id);
    await new Promise(r => setTimeout(r, 450));
  }

  await readAndRender(urlSvc);

  // ── Main view events ──────────────────────────────────────────────────────

  document.getElementById('service-pills').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    setActivePill(pill.dataset.svc);
    const input = document.getElementById('instance-input');
    input.classList.remove('auto');
    document.getElementById('auto-badge').textContent = '';
    lookupAndRender(currentSvc, input.value.trim().toLowerCase());
  });

  regionSelect.addEventListener('change', async e => {
    await saveRegion(e.target.value);
    const input = document.getElementById('instance-input');
    const val = input.value.trim().toLowerCase();
    if (val) lookupAndRender(currentSvc, val);
  });

  document.getElementById('lookup-btn').addEventListener('click', () => {
    const input = document.getElementById('instance-input');
    input.classList.remove('auto');
    document.getElementById('auto-badge').textContent = '';
    lookupAndRender(currentSvc, input.value.trim().toLowerCase());
  });

  document.getElementById('instance-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.target.classList.remove('auto');
      document.getElementById('auto-badge').textContent = '';
      lookupAndRender(currentSvc, e.target.value.trim().toLowerCase());
    }
  });

  document.getElementById('instance-input').addEventListener('input', e => {
    e.target.classList.remove('auto');
    document.getElementById('auto-badge').textContent = '';
  });

  document.getElementById('refresh-btn').addEventListener('click', async () => {
    document.getElementById('auto-badge').textContent = '⟳ Scanning…';
    if (tab?.id) {
      await forceScanAllFrames(tab.id);
      await new Promise(r => setTimeout(r, 450));
    }
    await readAndRender(urlSvc);
  });

  // ── Settings view toggle ──────────────────────────────────────────────────

  document.getElementById('settings-btn').addEventListener('click', async () => {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('settings-view').style.display = 'block';
    const sc = await loadShortcut();
    updateShortcutDisplay(sc);
  });

  document.getElementById('settings-back').addEventListener('click', () => {
    document.getElementById('settings-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'block';
  });

  // ── Shortcut recorder ─────────────────────────────────────────────────────
  // Uses a focused hidden input to guarantee keydown events fire in all browsers.

  const keyCapture = document.getElementById('key-capture');
  const recordBtn  = document.getElementById('record-btn');
  const box        = document.getElementById('shortcut-box');

  function stopRecording() {
    recordBtn.textContent = 'Record';
    recordBtn.classList.remove('active');
    box.classList.remove('recording');
    keyCapture.blur();
  }

  recordBtn.addEventListener('click', () => {
    const isRecording = recordBtn.classList.contains('active');
    if (isRecording) {
      stopRecording();
    } else {
      recordBtn.textContent = '● Stop';
      recordBtn.classList.add('active');
      box.classList.add('recording');
      document.getElementById('shortcut-display').textContent = 'Press keys…';
      document.getElementById('shortcut-display').classList.remove('placeholder');
      // Focus the hidden input — this is what makes keyboard events reliable in Arc
      keyCapture.focus();
    }
  });

  keyCapture.addEventListener('keydown', async (e) => {
    // Ignore bare modifier presses
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();

    // Use e.code to get the physical key (e.g. "KeyA") regardless of modifier output
    const keyLabel = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    const sc = {
      key: keyLabel,
      code: e.code,        // stored for reliable matching in content.js
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    };

    stopRecording();
    await saveShortcut(sc);
    updateShortcutDisplay(sc);
  });

  document.getElementById('clear-btn').addEventListener('click', async () => {
    stopRecording();
    await chrome.storage.local.remove('aws_lens_shortcut');
    updateShortcutDisplay(null);
  });
}

init();
