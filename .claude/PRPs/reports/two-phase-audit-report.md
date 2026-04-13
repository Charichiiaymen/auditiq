# Implementation Report: Two-Phase /fast + /deep & Puppeteer Timeout

## Summary
Split the monolithic `POST /audit` endpoint into two sequential phases (`/audit/fast` and `/audit/deep`), updated the frontend to call them in parallel with PageSpeed, and added Puppeteer timeout guards.

## Tasks Completed

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6 | Create /audit/fast endpoint | Done | Returns seo, technical, content, social, overallScore, issues — no crawl/AI |
| 7 | Create /audit/deep endpoint | Done | Accepts url + fastResult, returns crawl + recommendations |
| 8 | Update LoadingPage.jsx | Done | Parallel Promise.allSettled for deep + PageSpeed; fallback warnings for both |
| 9 | Add Puppeteer timeout guard | Done | Promise.race on page.goto() and page.content() with 30s global cap |
| 10 | Validate build | Done | Client build passes; server module loads; lint pre-existing only |

## Validation Results

| Level | Status | Notes |
|-------|--------|-------|
| Build (client) | Pass | `npm run build` succeeds |
| Module load (server) | Pass | `require('./routes/audit')` loads OK |
| Lint (client) | Pass | 4 pre-existing errors only |
| Type check | N/A | No TS in this project |

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `server/routes/audit.js` | Modified | Added `/audit/fast`, `/audit/deep`, `performFastAudit()`, `performDeepAudit()` helpers; kept `/audit` for backwards compat |
| `server/services/multiPageCrawler.js` | Modified | Added `PUPPETEER_TIMEOUT_MS`, `Promise.race` on navigation and content extraction, set `browser = null` after close |
| `client/src/pages/LoadingPage.jsx` | Modified | Two-phase flow: fast → parallel(deep + PageSpeed), step labels updated, deep merge of crawl+recommendations, `_deepWarning` support |
| `client/src/pages/ReportPage.jsx` | Modified | Added `_deepWarning` to safeResult, deep warning banner (orange) |
| `client/src/utils/api.js` | Created (prev) | Shared axios instance with VITE_API_URL |
| `client/.env` | Modified (prev) | Added VITE_API_URL |
| `client/src/utils/errorHandler.js` | Modified (prev) | Registered interceptors on `api` instance |

## Architecture

### Before (monolithic)
```
Client → POST /audit (scrape + score + crawl + AI) → response (~15-30s)
Client → PageSpeed API (parallel)
Client merges PageSpeed into result
```

### After (two-phase)
```
Client → POST /audit/fast (~5-8s) → scores, issues
Client → POST /audit/deep + PageSpeed (parallel, ~10-20s) → crawl, recommendations, coreWebVitals
Client deep-merges all results
```

### Fallback behavior
- `/deep` fails → `_deepWarning` set, report shows fast data + orange warning banner
- PageSpeed fails → `_pageSpeedWarning` set, report shows fast+deep data + yellow warning banner
- Both fail → report still renders with fast data only, both warning banners shown

## Deviations from Plan
None — implemented as specified.