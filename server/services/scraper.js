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

  try {
    const page = await browser.newPage()

    // Realistic User-Agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    )

    // Organic viewport
    await page.setViewport({ width: 1920, height: 1080 })

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

    // Human micro-delay to allow JS rendering
    await new Promise((r) => setTimeout(r, 1500))

    const content = await page.content()
    await browser.close()
    return { html: content, usedPuppeteer: true }
  } catch (error) {
    await browser.close()
    throw error
  }
}

/**
 * Detect site type from homepage HTML to decide scraping strategy.
 * Shopify/Next.js/Nuxt/Angular sites serve consistent shells —
 * internal pages can be fetched with axios instead of Puppeteer.
 */
function detectSiteType(html) {
  if (!html || typeof html !== 'string') return 'static'
  if (html.includes('Shopify.theme') || html.includes('cdn.shopify.com')) return 'shopify'
  if (html.includes('__NEXT_DATA__') || html.includes('_next/static')) return 'nextjs'
  if (html.includes('__nuxt') || html.includes('__NUXT__')) return 'nuxt'
  if (html.includes('ng-version') || html.includes('angular')) return 'angular'
  return 'static'
}

module.exports = { getRenderedPage, detectSiteType }