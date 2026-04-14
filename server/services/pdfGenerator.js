/**
 * PDF Generator — uses vanilla Puppeteer to render HTML and produce an A4 PDF.
 * Reuses Docker-safe launch args from scraper.js (no-sandbox, disable-dev-shm-usage, etc.)
 * Stealth plugin is NOT needed here since we render local HTML, not remote pages.
 */

const puppeteer = require('puppeteer')

async function generatePdf(html) {
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
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    })
    return Buffer.from(buffer)
  } finally {
    await browser.close()
  }
}

module.exports = { generatePdf }