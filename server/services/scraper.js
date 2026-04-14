const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')

puppeteer.use(StealthPlugin())

// ─── Randomized User-Agent Pool ───────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
]

// ─── Randomized Viewport Pool ─────────────────────────────────────────────────
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1680, height: 1050 },
]

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function randomViewport() {
  return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)]
}

// ─── WAF Challenge Detection ─────────────────────────────────────────────────
const WAF_MARKERS = {
  cloudflare: ['cf-browser-verification', 'Just a moment', '__cf_chl_rt_tk', 'cf-challenge'],
  akamai: ['akamai', 'Akamai', '_abck', 'bm_sz'],
}

async function detectWAFForPage(page) {
  const content = await page.content()
  for (const [waf, markers] of Object.entries(WAF_MARKERS)) {
    if (markers.some(m => content.includes(m))) return waf
  }
  return null
}

async function waitForWAFChallenge(page, maxWaitMs = 15000) {
  const start = Date.now()
  const pollInterval = 3000

  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollInterval))
    const waf = await detectWAFForPage(page)
    if (!waf) return true // challenge resolved
  }
  return false // timed out
}

// ─── Human-like Scroll Simulation ────────────────────────────────────────────
async function simulateHumanScroll(page) {
  try {
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight)
    const viewportHeight = await page.evaluate(() => window.innerHeight)
    const step = 200
    const delay = 80

    // Scroll down in 200px increments
    for (let y = 0; y < scrollHeight; y += step) {
      await page.evaluate((y) => window.scrollTo(0, y), y)
      await new Promise(r => setTimeout(r, delay))
    }

    // Return to top
    await page.evaluate(() => window.scrollTo(0, 0))
    await new Promise(r => setTimeout(r, 500))
  } catch {
    // Scroll simulation is best-effort; don't fail the whole scrape
  }
}

// ─── Core Scraper with Retry ─────────────────────────────────────────────────
const RETRY_DELAYS = [1000, 3000, 6000]

async function getRenderedPage(url) {
  let lastError

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]))
    }

    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    })

    try {
      const page = await browser.newPage()

      // Randomized UA + viewport per attempt
      const ua = randomUA()
      const vp = randomViewport()
      await page.setUserAgent(ua)
      await page.setViewport(vp)

      // Anti-detection overrides
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false })
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        })
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        })
        window.chrome = { runtime: {} }
        const originalQuery = window.navigator.permissions.query
        window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters)
      })

      // Block images/fonts/media to speed up load
      await page.setRequestInterception(true)
      page.on('request', (req) => {
        if (['image', 'font', 'media'].includes(req.resourceType())) {
          req.abort()
        } else {
          req.continue()
        }
      })

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // WAF challenge detection
      const waf = await detectWAFForPage(page)
      if (waf) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Stealth] ${waf} WAF detected, waiting for challenge resolution...`)
        }
        const resolved = await waitForWAFChallenge(page)
        if (!resolved) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Stealth] ${waf} challenge not resolved on attempt ${attempt + 1}`)
          }
          await browser.close()
          continue // retry with fresh UA/viewport
        }
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Stealth] ${waf} challenge resolved`)
        }
      }

      // Human micro-delay for JS rendering
      await new Promise(r => setTimeout(r, 1500))

      // Scroll simulation for lazy content hydration (critical for Airbnb/Zara)
      await simulateHumanScroll(page)

      const content = await page.content()
      await browser.close()
      return { html: content, usedPuppeteer: true }
    } catch (error) {
      await browser.close()
      lastError = error
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Stealth] Attempt ${attempt + 1} failed: ${error.message}`)
      }
    }
  }

  throw lastError
}

/**
 * Detect site type from homepage HTML to decide scraping strategy.
 */
function detectSiteType(html) {
  if (!html || typeof html !== 'string') return 'static'
  if (html.includes('Shopify.theme') || html.includes('cdn.shopify.com')) return 'shopify'
  if (html.includes('__NEXT_DATA__') || html.includes('_next/static')) return 'nextjs'
  if (html.includes('__nuxt') || html.includes('__NUXT__')) return 'nuxt'
  if (html.includes('ng-version') || html.includes('angular')) return 'angular'
  if (html.includes('data-reactroot') || html.includes('data-reactid') || html.includes('_reactRootContainer')) return 'react'
  if (html.includes('__vue__') || html.includes('data-v-') || html.includes('data-server-rendered')) return 'vue'
  if (html.includes('wp-content') || html.includes('wp-includes')) return 'wordpress'
  if (html.includes('wix.com') || html.includes('wixCode') || html.includes('data-wix')) return 'wix'
  if (html.includes('squarespace') || html.includes('sqs-template')) return 'squarespace'
  if (html.includes('webflow') || html.includes('data-wf-')) return 'webflow'
  return 'static'
}

module.exports = { getRenderedPage, detectSiteType, randomUA, USER_AGENTS, VIEWPORTS }