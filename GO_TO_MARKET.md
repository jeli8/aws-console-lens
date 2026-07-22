# Go-To-Market Plan — AWS Console Lens

**Goal:** maximize installs. **Status:** live on the Chrome Web Store, v3.7.0, **1 user / 0 ratings** as of 2026-07-21. This is a cold start — the whole plan is about getting the first credible cohort of users + reviews, then compounding.

- **Live listing:** https://chromewebstore.google.com/detail/aws-console-lens/fdpfoliejficddjhihdjifeofpmjmoli
- **Store ID:** `fdpfoliejficddjhihdjifeofpmjmoli`
- **Repo:** https://github.com/jeli8/aws-console-lens
- **Owner:** Eli (jeli8) · **Driver:** OpenClaw agent (drafts + nudges; Eli approves all public posts)

---

## Part 1 — Listing review & fixes

The listing copy is strong (clear value prop, good permission hygiene, privacy story). The gaps are **discoverability and first-impression polish**, not messaging.

### 🔴 High priority (do before any traffic push)
1. **Icon is weak.** Current icon is a flat orange circle with a tiny handle notch. At 16px it looks like an orange dot — no "lens", no AWS cue, invisible in a toolbar. This is the single biggest first-impression miss.
   - *Recommendation:* redesign as a clear magnifying-glass **lens** with an AWS-orange (`#FF9900`) ring over a dark navy square, ideally framing a tiny spec/price glyph (e.g. a "$" or a chip). Must stay legible at 16px. Keep the dark-square background for toolbar contrast.
   - *Action:* agent generates 3 icon concepts → Eli picks → regenerate 16/48/128 → upload via Package tab.
2. **Get the first 3–5 reviews.** 0 ratings kills conversion. Ask 3–5 colleagues/friends who use AWS to install and leave an honest review. Social proof unblocks every other channel.
3. **Add a demo GIF/video to the listing.** A 15–30s screen capture of auto-detect → specs → price. Listings with video convert markedly better. (Web Store accepts a YouTube link.)

### 🟡 Medium priority
4. **Screenshots:** the CLEAN RDS shot is good. Add 1–2 more showing different services (EC2, MSK) and, if possible, the on-page floating overlay (the keyboard-shortcut feature) — that's a differentiator not currently shown.
5. **Keyword/SEO in copy:** the store indexes the name + description. Current name "AWS Console Lens" is good but consider whether the first line of the description leads with the highest-intent keywords ("AWS instance pricing", "EC2 RDS specs"). Already decent — low effort tweak.
6. **Promo tiles:** small 440×280 tile exists (fine, money-bag emoji is a little amateur — optional reroll). Marquee 1400×560 exists. Good enough to ship.

### 🟢 Low priority / nice-to-have
7. Small-tile reroll without the emoji, cleaner typographic version.
8. Localized description (later, only if non-English traction appears).

---

## Part 2 — Channel plan (install drivers, ranked)

The buyer: an engineer juggling multiple AWS accounts who hates tab-hopping to pricing pages. Reach them where they already complain about exactly this.

