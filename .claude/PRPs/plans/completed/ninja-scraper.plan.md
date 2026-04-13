# AuditIQ — Ninja Scraper Implementation Plan

## Overview

This plan upgrades the AuditIQ scraper from a basic Puppeteer setup to a production-grade
"Ninja Mode" crawler capable of bypassing WAF protection (Cloudflare, etc.) used by sites
like Gymshark. It also introduces a Hybrid Scraping Strategy to keep audit times under 15s.

---

## Phase 1 — Install Stealth Dependencies

**Location:** `/server` directory

**Command:**
```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth
```

**Why:** `puppeteer-extra-plugin-stealth` patches the 6 most common headless browser
detection vectors including `navigator.webdriver`, missing plugins, inconsistent viewport,
and HeadlessChrome user-agent strings.

---

## Phase 2 — Refactor the Scraper Service

**File:** `server/services/scraper.js` (create if not exists, or update existing)

**Implementation:**

```javascript
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')

puppeteer.use(StealthPlugin())

async function getRenderedPage(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--disable-gpu',
      '--single-process',
    ],
  })

  const page = await browser.newPage()

  // Realistic User-Agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  )

  // Organic viewport
  await page.setViewport({ width: 1920, height: 1080 })

  // Block images/fonts to speed up load
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    if (['image', 'font', 'media'].includes(req.resourceType())) {
      req.abort()
    } else {
      req.continue()
    }
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Human micro-delay (1-2 seconds)
    await new Promise((r) => setTimeout(r, 1500))

    const content = await page.content()
    await browser.close()
    return { html: content, usedPuppeteer: true }
  } catch (error) {
    await browser.close()
    throw error
  }
}

module.exports = { getRenderedPage }
```

---

## Phase 3 — Implement Hybrid Scraping Strategy

**Goal:** Use Puppeteer only where needed. Fall back to axios for speed.

**Logic:**

```
Homepage → Always use Puppeteer (catches JS-rendered content)
Internal pages → Detect site type first:
  - If Shopify/React/Next.js detected → use axios (same shell, no need for Puppeteer)
  - If static HTML detected → use axios (already fast and accurate)
  - If Puppeteer failed on homepage → use axios fallback for all pages
```

**Detection heuristic** (check homepage HTML for signals):
```javascript
function detectSiteType(html) {
  if (html.includes('Shopify.theme') || html.includes('cdn.shopify.com')) return 'shopify'
  if (html.includes('__NEXT_DATA__') || html.includes('_next/static')) return 'nextjs'
  if (html.includes('__nuxt') || html.includes('nuxt')) return 'nuxt'
  if (html.includes('ng-version') || html.includes('angular')) return 'angular'
  return 'static'
}
```

**Result:** Puppeteer runs once (homepage). Internal pages use axios.
**Time savings:** Drops from ~45s to ~8-12s for a 4-page crawl.

---

## Phase 4 — Fallback Scraper

**Goal:** If Puppeteer fails or gets blocked, fall back gracefully.

**Fallback chain:**
1. Try Stealth Puppeteer → return HTML
2. If timeout or block → try standard axios/cheerio
3. If axios also blocked → use PageSpeed Insights API metadata as partial data source
   (Google has already crawled the site — extract title, description from PSI response)

**Implementation in `audit.js`:**
```javascript
async function fetchWithFallback(url) {
  try {
    const { html } = await getRenderedPage(url)
    return { html, method: 'puppeteer' }
  } catch (puppeteerErr) {
    console.warn('Puppeteer failed, falling back to axios:', puppeteerErr.message)
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      return { html: response.data, method: 'axios' }
    } catch (axiosErr) {
      throw new Error(`Both Puppeteer and axios failed: ${axiosErr.message}`)
    }
  }
}
```

---

## Phase 5 — Render Deployment Config (for online demo)

**Build Command** (set in Render dashboard):
```bash
npm install && npx puppeteer install
```

**Environment Variables** (set in Render dashboard):
```
PUPPETEER_CACHE_DIR=/opt/render/project/src/.cache/puppeteer
PUPPETEER_EXECUTABLE_PATH=/opt/render/project/src/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome
OLLAMA_API_KEY=your_key
PAGESPEED_API_KEY=your_key
```

**`server/render.yaml`** (create this file):
```yaml
services:
  - type: web
    name: auditiq-backend
    env: node
    rootDir: server
    buildCommand: npm install && npx puppeteer install
    startCommand: node index.js
    envVars:
      - key: PUPPETEER_CACHE_DIR
        value: /opt/render/project/src/.cache/puppeteer
      - key: NODE_ENV
        value: production
```

---

## Phase 6 — Testing Checklist

Test each site type after implementation:

| Site | Type | Expected Method | Pass Criteria |
|---|---|---|---|
| `https://example.com` | Static HTML | axios fallback | Full data in <3s |
| `https://www.marjane.ma` | Dynamic | Puppeteer | Real H1s detected |
| `https://ma.oraimo.com` | Shopify | Puppeteer homepage + axios pages | <12s total |
| `https://www.gymshark.com` | Cloudflare WAF | Stealth Puppeteer | No 403 block |
| `https://www.google.com` | Blocks scrapers | Graceful fallback | Error message, no crash |

---

## Phase 7 — Audit Time Budget

Target: full audit under 15 seconds locally, under 25 seconds on Render.

| Step | Time Budget |
|---|---|
| Puppeteer homepage fetch | 4-6s |
| axios internal pages (x3) | 2-3s |
| SEO + Technical + Content analysis | <1s |
| Social validation | <0.5s |
| Issue triage | <0.5s |
| AI recommendations (qwen3.5 cloud) | 5-8s |
| PageSpeed API (parallel with AI) | 5-10s |
| **Total** | **~12-18s** |

**Key optimization:** Run AI recommendations and PageSpeed API in parallel using `Promise.all`.

---

## Implementation Order

```
Phase 1 → Install dependencies (2 min)
Phase 2 → Refactor scraper service (15 min)
Phase 3 → Hybrid strategy in multiPageCrawler.js (20 min)
Phase 4 → Fallback chain in audit.js (15 min)
Phase 5 → Render config files (10 min)
Phase 6 → Test all site types (30 min)
Phase 7 → Optimize timing if needed (15 min)
```

**Total estimated time:** ~1.5 hours

---

## Notes for Thesis

- Document the stealth plugin as "Anti-Detection Layer" in your methodology chapter
- The hybrid scraping strategy is academically significant — cite it as "Adaptive Rendering Detection"
- The fallback chain demonstrates defensive programming — worth a section in your technical implementation chapter
- Gymshark bypass (if achieved) is a strong demo moment for your jury
