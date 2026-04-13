const cheerio = require('cheerio');

// ─── Content Extraction Filter ───────────────────────────────────────────────
// Isolates visible body text from main, section, and article tags while
// strictly purging minified script bundles, style blocks, and JSON-LD data
// to prevent inflated word counts from raw code.

const REMOVE_SELECTORS = [
  // Script bundles (minified, inline, external, JSON-LD)
  'script', 'noscript',
  // Style blocks (inline, linked, scoped)
  'style', 'link[rel="stylesheet"]',
  // Meta / head-level elements that leak into body
  'meta', 'link',
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

// Semantic content areas — tried in priority order; stops at first match
const CONTENT_SELECTORS = [
  'main', 'article', 'section',
  '[role="main"]',
  '.main-content', '.content', '.entry-content', '.post-content',
  '#content', '.article-content'
];

function extractVisibleContent(html) {
  if (!html || typeof html !== 'string') return '';

  try {
    const $ = cheerio.load(html);

    // 1. Purge all non-content elements
    $(REMOVE_SELECTORS).remove();

    // 2. Remove HTML comments
    $('*').contents().filter(function () {
      return this.type === 'comment';
    }).remove();

    // 3. Try semantic content areas in priority order
    // Add spaces after block-level elements to prevent word merging
    const BLOCK_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li', 'br', 'hr', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside', 'blockquote', 'pre', 'tr', 'dt', 'dd'];
    BLOCK_TAGS.forEach(tag => {
      $(tag).append(' ');
    });

    let content = '';
    for (const selector of CONTENT_SELECTORS) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, elem) => { content += ' ' + $(elem).text(); });
        if (content.trim()) break;
      }
    }

    // 4. Fallback: body minus chrome (nav, header, footer, sidebar)
    if (!content.trim()) {
      $(NAV_SELECTORS).remove();
      content = $('body').text();
    }

    // 5. Clean and normalize
    return content
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000);
  } catch (error) {
    console.warn('Content extraction failed:', error.message);
    return '';
  }
}

function recalculateWordCount(cleanText) {
  if (!cleanText) return 0;
  return cleanText.split(/\s+/).filter(w => w.length > 0).length;
}

module.exports = { extractVisibleContent, recalculateWordCount };