### Phase 0 — Foundation (this week, before pushing traffic)
- [ ] Fix icon (High #1)
- [ ] Seed 3–5 reviews (High #2)
- [ ] Record demo GIF/video (High #3)
- [ ] Add UTM tags to every outbound link so we can attribute installs
      (`?utm_source=hn`, `?utm_source=reddit`, `?utm_source=linkedin`, etc.)
- [ ] Confirm Web Store stats access for weekly install tracking

### Phase 1 — Launch spikes (weeks 1–2, highest ceiling)
- [ ] **Show HN** — "Show HN: AWS Console Lens – specs & live pricing inside the AWS console." Post Tue–Thu ~8–10am ET. Highest-ceiling channel for a dev tool. Be present in comments all day.
- [ ] **r/aws** (value-first post, not an ad): "I built a free extension so I stop tab-hopping to pricing pages." Reddit rewards a maker solving a real annoyance; punishes ads.
- [ ] **r/devops** + **r/aws** cross-context (space them a few days apart).
- [ ] **Product Hunt** launch — schedule a Tue/Wed. Durable backlink + a spike. Line up a few upvoters for the morning.

### Phase 2 — LinkedIn series (weeks 1–4, steady drip)
Not one post — a short build-in-public series (outperforms "check out my product"):
- [ ] Post A — **The problem:** "Every AWS engineer wastes minutes/day tab-hopping to pricing pages…" + demo GIF + link.
- [ ] Post B — **The build:** "I shipped a Chrome extension in a weekend — here's the stack and why." Tech audience loves the how.
- [ ] Post C — **The milestone:** "N installs in a week — what I learned about launching a dev tool." Post 8–10am IDT, Tue–Thu.

### Phase 3 — Passive / evergreen discovery (ongoing)
- [ ] PR into `awesome-aws` and similar curated GitHub lists — evergreen install source + backlink.
- [ ] **dev.to / Hashnode** article: "How I stopped leaving the AWS console to check instance prices" — the extension is the payoff. Ranks in Google long-term.
- [ ] Answer relevant **Stack Overflow / r/aws** questions where the extension genuinely helps (always disclose you're the author).
- [ ] Note the adjacent extension **"S3 Bucket Tool"** in the store's Related rail — same audience; worth studying its listing/keywords.

---

## Part 3 — Post drafts

> Status: DRAFT — nothing gets posted publicly without Eli's explicit approval.

### Show HN (draft — pending final feature line)
```
Show HN: AWS Console Lens – specs & live pricing inside the AWS console

I kept tab-hopping from the AWS console to pricing pages and spec sheets every
time I sized an instance, so I built a small extension that shows vCPUs, RAM,
storage, network, and live on-demand pricing right where you work — EC2, RDS,
OpenSearch, MSK, ElastiCache, Redshift, MWAA, Lambda, ECS.

It auto-detects the resource type from the page, or you can type any instance
type. Pricing is pulled live from the open-source ec2.shop API and cached 24h.
No account access, no tracking — only the instance-type string and region ever
leave the browser.

Free, MIT-licensed. Feedback welcome, especially on services/edge cases I missed.
[store link] · [github link]
```

### r/aws (draft)
```
Title: I built a free extension to see instance specs + live pricing without leaving the AWS console

Got tired of opening a new tab to check vCPUs/RAM/price every time I sized an
EC2/RDS/OpenSearch instance, so I made AWS Console Lens. It auto-detects the
instance type on the console page and shows specs + live on-demand pricing
(via ec2.shop). Covers EC2, RDS, OpenSearch, MSK, ElastiCache, Redshift, MWAA,
Lambda, ECS. No credentials, no tracking — open source, MIT.

Would love feedback on what services/edge cases to add next. [link]
```

### LinkedIn Post A — the problem (draft)
```
Every AWS engineer knows this dance:

You're sizing an instance. You need vCPUs, RAM, and the hourly price.
So you open a new tab. Then another. Copy the instance name. Paste it somewhere.
Multiply by every resource, every day.

I got tired of it and built AWS Console Lens — it shows specs + live pricing
right inside the AWS console. Auto-detects the instance type, no tab-hopping.

Free, open source, no account access. Link in comments. 👇
```

---

## Part 4 — Master action list (single source of truth for the nudge cron)

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · **(Eli)** needs Eli · **(agent)** agent can do

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Redesign icon — 3 concepts | agent | [ ] |
| 2 | Pick icon + regenerate 16/48/128 | Eli | [ ] |
| 3 | Upload new icon via Package tab | Eli (agent preps) | [ ] |
| 4 | Seed 3–5 honest reviews | Eli | [ ] |
| 5 | Record 15–30s demo GIF/video | Eli (agent scripts) | [ ] |
| 6 | Add demo video to listing | Eli | [ ] |
| 7 | Add UTM tags to all share links | agent | [ ] |
| 8 | Add EC2 + MSK + overlay screenshots | agent preps / Eli uploads | [ ] |
| 9 | Finalize Show HN post | agent draft → Eli approve | [ ] |
| 10 | Post Show HN (Tue–Thu 8–10am ET) | Eli | [ ] |
| 11 | Finalize + post r/aws | agent draft → Eli approve | [ ] |
| 12 | Finalize + post r/devops | agent draft → Eli approve | [ ] |
| 13 | Schedule Product Hunt launch | Eli | [ ] |
| 14 | LinkedIn Post A (problem) | agent draft → Eli approve | [ ] |
| 15 | LinkedIn Post B (build) | agent draft → Eli approve | [ ] |
| 16 | LinkedIn Post C (milestone) | agent draft → Eli approve | [ ] |
| 17 | PR into awesome-aws list | agent | [ ] |
| 18 | dev.to / Hashnode article | agent draft → Eli approve | [ ] |

---

## Part 5 — Metrics

Check weekly (agent nudges every 2 days with next action):
- **Installs** (Web Store stats) — the north star.
- **Reviews / rating** — target ≥5 reviews, ≥4.5 avg before big pushes.
- **Referral source** via UTM — double down on whatever channel converts.

_Last updated: 2026-07-21 by OpenClaw agent._
