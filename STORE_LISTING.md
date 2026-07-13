# Chrome Web Store Listing — AWS Console Lens

Copy-paste content for the Chrome Web Store developer dashboard.

---

## Name
AWS Console Lens

## Summary (132 chars max)
Instantly see vCPUs, RAM, storage, network & live pricing for any AWS instance type — right inside the AWS Console.

## Category
Developer Tools

## Language
English

---

## Detailed description

Stop tab-hopping to pricing pages and spec sheets. AWS Console Lens shows you
the vCPUs, RAM, storage, network performance, and live on-demand pricing for
any AWS resource type — instantly, right where you work.

**How it works**
- Open the popup on any AWS Console page and Lens auto-detects the resource type
  from the page (e.g. `db.t4g.xlarge`, `r6g.large.search`, `mw1.small`).
- Or just type any instance type to look it up.
- Pick your region to see region-accurate pricing.
- Set an optional keyboard shortcut to open a floating overlay directly on the
  page — no popup needed.

**Supported services**
EC2 · RDS · OpenSearch · MSK · ElastiCache · Redshift · MWAA · Lambda · ECS/Fargate

**Live, always-current pricing**
Pricing and specs are fetched on demand from the open-source ec2.shop API and
cached locally for 24 hours — so you always see current numbers without waiting
for extension updates.

**Private by design**
- Only the instance-type string and region are ever sent externally.
- No account access, no credentials, no tracking, no analytics.
- Everything else stays local in your browser.

Perfect for cloud engineers, DevOps, SREs, and anyone who sizes AWS resources
and wants specs + cost at a glance.

---

## Permission justifications (for the dashboard review form)

- **storage** — Cache lookup results locally for 24h and remember your selected
  region and keyboard shortcut.
- **tabs** — Read the active tab's URL to detect which AWS service you're viewing.
- **webNavigation** — Scan all frames of the AWS Console page to auto-detect the
  resource type (the console renders content in iframes).
- **alarms** — Run a once-daily cleanup of expired cached data.
- **host permission `https://ec2.shop/*`** — Fetch specs and current pricing for
  the instance type you look up.
- **content scripts on `*.console.aws.amazon.com`** — Detect the resource type on
  the page and render the optional on-page overlay.

## Single purpose (required field)
Display specifications and current pricing for AWS resource types while browsing
the AWS Management Console.

## Data usage disclosures (dashboard checkboxes)
- Does the extension collect personally identifiable information? **No**
- Health information? **No**
- Financial/payment information? **No**
- Authentication information? **No**
- Personal communications? **No**
- Location? **No** (region is a user-selected AWS region, not device location)
- Web history? **No**
- User activity? **No**
- Website content? **No** (page text is read locally and not transmitted)

- Data sold to third parties? **No**
- Data used/transferred for purposes unrelated to core functionality? **No**
- Data used/transferred to determine creditworthiness / lending? **No**

## Privacy policy URL
https://github.com/jeli8/aws-console-lens/blob/main/PRIVACY.md

---

## Assets checklist
- [x] Icon 128×128 (icons/icon128.png)
- [x] Screenshots 1280×800 or 640×400 (have MWAA, OpenSearch, RDS)
- [ ] Small promo tile 440×280 (optional but recommended)
- [ ] Marquee promo 1400×560 (optional)
