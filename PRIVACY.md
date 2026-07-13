# Privacy Policy — AWS Console Lens

_Last updated: 2026-07-08_

AWS Console Lens is a browser extension that displays specs (vCPU, RAM, storage,
network) and on-demand pricing for AWS resource types. This policy explains
exactly what the extension does and does not do with data.

## What the extension accesses

- **The URL and visible text of your active AWS Console tab.** When you open the
  popup (or trigger the shortcut), the extension reads the current tab's URL to
  detect which AWS service you're viewing and scans the visible page text to
  auto-detect an instance/resource type (e.g. `db.t4g.xlarge`). This happens
  locally in your browser.
- **The instance type you look up.** Either auto-detected or typed by you.

## What the extension sends externally

- **Only the instance-type string and a region code** are sent to
  [ec2.shop](https://ec2.shop) (an open-source public pricing API) to retrieve
  specs and current pricing — for example:
  `https://ec2.shop/rds?filter=db.t4g.xlarge&region=us-east-1`.
- No account identifiers, credentials, cookies, page contents, resource names,
  ARNs, or personal information are ever transmitted.

## What the extension stores

- **Locally, in your browser only** (`chrome.storage.local`): cached lookup
  results (to avoid repeat network calls, expiring after 24 hours), your
  selected region, and your optional keyboard shortcut.
- Cached data is automatically cleaned up daily and never leaves your device.

## What the extension does NOT do

- No analytics, telemetry, tracking, or advertising.
- No collection or transmission of personal data.
- No access to your AWS account, credentials, or API keys.
- No selling or sharing of any data with third parties.

## Third-party service

Pricing lookups are served by **ec2.shop** (https://github.com/yeo/ec2.shop),
an independent open-source project. Only the instance-type and region are sent;
requests are anonymous. Review their site for their own terms.

## Contact

Questions? Open an issue at
https://github.com/jeli8/aws-console-lens/issues
