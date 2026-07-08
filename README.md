# AWS Console Lens

Injects tooltips directly on AWS Console pages showing RAM, vCPUs, storage, and network bandwidth for the instance type currently shown on screen — so you never have to leave the console to look up specs.

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `aws-console-lens` directory
4. Navigate to any AWS Console page (EC2, RDS, OpenSearch, MSK, or ElastiCache)

Hover over any highlighted instance type name to see its specs in a tooltip.

## Supported Services

- **EC2** — `t3.medium`, `m5.large`, `r6g.xlarge`, `c5.xlarge`, `i3.large`, `p3.2xlarge`, `g4dn.xlarge` and more
- **RDS** — `db.t3.medium`, `db.r6g.large`, `db.m5.xlarge` and more
- **OpenSearch** — `r6g.large.search`, `m5.xlarge.search` and more
- **MSK (Kafka)** — `kafka.m5.large`, `kafka.m7g.xlarge` and more
- **ElastiCache** — `cache.r6g.large`, `cache.t3.medium` and more

## Adding More Instance Types

Edit `data/instance_specs.json` and add entries under the appropriate service key. The extension will pick them up on next page load.

## Adding a New Service

1. Add a regex pattern to `PATTERNS` in `content.js`
2. Add a URL detection branch to `detectService()`
3. Add specs to `data/instance_specs.json` under a new top-level key
4. Add a service label to `SERVICE_LABELS` in `content.js` (optional, for tooltip header)

## Architecture

```
aws-console-lens/
├── manifest.json          # Manifest V3
├── content.js             # DOM scanner + tooltip renderer
├── tooltip.css            # Tooltip and annotation styles
├── data/
│   └── instance_specs.json  # Built-in specs (no API calls)
├── icons/                 # Extension icons
├── popup/
│   ├── popup.html         # Info panel
│   └── popup.js           # (future use)
└── README.md
```

## License

MIT
