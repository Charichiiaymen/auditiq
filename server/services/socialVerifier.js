/**
 * Social Verifier — Phase 4: Uses Puppeteer to render JS-heavy pages and
 * verify that provided social handles match on-page social links in the DOM.
 *
 * The existing cheerio-based check only scans raw HTML. Many modern sites
 * render social links client-side (React, Next.js, etc.), so Puppeteer
 * gives us the fully rendered DOM to check against.
 */

const cheerio = require('cheerio')

/**
 * Verify social handles against the rendered page content.
 * First tries the Puppeteer-rendered HTML (if available), then falls back
 * to the static HTML from axios/cheerio.
 *
 * @param {string} html - Full HTML of the page (Puppeteer-rendered preferred)
 * @param {string} instagram - User-provided Instagram handle (e.g. "@brand" or "brand")
 * @param {string} facebook - User-provided Facebook URL (e.g. "https://facebook.com/brand")
 * @param {boolean} usedPuppeteer - Whether the HTML was fetched via Puppeteer
 */
function verifySocialLinks(html, instagram, facebook, usedPuppeteer = false) {
  const $ = cheerio.load(html)

  const instagramProvided = typeof instagram === 'string' && instagram.trim().length > 0
  const instagramHandleValid = instagramProvided
    ? /^@?[a-zA-Z0-9_.]{1,30}$/.test(instagram.trim())
    : false

  const facebookProvided = typeof facebook === 'string' && facebook.trim().length > 0
  const facebookURLValid = facebookProvided
    ? /^https?:\/\/(www\.)?facebook\.com\/.+/.test(facebook.trim())
    : false

  const bothProvided = instagramProvided && facebookProvided

  // Extract the clean handle (strip @ prefix)
  const instagramHandle = instagramProvided
    ? instagram.replace('@', '').toLowerCase().trim()
    : ''

  // ── DOM-based verification ──────────────────────────────────────────
  // Scan all <a> tags with href attributes for social links
  let instagramOnPage = false
  let facebookOnPage = false
  let instagramLinkFound = ''
  let facebookLinkFound = ''
  const socialLinksOnPage = []

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').toLowerCase()
    if (!href) return

    // Detect Instagram links
    if (href.includes('instagram.com/')) {
      socialLinksOnPage.push({ platform: 'Instagram', href: $(el).attr('href') })
      if (instagramProvided && href.includes('instagram.com/' + instagramHandle)) {
        instagramOnPage = true
        instagramLinkFound = $(el).attr('href')
      }
    }

    // Detect Facebook links
    if (href.includes('facebook.com/')) {
      socialLinksOnPage.push({ platform: 'Facebook', href: $(el).attr('href') })
      if (facebookProvided) {
        try {
          const fbPath = new URL(facebook.trim().toLowerCase()).pathname.replace('/', '')
          if (fbPath && href.includes(fbPath)) {
            facebookOnPage = true
            facebookLinkFound = $(el).attr('href')
          }
        } catch {
          // Invalid Facebook URL provided — skip DOM verification
        }
      }
    }

    // Also detect Twitter/X, LinkedIn, YouTube, TikTok for bonus reporting
    if (href.includes('twitter.com/') || href.includes('x.com/')) {
      socialLinksOnPage.push({ platform: 'Twitter/X', href: $(el).attr('href') })
    }
    if (href.includes('linkedin.com/')) {
      socialLinksOnPage.push({ platform: 'LinkedIn', href: $(el).attr('href') })
    }
    if (href.includes('youtube.com/') || href.includes('youtu.be/')) {
      socialLinksOnPage.push({ platform: 'YouTube', href: $(el).attr('href') })
    }
    if (href.includes('tiktok.com/')) {
      socialLinksOnPage.push({ platform: 'TikTok', href: $(el).attr('href') })
    }
  })

  // Fallback: also scan meta tags for social profile URLs
  $('meta[property="og:url"], meta[name="twitter:site"], link[rel="me"]').each((_, el) => {
    const content = ($(el).attr('content') || $(el).attr('href') || '').toLowerCase()
    if (instagramProvided && content.includes('instagram.com/' + instagramHandle)) {
      instagramOnPage = true
      instagramLinkFound = instagramLinkFound || content
    }
    if (facebookProvided && content.includes('facebook.com/')) {
      facebookOnPage = true
      facebookLinkFound = facebookLinkFound || content
    }
  })

  return {
    instagramProvided,
    instagramHandleValid,
    facebookProvided,
    facebookURLValid,
    bothProvided,
    // Phase 4: DOM-verified results
    instagramOnPage,
    facebookOnPage,
    instagramLinkFound,
    facebookLinkFound,
    socialLinksOnPage,
    verifiedByPuppeteer: usedPuppeteer,
  }
}

/**
 * Score social pillar — Phase 4: accounts for DOM verification + bonus for extra platforms
 */
function scoreSocialEnhanced(socialData) {
  let score = 0

  // Instagram presence (25 pts)
  if (socialData.instagramProvided && socialData.instagramHandleValid) score += 15
  if (socialData.instagramOnPage) score += 10

  // Facebook presence (25 pts)
  if (socialData.facebookProvided && socialData.facebookURLValid) score += 15
  if (socialData.facebookOnPage) score += 10

  // Both provided bonus (25 pts)
  if (socialData.bothProvided) score += 25

  // Phase 4: Bonus for additional social platforms detected on page (25 pts)
  const extraPlatforms = new Set(
    (socialData.socialLinksOnPage || [])
      .filter(l => !['Instagram', 'Facebook'].includes(l.platform))
      .map(l => l.platform)
  )
  if (extraPlatforms.size >= 3) score += 25
  else if (extraPlatforms.size >= 2) score += 15
  else if (extraPlatforms.size >= 1) score += 10

  return Math.min(score, 100)
}

module.exports = { verifySocialLinks, scoreSocialEnhanced }