const PATTERNS = {
  ec2:         /\b([a-z][0-9][a-z]*\.[a-z0-9]+)\b/g,
  rds:         /\b(db\.[a-z][0-9][a-z]*\.[a-z0-9]+)\b/g,
  opensearch:  /\b([a-z][0-9][a-z]*\.[a-z0-9]+\.search)\b/g,
  msk:         /\b(kafka\.[a-z][0-9][a-z]*\.[a-z0-9]+)\b/g,
  elasticache: /\b(cache\.[a-z][0-9][a-z]*\.[a-z0-9]+)\b/g,
};

function detectService(url) {
  if (url.includes('/ec2/'))         return 'ec2';
  if (url.includes('/rds/'))         return 'rds';
  if (url.includes('/esv3/') || url.includes('/aos/')) return 'opensearch';
  if (url.includes('/msk/'))         return 'msk';
  if (url.includes('/elasticache/')) return 'elasticache';
  return null;
}

function annotateDOM(specs) {
  const service = detectService(window.location.href);
  const patternsToCheck = service ? { [service]: PATTERNS[service] } : PATTERNS;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName.toLowerCase();
        if (['script','style','textarea','input'].includes(tag)) return NodeFilter.FILTER_REJECT;
        if (p.dataset.awsLens) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodesToProcess = [];
  let node;
  while ((node = walker.nextNode())) nodesToProcess.push(node);

  for (const textNode of nodesToProcess) {
    for (const [svc, pattern] of Object.entries(patternsToCheck)) {
      pattern.lastIndex = 0;
      const text = textNode.textContent;
      if (!pattern.test(text)) continue;
      pattern.lastIndex = 0;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const instanceType = match[1];
        const svcSpecs = specs[svc]?.[instanceType];
        if (!svcSpecs) continue;

        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        const span = document.createElement('span');
        span.textContent = instanceType;
        span.dataset.awsLens = '1';
        span.dataset.awsLensService = svc;
        span.dataset.awsLensSpecs = JSON.stringify(svcSpecs);
        span.className = 'aws-lens-annotated';
        fragment.appendChild(span);

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex === 0) continue;

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

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
  const instanceType = span.textContent;

  const SERVICE_LABELS = {
    ec2: 'EC2', rds: 'RDS', opensearch: 'OpenSearch',
    msk: 'MSK (Kafka)', elasticache: 'ElastiCache'
  };

  const rows = [
    ['vCPUs', specs.vcpu],
    ['RAM', `${specs.ram_gb} GB`],
    ['Network', specs.network],
  ];
  if (specs.storage) rows.push(['Storage', specs.storage]);
  if (specs.gpu) rows.push(['GPU', specs.gpu]);
  if (specs.note || specs.engine_note) rows.push(['Note', specs.note || specs.engine_note]);

  const tableRows = rows.map(([k, v]) =>
    `<tr><td class="aws-lens-key">${k}</td><td class="aws-lens-val">${v}</td></tr>`
  ).join('');

  getTooltip().innerHTML = `
    <div class="aws-lens-header">
      <span class="aws-lens-service">${SERVICE_LABELS[svc]}</span>
      <span class="aws-lens-type">${instanceType}</span>
    </div>
    <table class="aws-lens-table">${tableRows}</table>
  `;

  const rect = span.getBoundingClientRect();
  const t = getTooltip();
  t.style.display = 'block';
  t.style.left = `${rect.left + window.scrollX}px`;
  t.style.top  = `${rect.bottom + window.scrollY + 6}px`;
}

function hideTooltip() {
  if (tooltip) tooltip.style.display = 'none';
}

function attachListeners() {
  document.querySelectorAll('.aws-lens-annotated').forEach(span => {
    if (span.dataset.awsLensListening) return;
    span.addEventListener('mouseenter', showTooltip);
    span.addEventListener('mouseleave', hideTooltip);
    span.dataset.awsLensListening = '1';
  });
}

async function init() {
  const specs = await fetch(chrome.runtime.getURL('data/instance_specs.json')).then(r => r.json());
  annotateDOM(specs);
  attachListeners();

  const observer = new MutationObserver(() => {
    annotateDOM(specs);
    attachListeners();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

init();
