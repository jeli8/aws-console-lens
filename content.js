const PATTERNS = {
  ec2:         /\b([a-z][0-9][a-z0-9]*\.[0-9]*[a-z]+)\b/g,
  rds:         /\b(db\.[a-z][0-9][a-z0-9]*\.[0-9]*[a-z]+)\b/g,
  opensearch:  /\b([a-z][0-9][a-z0-9]*\.[0-9]*[a-z]+\.search)\b/g,
  msk:         /\b(kafka\.[a-z][0-9][a-z0-9]*\.[0-9]*[a-z]+)\b/g,
  elasticache: /\b(cache\.[a-z][0-9][a-z0-9]*\.[0-9]*[a-z]+)\b/g,
  redshift:    /\b(ra3\.[a-z0-9]+|dc2\.[a-z0-9]+|ds2\.[a-z0-9]+)\b/g,
  mwaa:        /\b(mw1\.[a-z0-9]+)\b/g,
  lambda:      /\b(([0-9]+)\s*MB\s*(?:memory)?)\b/gi,
  ecs:         /\b([0-9]+\s*vCPU[s]?,\s*[0-9.]+\s*GB)\b/gi,
};

const SERVICE_URL_MAP = {
  '/ec2/':            'ec2',
  '/rds/':            'rds',
  '/esv3/':           'opensearch',
  '/aos/':            'opensearch',
  '/msk/':            'msk',
  '/elasticache/':    'elasticache',
  '/redshift/':       'redshift',
  '/mwaa/':           'mwaa',
  '/lambda/':         'lambda',
  '/ecs/':            'ecs',
  '/eks/':            'ec2',
};

const SERVICE_LABELS = {
  ec2: 'EC2', rds: 'RDS', opensearch: 'OpenSearch',
  msk: 'MSK (Kafka)', elasticache: 'ElastiCache',
  redshift: 'Redshift', mwaa: 'MWAA Airflow',
  lambda: 'Lambda', ecs: 'ECS / Fargate',
};

function detectService(url) {
  for (const [path, svc] of Object.entries(SERVICE_URL_MAP)) {
    if (url.includes(path)) return svc;
  }
  return null;
}

function formatPrice(price_usd_hr) {
  if (!price_usd_hr) return null;
  const monthly = (parseFloat(price_usd_hr) * 730).toFixed(2);
  return `$${parseFloat(price_usd_hr).toFixed(4)}/hr (~$${monthly}/mo)`;
}

async function loadSpecs() {
  // Try chrome.storage first (live data from background.js)
  const stored = await chrome.storage.local.get(['aws_lens_specs_ec2', 'aws_lens_specs_updated']);
  const bundled = await fetch(chrome.runtime.getURL('data/instance_specs.json')).then(r => r.json());

  // Merge: live EC2 data overrides bundled if available and recent (< 48h)
  const now = Date.now();
  const isRecent = stored.aws_lens_specs_updated && (now - stored.aws_lens_specs_updated) < 48 * 3600 * 1000;

  return {
    ...bundled,
    ec2: isRecent && stored.aws_lens_specs_ec2 ? stored.aws_lens_specs_ec2 : bundled.ec2,
    _live_ec2: isRecent,
    _updated: stored.aws_lens_specs_updated,
  };
}

