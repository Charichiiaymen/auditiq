const cheerio = require('cheerio');

// ─── Clean Room Content Extraction ───────────────────────────────────────────
// "Hard-strip" approach: removes ALL non-visible elements before extracting
// content. This ensures no sys-type metadata (JSON-LD, scripts, styles) leaks
// into word counts or semantic analysis.

const NON_VISIBLE_SELECTORS = [
  // ALL script tags (including JSON-LD, inline, external)
  'script',
  // ALL noscript tags
  'noscript',
  // ALL style tags (including linked, inline, scoped)
  'style',
  // ALL link tags (CSS, fonts, icons, etc.)
  'link',
  // ALL meta tags (including JSON-LD, Open Graph, etc.)
  'meta',
  // Embedded / non-text media
  'iframe', 'object', 'embed', 'svg', 'canvas',
  // Hidden / accessibility-only content
  '[hidden]', '[aria-hidden="true"]', '.hidden', '.sr-only',
  '.visually-hidden', '.screen-reader-text',
  // Admin / debug / test panels
  '[class*="admin"]', '[class*="debug"]', '[class*="test"]',
  '[id*="admin"]', '[id*="debug"]', '[id*="test"]'
].join(', ');

const NAV_SELECTORS = [
  'nav', 'header', 'footer', 'aside',
  '.sidebar', '.navigation', '.menu', '.breadcrumb', '.pagination'
].join(', ');

const CONTENT_SELECTORS = [
  'main', 'article', 'section',
  '[role="main"]',
  '.main-content', '.content', '.entry-content', '.post-content',
  '#content', '.article-content'
];

/**
 * Extract visible content with hard-stripped non-visible elements.
 * Removes ALL script, style, meta, link tags explicitly to prevent
 * sys-type metadata pollution from JSON-LD and other metadata blocks.
 *
 * @param {string} html - Raw HTML string to parse
 * @param {Object} options - Extraction options
 * @param {number} options.maxLength - Maximum output length (default: 100000)
 * @returns {string} - Clean, visible text content
 */
function extractCleanContent(html, { maxLength = 100000 } = {}) {
  if (!html || typeof html !== 'string') return '';

  try {
    const $ = cheerio.load(html);

    // 1. Remove ALL non-visible elements (explicit hard-strip)
    // This explicitly removes script, style, meta, link tags
    $(NON_VISIBLE_SELECTORS).remove();

    // 2. Remove HTML comments (which may contain metadata)
    $('*').contents().filter(function () {
      return this.type === 'comment';
    }).remove();

    // 3. Add spaces after block-level elements to prevent word merging
    const BLOCK_TAGS = [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'div', 'li', 'br', 'hr', 'section', 'article', 'main',
      'header', 'footer', 'nav', 'aside', 'blockquote', 'pre',
      'tr', 'dt', 'dd'
    ];
    BLOCK_TAGS.forEach(tag => {
      $(tag).append(' ');
    });

    // 4. Try semantic content areas in priority order
    let content = '';
    for (const selector of CONTENT_SELECTORS) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, elem) => { content += ' ' + $(elem).text(); });
        if (content.trim()) break;
      }
    }

    // 5. Fallback: body minus chrome (nav, header, footer, sidebar)
    if (!content.trim()) {
      $(NAV_SELECTORS).remove();
      content = $('body').text();
    }

    // 6. Clean and normalize
    return content
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, maxLength);
  } catch (error) {
    console.warn('Clean room content extraction failed:', error.message);
    return '';
  }
}

/**
 * Alternative: Extract with JSON-LD logging (debug mode).
 * Returns both content and metadata about what was stripped.
 *
 * @param {string} html - Raw HTML string to parse
 * @param {Object} options - Extraction options
 * @param {number} options.maxLength - Maximum output length (default: 100000)
 * @returns {Object} - { content: string, stripped: { scripts: number, styles: number, jsonLd: number } }
 */
function extractCleanContentWithStats(html, { maxLength = 100000 } = {}) {
  if (!html || typeof html !== 'string') return { content: '', stripped: { scripts: 0, styles: 0, jsonLd: 0 } };

  try {
    const $ = cheerio.load(html);

    // Count items to be stripped
    const jsonLdScripts = $('script[type="application/ld+json"]').length;
    const allScripts = $('script').length;
    const allStyles = $('style').length;

    // Perform clean extraction
    const content = extractCleanContent(html, { maxLength });

    return {
      content,
      stripped: {
        scripts: allScripts,
        styles: allStyles,
        jsonLd: jsonLdScripts,
        // Calculate how much content was cleaned
        wordsRemoved: html.split(/\s+/).length - content.split(/\s+/).length
      }
    };
  } catch (error) {
    console.warn('Clean room extraction with stats failed:', error.message);
    return { content: '', stripped: { scripts: 0, styles: 0, jsonLd: 0 } };
  }
}

/**
 * Check if an HTML string contains JSON-LD metadata blocks.
 * Useful for detecting whether content extraction needs hard-stripping.
 *
 * @param {string} html - Raw HTML to check
 * @returns {boolean} - True if JSON-LD blocks found
 */
function hasJsonLd(html) {
  return /<script[^>]*type=["']application\/ld\+json["'][^>]*>/.test(html) ||
         /<script[^>]*type=["']application\/ld\+json["'][^>]*>/.test(html);
}

/**
 * Recalculate word count for clean text.
 * Filters out empty strings and counts only actual words.
 *
 * @param {string} cleanText - Cleaned text content
 * @returns {number} - Word count
 */
function recalculateWordCount(cleanText) {
  if (!cleanText) return 0;
  return cleanText.split(/\s+/).filter(w => w.length > 0).length;
}

module.exports = {
  extractCleanContent,
  extractCleanContentWithStats,
  hasJsonLd,
  recalculateWordCount,
  // Expose for testing
  NON_VISIBLE_SELECTORS,
  CONTENT_SELECTORS,
  NAV_SELECTORS
};
