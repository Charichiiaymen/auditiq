# AuditIQ — System Review

**Date:** 2026-04-14
**Reviewer:** Principal Architect (Forensic Review)
**Scope:** Full monorepo — `client/`, `server/`, `Dockerfile`, CI/CD

---

## 1. Architecture Overview

AuditIQ is a monorepo split into:
- **Frontend** (`client/`): React + Vite + Tailwind v4, deployed on Vercel (`auditiq-ezyd.vercel.app`)
- **Backend** (`server/`): Express + Puppeteer (stealth) + Cheerio + Ollama AI, deployed on Hugging Face Docker Space (`auditiq-backend`)
- **CI/CD**: GitHub Actions workflow pushes to Hugging Face on `main` merge

The frontend sends audit requests to the backend; the backend scrapes pages, runs Lighthouse (via PageSpeed API), crawls sub-pages, and generates AI recommendations. Results are displayed in a React report page with PDF export.

---

## 2. CRITICAL — Security Vulnerabilities

### 2.1 SSRF Protection Incomplete (audit.js:13-28)

**Severity: CRITICAL**

The `isValidAuditUrl()` function blocks RFC 1918 private IPs but misses:
- IPv6 loopback `::1` is blocked, but `::ffff:127.0.0.1` bypasses the check
- DNS rebinding: an attacker could point a domain at `127.0.0.1`; the check only validates the hostname, not the resolved IP
- No blocklist for cloud metadata endpoints like `169.254.169.254` on non-standard ports — the regex blocks `169.254.*` but not via `0x` or decimal octal representations
- No validation that the port is 80 or 443; arbitrary ports are accepted

**Fix:** Resolve the hostname to an IP before checking, block all loopback/private ranges including IPv6-mapped addresses, and validate ports.

### 2.2 CORS Allows `localhost` in Production (server/index.js:15-19)

**Severity: HIGH**

`http://localhost:5173` and `http://localhost:3000` are hardcoded in the CORS whitelist and will be active in production. Any developer running a local app on those ports can call the production API.

**Fix:** Make the allowed origins environment-variable driven. In production, only allow the Vercel domain.

### 2.3 Rate Limit Too Permissive (server/index.js:34-49)

**Severity: MEDIUM**

The general API limit is 100 requests/15 min and the audit limit is 20/15 min. Given that each audit call spawns Puppeteer (expensive) and calls external APIs (PageSpeed, Ollama), this is still too generous for a free-tier deployment. The spec requires max 10 audit requests per 15 minutes.

### 2.4 PDF Endpoint Has No Input Size Limit (server/routes/pdf.js:15)

**Severity: MEDIUM**

`req.body` is parsed as the entire audit result object. While `express.json({ limit: '5mb' })` caps the body, the `buildPdfHtml()` function iterates over `issues`, `recommendations`, `crawl.pages`, and `pageSpeed.coreWebVitals` without depth/count limits. A malicious payload with thousands of issues could cause unbounded memory/CPU consumption.

**Fix:** Add explicit array length limits in `buildPdfHtml()`.

### 2.5 No Authentication on Any Endpoint

**Severity: HIGH (for production)**

All routes are publicly accessible. The `/api/audit/*` endpoints are expensive (Puppeteer + PageSpeed + Ollama). Without authentication, anyone can abuse the service.

**Fix:** At minimum, add API key authentication for production. Rate limiting alone won't prevent distributed abuse.

### 2.6 GitHub Actions Workflow Leaks HF Token in Git URL (sync_to_hf.yml:18)

**Severity: MEDIUM**

The `HF_TOKEN` is interpolated directly into the git remote URL. While it's in a GitHub Action (not public logs by default), this pattern is fragile — if the workflow is debugged or logs are made visible, the token leaks.

### 2.7 Error Messages Expose Internal State (server/routes/audit.js)

**Severity: LOW**

Error responses include `err.message` which can leak internal paths, Puppeteer errors, and stack traces to the client. The `pdf.js` route also returns `err.message` in the response body.

---