function annotateDOM(specs) {
  const service = detectService(window.location.href);
  const patternsToCheck = service ? { [service]: PATTERNS[service] } : PATTERNS;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.tagName.toLowerCase();
      if (['script','style','textarea','input','head'].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (p.dataset.awsLens) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  for (const textNode of nodes) {
    for (const [svc, pattern] of Object.entries(patternsToCheck)) {
      pattern.lastIndex = 0;
      const text = textNode.textContent;
      if (!pattern.test(text)) continue;
      pattern.lastIndex = 0;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;
      let anyMatch = false;

      while ((match = pattern.exec(text)) !== null) {
        const raw = match[1] || match[0];
        const svcSpecs = specs[svc]?.[raw] || specs[svc]?.[raw.toLowerCase()];
        if (!svcSpecs) continue;

        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const span = document.createElement('span');
        span.textContent = raw;
        span.dataset.awsLens = '1';
        span.dataset.awsLensService = svc;
        span.dataset.awsLensType = raw;
        span.dataset.awsLensSpecs = JSON.stringify(svcSpecs);
        span.className = 'aws-lens-annotated';
        fragment.appendChild(span);
        lastIndex = match.index + match[0].length;
        anyMatch = true;
      }

      if (!anyMatch) continue;
      if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      textNode.parentNode.replaceChild(fragment, textNode);
      break;
    }
  }
}

let tooltip = null;
function getTooltip() {
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'aws-lens-tooltip';
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function showTooltip(event) {
  const span = event.currentTarget;
  const specs = JSON.parse(span.dataset.awsLensSpecs);
  const svc = span.dataset.awsLensService;
  const instanceType = span.dataset.awsLensType;

  const rows = [];
  if (specs.vcpu !== undefined) rows.push(['vCPUs', specs.vcpu]);
  if (specs.ram_gb !== undefined) rows.push(['RAM', `${specs.ram_gb} GB`]);
  if (specs.memory_gb !== undefined) rows.push(['Memory', `${specs.memory_gb} GB`]);
  if (specs.network) rows.push(['Network', specs.network]);
  if (specs.storage) rows.push(['Storage', specs.storage]);
  if (specs.gpu) rows.push(['GPU', specs.gpu]);
  if (specs.max_throughput) rows.push(['Throughput', specs.max_throughput]);
  if (specs.node_type) rows.push(['Node', specs.node_type]);
  if (specs.max_schedulers) rows.push(['Max Schedulers', specs.max_schedulers]);
  if (specs.max_workers) rows.push(['Max Workers', specs.max_workers]);
  if (specs.price_per_gb_s) rows.push(['Price/GB-s', `$${specs.price_per_gb_s}`]);
  if (specs.note || specs.engine_note) rows.push(['Note', specs.note || specs.engine_note]);

  const priceStr = formatPrice(specs.price_usd_hr);
  if (priceStr) rows.push(['Price', priceStr]);

  const tableRows = rows.map(([k, v]) =>
    `<tr><td class=\"aws-lens-key\">${k}</td><td class=\"aws-lens-val\">${v}</td></tr>`
  ).join('');

  const priceNote = specs.price_usd_hr
    ? `<div class=\"aws-lens-pricing-note\">💰 AWS Public Pricing · us-east-1 · Linux On-Demand</div>`
    : '';

  getTooltip().innerHTML = `
    <div class=\"aws-lens-header\">
      <span class=\"aws-lens-service\">${SERVICE_LABELS[svc] || svc}</span>
      <span class=\"aws-lens-type\">${instanceType}</span>
    </div>
    <table class=\"aws-lens-table\">${tableRows}</table>
    ${priceNote}
  `;

  const rect = span.getBoundingClientRect();
  const t = getTooltip();
  t.style.display = 'block';

  // Smart positioning: flip above if near bottom of viewport
  const ttHeight = 160;
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow > ttHeight
    ? rect.bottom + window.scrollY + 6
    : rect.top + window.scrollY - ttHeight - 6;

  t.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 340)}px`;
  t.style.top  = `${top}px`;
}

function hideTooltip() {
  if (tooltip) tooltip.style.display = 'none';
}

function attachListeners() {
  document.querySelectorAll('.aws-lens-annotated:not([data-aws-lens-listening])').forEach(span => {
    span.addEventListener('mouseenter', showTooltip);
    span.addEventListener('mouseleave', hideTooltip);
    span.dataset.awsLensListening = '1';
  });
}

async function init() {
  const specs = await loadSpecs();
  annotateDOM(specs);
  attachListeners();

  const observer = new MutationObserver(() => {
    annotateDOM(specs);
    attachListeners();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

init();
