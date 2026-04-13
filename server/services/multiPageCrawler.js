const axios = require('axios')
const cheerio = require('cheerio')
const { getRenderedPage, detectSiteType } = require('./scraper')
const { extractVisibleContent, recalculateWordCount } = require('./contentExtractor')

/**
 * Fetch a page using Stealth Puppeteer with axios fallback.
 * Homepage: always Puppeteer (catches JS-rendered content).
 * Internal pages: use axios when site type is detected as Shopify/static/SPA.
 */
async function fetchPageSafe(url, { preferAxios = false } = {}) {
  // If caller knows axios is sufficient (e.g. internal page on a detected SPA), skip Puppeteer
  if (preferAxios) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        },
      })
      return response.data
    } catch (axiosErr) {
      console.warn(`axios failed for ${url}, falling back to Puppeteer:`, axiosErr.message)
      // Fall through to Puppeteer below
    }
  }

  // Stealth Puppeteer (primary for homepage, fallback for internal pages)
  try {
    const { html } = await getRenderedPage(url)
    return html
  } catch (puppeteerErr) {
    console.warn(`Puppeteer failed for ${url}:`, puppeteerErr.message)

    // Last resort: try axios
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        },
      })
      return response.data
    } catch (axiosErr) {
      console.error(`Both Puppeteer and axios failed for ${url}:`, axiosErr.message)
      return null
    }
  }
}

function extractInternalLinks(html, baseUrl) {
  const $ = cheerio.load(html)
  const links = new Set()
  let hostname = ''
  try { hostname = new URL(baseUrl).hostname } catch { return [] }

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    try {
      let absolute = ''
      if (href.startsWith('http')) {
        absolute = href
      } else if (href.startsWith('/') && !href.startsWith('//')) {
        const base = new URL(baseUrl)
        absolute = `${base.protocol}//${base.hostname}${href}`
      } else {
        return
      }
      const parsed = new URL(absolute)
      if (
        parsed.hostname === hostname &&
        !parsed.pathname.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|ico|css|js|zip|xml|txt)$/i) &&
        !parsed.pathname.includes('#') &&
        parsed.pathname !== '/'
      ) {
        links.add(absolute.split('?')[0].split('#')[0])
      }
    } catch {}
  })

  return [...links].slice(0, 10)
}

function extractPageMeta(html, url) {
  const $ = cheerio.load(html)
  const cleanContent = extractVisibleContent(html)
  return {
    url,
    title: $('title').first().text().trim(),
    metaDescription: $('meta[name="description"]').attr('content')?.trim() || '',
    h1: $('h1').first().text().trim(),
    h1Count: $('h1').length,
    canonical: $('link[rel="canonical"]').attr('href') || '',
    wordCount: recalculateWordCount(cleanContent),
    hasSchema: $('script[type="application/ld+json"]').length > 0,
    hasMetaDescription: ($('meta[name="description"]').attr('content') || '').trim().length > 0,
    hasH1: $('h1').length > 0,
  }
}