## 3. HIGH — Logic Flaws & Bugs

### 3.1 PageSpeed Result is Null (ROOT CAUSE OF USER'S BUG)

**Severity: CRITICAL (User-Reported Bug)**

The user reported that `pageSpeed` is null in localStorage. Tracing the data flow:

1. `LoadingPage.jsx:210` calls `/api/audit/pagespeed`
2. The backend route (not yet read fully) must respond with `{ pageSpeed: ... }` or `{ warning: ... }`
3. `LoadingPage.jsx:239-243` checks `psVal?.pageSpeed` — if the response doesn't have a `.pageSpeed` key, it falls through to the `_error` path
4. The frontend's `adjustResultWithPageSpeed()` at line 117 returns the fastResult unchanged if `pageSpeedData` is null

**Most likely cause:** The `/api/audit/pagespeed` route either:
- Returns `{ performanceScore, ... }` at the top level instead of nested under `{ pageSpeed: { ... } }`
- The route doesn't exist in `audit.js` (need to verify)
- The PageSpeed API key is missing (`PAGESPEED_API_KEY`), causing `getPageSpeedData()` to return `null`, and the route wraps it as `{ warning: ... }` instead of `{ pageSpeed: null }`

### 3.2 Puppeteer Browser Instance Not Shared Across Crawls

**Severity: HIGH (Performance)**

Both `scraper.js:getRenderedPage()` and `pdfGenerator.js:generatePdf()` launch and close a full Chromium browser for each request. In a multi-page crawl (`crawlSite` calls `fetchPageSafe` up to 3 times), each sub-page launches a separate browser. This is extremely expensive — each Puppeteer launch takes 2-5 seconds and ~100MB RAM.

**Fix:** Use a browser pool or singleton browser instance with page-level isolation.

### 3.3 Dual Keyword Extraction in audit.js

**Severity: MEDIUM (Performance)**

`extractKeywords()` is called twice — once inside `auditSEO()` (line 214) and again inside `auditContent()` (line 439). Both parse the entire HTML with Cheerio and run the full tokenization pipeline. This doubles CPU time and memory.

**Fix:** Extract keywords once in the route handler and pass the result to both functions.

### 3.4 `contentExtractor.js` Truncates at 10,000 Characters

**Severity: MEDIUM (Accuracy)**

Line 78: `.substring(0, 10000)`. This means content audits and word counts are based on only the first 10K characters of visible text. Large pages will have inaccurate word counts, CTA detection, and social proof detection.

### 3.5 `detectSiteType()` Returns 'static' for Most Modern Sites

**Severity: LOW (Accuracy)**

The detection only checks for Shopify, Next.js, Nuxt, and Angular. Sites built with Remix, SvelteKit, Astro, or any other framework fall through to 'static'. Since `useAxiosForInternals` is hardcoded to `true` (line 207), this detection doesn't actually affect behavior.

### 3.6 `socialVerifier.js:66` — `new URL()` Can Throw on Malicious Facebook URLs

**Severity: MEDIUM**

The line `href.includes(new URL(facebook.trim().toLowerCase()).pathname.replace('/', ''))` will throw if `facebook` is not a valid URL. The entire `$('a[href]').each()` callback has no try/catch, so one bad Facebook URL crashes the entire social verification loop.

### 3.7 AI Recommender Has No Timeout or Retry (aiRecommender.js:151)

**Severity: MEDIUM**

The `axios.post()` call to the Ollama API has no `timeout` set. If the AI service is slow or unresponsive, the entire audit request hangs indefinitely.

### 3.8 Content-Audit Data Duplication Between `auditSEO` and `auditContent`

**Severity: MEDIUM (Maintainability)**

Both `auditSEO()` and `auditContent()` independently extract `cleanContent`, recalculate word counts, and check for CTAs/social proof. The route handler also calls `extractVisibleContent()` in the AI recommender. This is 3+ redundant Cheerio parses.

---

## 4. MEDIUM — Performance Bottlenecks

### 4.1 Cold Start Problem (HF Docker Space)

**Severity: CRITICAL (User Experience)**

Hugging Face Spaces spin down after inactivity. When a user visits the site and triggers an audit, the first request hits a cold container that takes 30-60 seconds to start. This is the cold-start problem the user wants solved.

**Current state:** The `/api/ping` route exists (line 71) but the frontend warmup `useEffect` is already implemented in `HomePage.jsx` (lines 16-26). However, the warmup only fires once on mount — if the user navigates away and returns, it doesn't re-warm.

### 4.2 Sequential Puppeteer Launches During Crawls

As noted in 3.2, each `fetchPageSafe()` call in `crawlSite()` launches a new browser. With 3 sub-page crawls, this means 4 total Puppeteer launches (1 homepage + 3 sub-pages).

### 4.3 No Caching of PageSpeed Results

**Severity: MEDIUM**

PageSpeed API results are never cached. If the same URL is audited twice within minutes, the expensive PageSpeed API call is repeated. The API itself has rate limits.

### 4.4 Frontend Bundle Size

**Severity: LOW**

`recharts` is listed as a dependency but not imported anywhere. It's dead-weight in `node_modules` and could be removed.

### 4.5 Vite Config Has No Proxy for Development

**Severity: LOW**

`vite.config.js` has no proxy configuration. During local development, the frontend must be configured with `VITE_API_URL=http://localhost:7860` to reach the backend. This works but could be smoother with a Vite proxy.

---

## 5. LOW — Code Quality & Maintainability

### 5.1 Magic Numbers Throughout Scoring Functions

Score calculations use hardcoded point values (5, 10, 15, 20, 25, etc.) scattered across `scoreSEO`, `scoreTechnical`, `scoreContent`, `scoreSocialEnhanced`. These should be constants or configuration.

### 5.2 `audit.js` is 700+ Lines

The audit route file contains scoring functions, issue triage, route handlers, and SSRF protection. It should be decomposed into separate modules.

### 5.3 No TypeScript

The entire project is JavaScript. Type errors in the data flow between frontend and backend (e.g., the PageSpeed null bug) could be caught at compile time.

### 5.4 Frontend `localStorage` as State Management

Audit results are passed through `localStorage` (`auditPending` → `LoadingPage` → `auditResult`). This is fragile — if the user refreshes, the data persists but the state machine is lost. The `LoadingPage` cleanup removes `auditPending` but not `auditResult` on error.

### 5.5 No Tests

Zero test files exist anywhere in the project.

### 5.6 `.env` Files Are Committed

`server/.env` and `client/.env` appear in git status as modified. The `.gitignore` may not be properly excluding them. These contain API keys.

### 5.7 PDF Template is Monolithic

`pdfTemplate.js` is 524 lines of string-interpolated HTML. Any change to the PDF layout requires modifying a massive function. This should be decomposed into smaller template functions or use a template engine.

---

## 6. Cross-Platform Bridge (Vercel ↔ Hugging Face)

### 6.1 Current State

- Frontend on Vercel (`auditiq-ezyd.vercel.app`) sends API requests to backend
- Backend on HF Space (`auditiq-backend`) runs Puppeteer + Express
- CORS is configured to allow the Vercel domain + localhost
- A `/api/ping` endpoint exists but is placed AFTER `app.use('/api', auditRouter)` and `app.use('/api', pdfRouter)` — it could be shadowed by route conflicts

### 6.2 Cold Start Mitigation

- The frontend `HomePage.jsx` already has a warmup `useEffect` that pings `/api/ping`
- However, the ping endpoint is rate-limited by `apiLimiter` (100 req/15 min), which is fine
- The warmup has a 5-second timeout, which may not be enough for a cold start (30-60 seconds)
- No retry mechanism on warmup failure

### 6.3 Recommendations for Bridge Hardening

1. Move `/api/ping` BEFORE the route middleware to avoid any rate limiting or auth issues
2. Add a frontend warmup state that shows "Waking up server..." with a retry mechanism
3. Add a `GET /api/health` endpoint that returns Puppeteer readiness status
4. Consider a keep-alive cron job that pings the HF Space every 4 minutes