function detectIssuesAcrossPages(pages) {
  const crossPageIssues = []

  // Duplicate titles
  const titles = pages.map(p => p.title.toLowerCase()).filter(t => t.length > 0)
  const titleDupes = titles.filter((t, i) => titles.indexOf(t) !== i)
  if (titleDupes.length > 0) {
    crossPageIssues.push({
      severity: 'High',
      code: 'DUPLICATE_TITLES',
      title: 'Duplicate page titles detected across pages',
      detail: `${titleDupes.length} page(s) share the same title tag. Duplicate titles confuse search engines about which page to rank.`,
      fix: 'Give each page a unique, descriptive title tag that reflects its specific content.',
      effort: 'Medium',
      affectedPages: pages.filter(p => titleDupes.includes(p.title.toLowerCase())).map(p => p.url),
    })
  }

  // Duplicate meta descriptions
  const metas = pages.map(p => p.metaDescription.toLowerCase()).filter(m => m.length > 0)
  const metaDupes = metas.filter((m, i) => metas.indexOf(m) !== i)
  if (metaDupes.length > 0) {
    crossPageIssues.push({
      severity: 'Medium',
      code: 'DUPLICATE_META_DESCRIPTIONS',
      title: 'Duplicate meta descriptions detected across pages',
      detail: `${metaDupes.length} page(s) share identical meta descriptions. Each page should have a unique description.`,
      fix: 'Write a unique meta description for each page summarizing its specific content.',
      effort: 'Medium',
      affectedPages: pages.filter(p => metaDupes.includes(p.metaDescription.toLowerCase())).map(p => p.url),
    })
  }

  // Pages missing H1
  const missingH1 = pages.filter(p => !p.hasH1)
  if (missingH1.length > 0) {
    crossPageIssues.push({
      severity: 'High',
      code: 'MISSING_H1_MULTIPLE_PAGES',
      title: `${missingH1.length} crawled page(s) are missing H1 tags`,
      detail: 'H1 tags are missing on internal pages. This is a site-wide SEO issue, not just a homepage problem.',
      fix: 'Add a descriptive H1 tag to every page on your site.',
      effort: 'Medium',
      affectedPages: missingH1.map(p => p.url),
    })
  }

  // Pages missing meta description
  const missingMeta = pages.filter(p => !p.hasMetaDescription)
  if (missingMeta.length > 0) {
    crossPageIssues.push({
      severity: 'High',
      code: 'MISSING_META_MULTIPLE_PAGES',
      title: `${missingMeta.length} crawled page(s) are missing meta descriptions`,
      detail: 'Meta descriptions are missing across multiple pages — this is a site-wide pattern that needs systematic fixing.',
      fix: 'Audit all pages and add unique meta descriptions to each one.',
      effort: 'Medium',
      affectedPages: missingMeta.map(p => p.url),
    })
  }

  // Pages missing schema
  const missingSchema = pages.filter(p => !p.hasSchema)
  if (missingSchema.length > 0) {
    crossPageIssues.push({
      severity: 'Medium',
      code: 'MISSING_SCHEMA_MULTIPLE_PAGES',
      title: `${missingSchema.length} crawled page(s) lack structured data`,
      detail: 'Structured data is missing across multiple pages. Adding schema consistently improves rich result eligibility.',
      fix: 'Implement relevant JSON-LD schema on all key pages.',
      effort: 'Complex',
      affectedPages: missingSchema.map(p => p.url),
    })
  }

  // Thin content pages
  const thinPages = pages.filter(p => p.wordCount < 300)
  if (thinPages.length > 0) {
    crossPageIssues.push({
      severity: 'Medium',
      code: 'THIN_CONTENT_MULTIPLE_PAGES',
      title: `${thinPages.length} crawled page(s) have thin content`,
      detail: 'Multiple pages have fewer than 300 words. Thin content across a site signals low quality to Google.',
      fix: 'Expand content on each thin page to at least 300-500 words with relevant, helpful information.',
      effort: 'Complex',
      affectedPages: thinPages.map(p => p.url),
    })
  }

  return crossPageIssues
}

async function crawlSite(homepageUrl, homepageHtml) {
  const internalLinks = extractInternalLinks(homepageHtml, homepageUrl)
  const pagesToCrawl = internalLinks.slice(0, 3)

  // Detect site type from homepage HTML to decide scraping strategy
  const siteType = detectSiteType(homepageHtml)
  // For detected SPA frameworks (Shopify/Next.js/Nuxt/Angular), axios is
  // sufficient and ~3x faster than Puppeteer for internal pages.
  // For unknown/true static sites, also use axios since the HTML is already
  // server-rendered and doesn't need JS execution.
  const useAxiosForInternals = true

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Hybrid] Site type: ${siteType} — internal pages will use axios`)
  }

  const homepageMeta = extractPageMeta(homepageHtml, homepageUrl)
  const crawledPages = [homepageMeta]

  const crawlResults = await Promise.all(
    pagesToCrawl.map(async (url) => {
      const html = await fetchPageSafe(url, { preferAxios: useAxiosForInternals })
      if (!html) return null
      return extractPageMeta(html, url)
    })
  )

  crawlResults.forEach(page => { if (page) crawledPages.push(page) })

  const crossPageIssues = detectIssuesAcrossPages(crawledPages)

  return {
    pagesCrawled: crawledPages.length,
    pages: crawledPages,
    crossPageIssues,
    siteType,
  }
}

module.exports = { crawlSite, fetchPageSafe }