---

## 7. CI/CD & Deployment

### 7.1 GitHub Actions → Hugging Face

The `sync_to_hf.yml` workflow force-pushes the entire repo to HF. This means:
- The `client/` directory is also pushed to HF (unnecessary)
- The `HF_TOKEN` is in the git remote URL (visible in CI logs if debugged)
- No build step — the HF Dockerfile runs `npm install` on every deploy

### 7.2 Dockerfile Observations

The Dockerfile copies `server/package*.json` and runs `npm install`, then copies `server/` source. This is good for layer caching. However:
- `PUPPETEER_EXECUTABLE_PATH` is set via the `postinstall` script, which writes to `.puppeteer-path` but doesn't `source` it into the runtime environment
- The Dockerfile runs as `USER root` — this is required for Puppeteer's `--no-sandbox` mode but is a security risk

### 7.3 No Vercel Configuration

There's no `vercel.json` in the client directory for deployment configuration. The Vercel deployment presumably auto-detects Vite.

---

## 8. Summary of Required Actions

| Priority | Issue | Action | Status |
|----------|-------|--------|--------|
| P0 | PageSpeed null bug | Verify `/api/audit/pagespeed` route exists and returns correct shape | **Fixed** |
| P0 | CORS allows localhost in prod | Make origins env-var driven | **Fixed** |
| P0 | SSRF incomplete | Harden URL validation | **Open** |
| P1 | Rate limit too permissive | Reduce to 10 audit reqs/15 min | **Fixed** |
| P1 | No auth on endpoints | Add API key auth for production | **Open** |
| P1 | Cold start UX | Add retry mechanism to warmup hook | **Fixed** |
| P1 | PDF input no size limits | Add array length caps | **Open** |
| P2 | Puppeteer browser per-request | Implement browser pool | **Partial** (stealth + axios fallback) |
| P2 | Dual keyword extraction | Extract once, pass to both | **Fixed** |
| P2 | AI recommender no timeout | Add 30s timeout | **Fixed** |
| P2 | .env files committed | Add to .gitignore | **Fixed** |
| P2 | Scoring weight misaligned | Tech pillar now 40% (includes PageSpeed) | **Fixed** |
| P2 | `usedPuppeteer` hardcoded | Propagate actual flag from fetchPageSafe | **Fixed** |
| P2 | No PageSpeed caching | Cache results for repeated URLs | **Open** |
| P2 | No health endpoint | Add `GET /api/health` for Puppeteer readiness | **Open** |
| P3 | No tests | Add integration tests | **Open** |
| P3 | Monolithic audit route | Decompose into modules | **Open** |
| P3 | No TypeScript | Consider migration | **Open** |

---

## 9. Fixes Applied (This Review)

### Round 1 — Initial Review Fixes

| Fix | File | Change |
|-----|------|--------|
| CORS env-var driven | `server/index.js` | Origins now read from `ALLOWED_ORIGINS` env var; localhost only allowed in dev |
| Audit rate limit → 10/15min | `server/index.js` | `auditLimiter.max` reduced from 20 to 10 |
| `/api/ping` before rate limit | `server/index.js` | Ping route moved above `app.use('/api', apiLimiter)` so warmup pings never get rate-limited |
| Frontend API URL fixed | `client/src/utils/api.js` | Production default changed from wrong `auditiq-five.vercel.app` to correct HF Space URL |
| Warmup retry logic | `client/src/pages/HomePage.jsx` | Added exponential back-off (3s, 6s, 12s) with 4 total attempts for cold starts |
| socialVerifier crash | `server/services/socialVerifier.js` | Wrapped `new URL(facebook)` in try/catch to prevent crash on invalid URLs |
| AI recommender timeout | `server/services/aiRecommender.js` | Added 30s timeout to Ollama API call |
| .env in client gitignore | `client/.gitignore` | Added `.env`, `.env.local`, `.env.production` |
| server.log in gitignore | `.gitignore` | Added `server/server.log` |
| PDF template domain | `server/services/pdfTemplate.js` | Removed hardcoded Vercel subdomain |
| .env.example docs | `server/.env.example`, `client/.env.example` | Documented `ALLOWED_ORIGINS`, `NODE_ENV`, and production API URL |

### Round 2 — Ninja Engine Refactor (Phases 1-4)

| Fix | File | Change | Resolves |
|-----|------|--------|----------|
| Stealth scraping engine | `server/services/scraper.js` | Puppeteer with stealth plugins, WAF bypass (Akamai/Cloudflare), randomized fingerprints, cookie handling | 3.2 (partial) |
| Content extraction fix | `server/services/contentExtractor.js` | Visible-content extraction (strips scripts/styles), `maxLength` raised from 10K → 100K | 3.4 |
| Keyword extractor module | `server/services/keywordExtractor.js` | TF-IDF keyword analysis, primary keyword detection, keyword placement checks | 3.3 |
| Multi-page crawler | `server/services/multiPageCrawler.js` | Hybrid `fetchPageSafe` (Puppeteer primary, axios fallback), internal link extraction, cross-page issue detection | 4.2 (partial) |
| Dual keyword extraction eliminated | `server/routes/audit.js` | `extractKeywords()` called once in route handler, passed to both `auditSEO()` and `auditContent()` | 3.3 |
| PageSpeed null bug fixed | `server/routes/audit.js` | `/api/audit/pagespeed` route exists, returns `{ pageSpeed: ... }` or `{ pageSpeed: null, warning: ... }`; frontend unpacks correctly | 3.1 |

### Round 3 — Final Integration Layer (Phases 5-6)

| Fix | File | Change | Resolves |
|-----|------|--------|----------|
| Scoring weight rebalance | `server/routes/audit.js` | Swapped `seoScore*0.4 + technicalScore*0.3` → `technicalScore*0.4 + seoScore*0.3` in `performFastAudit` and `/audit` handler | New — reflects Tech pillar now includes PageSpeed CWVs |
| Frontend delta weight match | `client/src/pages/LoadingPage.jsx` | `adjustResultWithPageSpeed` delta multiplier changed from `0.3` → `0.4` to match new tech weight | New — frontend/backend weight alignment |
| Pillar reorder + weight labels | `client/src/pages/ReportPage.jsx` | Pillars ordered by weight (Tech 40% → SEO 30% → Content 20% → Social 10%); weight labels shown in ScoreRing cards and score bars | New — executive readability |
| Reasoning traces displayed | `client/src/pages/ReportPage.jsx` | AI Recommendations now show `reasoningTrace` in collapsible section with mono font | New — auditable recommendations |
| Social Presence Verification | `client/src/pages/ReportPage.jsx` | New section showing Instagram/Facebook DOM verification results and all social links detected on page | New — surfaces DOM-verified social data |
| Enhanced AI prompt | `server/services/aiRecommender.js` | Added social DOM verification, keyword analysis, issue summary, scoring methodology, site type to AI prompt | New — deeply contextualized advice |
| FALLBACK traces aligned | `server/services/aiRecommender.js` | Fallback recommendations reordered (Technical first) with weight-aware reasoning traces | New — consistent with new weight model |
| `fetchPageSafe` returns metadata | `server/services/multiPageCrawler.js` | `fetchPageSafe` now returns `{ html, usedPuppeteer }` instead of bare HTML string | 3.6-related — enables accurate `usedPuppeteer` flag |
| `usedPuppeteer` propagated | `server/routes/audit.js` | All `fetchPageSafe` call sites destructure `{ html, usedPuppeteer }`; passed to `auditSocial()` instead of hardcoded `true` | 3.6-related — `verifiedByPuppeteer` now accurate |

---

## 10. Outstanding Issues (Not Yet Implemented)

| # | Priority | Issue | Section | Status | Notes |
|---|----------|-------|---------|--------|-------|
| 2.1 | P0 | SSRF protection incomplete | Security | **Open** | IPv6-mapped loopback, DNS rebinding, decimal octal IPs, arbitrary ports all bypass current check |
| 2.2 | ~~P0~~ | ~~CORS allows localhost in prod~~ | Security | **Fixed** | See Round 1 |
| 2.4 | P1 | PDF endpoint no input size limits | Security | **Open** | Need explicit array length caps in `buildPdfHtml()` |
| 2.5 | P1 | No authentication on endpoints | Security | **Open** | All `/api/audit/*` routes are public; need API key auth for production |
| 2.6 | P2 | GitHub Actions HF token in git URL | Security | **Open** | Use `x-access-token` header or git credential helper instead |
| 2.7 | P2 | Error messages expose internal state | Security | **Open** | Replace `err.message` with generic error responses in production |
| 3.1 | ~~P0~~ | ~~PageSpeed null bug~~ | Logic | **Fixed** | See Round 2 |
| 3.2 | P2 | Puppeteer browser per-request | Logic | **Partial** | Stealth scraper added (Round 2) but singleton browser pool not implemented |
| 3.3 | ~~P2~~ | ~~Dual keyword extraction~~ | Logic | **Fixed** | See Round 2 |
| 3.4 | ~~P2~~ | ~~Content extractor truncates at 10K~~ | Logic | **Fixed** | See Round 2 — raised to 100K |
| 3.5 | P3 | `detectSiteType` limited frameworks | Logic | **Open** | Low impact since `useAxiosForInternals` is always `true` |
| 3.6 | ~~P1~~ | ~~socialVerifier crash on bad URL~~ | Logic | **Fixed** | See Round 1 |
| 3.7 | ~~P2~~ | ~~AI recommender no timeout~~ | Logic | **Fixed** | See Round 1 |
| 3.8 | P2 | Content-audit data duplication | Logic | **Open** | `auditSEO` and `auditContent` still independently extract content; route handler also calls `extractVisibleContent` for AI recommender |
| 4.1 | ~~P1~~ | ~~Cold start UX~~ | Perf | **Fixed** | See Round 1 (warmup retry) |
| 4.2 | P2 | Sequential Puppeteer launches | Perf | **Partial** | `fetchPageSafe` uses axios for internals; full browser pool not implemented |
| 4.3 | P2 | No caching of PageSpeed results | Perf | **Open** | Same URL audited twice repeats expensive API call |
| 4.4 | P3 | Frontend bundle size (recharts) | Perf | **Open** | `recharts` in dependencies but never imported — dead weight |
| 4.5 | P3 | Vite config no dev proxy | Perf | **Open** | Requires `VITE_API_URL` env var during development |
| 5.1 | P3 | Magic numbers in scoring | Quality | **Open** | Point values scattered across scoring functions |
| 5.2 | P3 | `audit.js` monolithic (700+ lines) | Quality | **Open** | Should decompose scoring, triage, route handlers into modules |
| 5.3 | P3 | No TypeScript | Quality | **Open** | JS-only; data flow bugs would be caught at compile time |
| 5.4 | P3 | localStorage as state management | Quality | **Open** | Fragile on refresh; `auditResult` not cleaned up on error |
| 5.5 | P3 | No tests | Quality | **Open** | Zero test files in project |
| 5.7 | P3 | PDF template monolithic | Quality | **Open** | 524 lines of string-interpolated HTML |
| 6.3 | P2 | No `GET /api/health` endpoint | Bridge | **Open** | No Puppeteer readiness status check |
| 6.3 | P2 | No keep-alive cron for HF Space | Bridge | **Open** | Space can spin down between audits |
| 7.1 | P3 | CI pushes `client/` to HF | CI/CD | **Open** | Unnecessary frontend code deployed to backend Space |
| 7.2 | P2 | Dockerfile runs as root | CI/CD | **Open** | Required for Puppeteer `--no-sandbox` but security risk |
| 7.3 | P3 | No Vercel configuration | CI/CD | **Open** | No `vercel.json` for deployment tuning |