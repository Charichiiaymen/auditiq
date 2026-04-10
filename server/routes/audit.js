const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { generateRecommendations } = require('../services/aiRecommender');
const { getPageSpeedData } = require('../services/pageSpeed');
const { crawlSite } = require('../services/multiPageCrawler');

const router = express.Router();

// ─── STEP 1: Fetch the page HTML ───────────────────────────────────────────
async function fetchPage(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AuditIQ/1.0)',
      },
    });
    return response.data;
  } catch (err) {
    throw new Error('Failed to fetch URL: ' + err.message);
  }
}

// ─── STEP 2: SEO Audit ─────────────────────────────────────────────────────
function auditSEO(html, url) {
  const $ = cheerio.load(html)

  // ── Title ──────────────────────────────────────────────────
  const titleText = $('title').first().text().trim()
  const hasTitle = titleText.length > 0
  const titleLength = titleText.length
  const titleOptimal = titleLength >= 30 && titleLength <= 60

  // ── Meta Description ───────────────────────────────────────
  const metaDesc = $('meta[name="description"]').attr('content') || ''
  const hasMetaDescription = metaDesc.trim().length > 0
  const metaDescriptionLength = metaDesc.trim().length
  const metaDescOptimal = metaDescriptionLength >= 120 && metaDescriptionLength <= 160

  // ── Headings ───────────────────────────────────────────────
  const h1Tags = $('h1')
  const hasH1 = h1Tags.length > 0
  const h1Count = h1Tags.length
  const h1Text = h1Tags.first().text().trim()
  const h2Count = $('h2').length
  const h3Count = $('h3').length
  const hasHeadingHierarchy = hasH1 && h2Count > 0

  // ── Images ─────────────────────────────────────────────────
  const allImages = $('img')
  const totalImages = allImages.length
  let imagesMissingAlt = 0
  let imagesWithoutDimensions = 0
  allImages.each((_, el) => {
    const alt = $(el).attr('alt')
    if (alt === undefined || alt.trim() === '') imagesMissingAlt++
    if (!$(el).attr('width') && !$(el).attr('height')) imagesWithoutDimensions++
  })

  // ── Links ──────────────────────────────────────────────────
  let internalLinks = 0
  let externalLinks = 0
  let brokenAnchors = 0
  const urlHost = (() => { try { return new URL(url).hostname } catch { return '' } })()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    if (href.startsWith('#') || href === '') { brokenAnchors++; return }
    if (href.startsWith('http')) {
      try {
        const linkHost = new URL(href).hostname
        if (linkHost === urlHost) internalLinks++
        else externalLinks++
      } catch { externalLinks++ }
    } else { internalLinks++ }
  })

  // ── Keyword Analysis ───────────────────────────────────────
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().toLowerCase()
  const words = bodyText.split(' ').filter(w => w.length > 3)
  const wordFreq = {}
  words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1 })
  const sortedWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1])
  const topKeywords = sortedWords.slice(0, 5).map(([word, count]) => ({
    word,
    count,
    density: parseFloat(((count / words.length) * 100).toFixed(2))
  }))

  const primaryKeyword = topKeywords[0]?.word || ''
  const keywordInTitle = primaryKeyword ? titleText.toLowerCase().includes(primaryKeyword) : false
  const keywordInH1 = primaryKeyword ? h1Text.toLowerCase().includes(primaryKeyword) : false
  const keywordInMeta = primaryKeyword ? metaDesc.toLowerCase().includes(primaryKeyword) : false
  const keywordInURL = primaryKeyword ? url.toLowerCase().includes(primaryKeyword) : false

  // ── Technical SEO signals ──────────────────────────────────
  const hasCanonical = $('link[rel="canonical"]').length > 0
  const canonicalURL = $('link[rel="canonical"]').attr('href') || ''
  const hasRobotsMeta = $('meta[name="robots"]').length > 0
  const robotsContent = $('meta[name="robots"]').attr('content') || ''
  const isIndexable = !robotsContent.toLowerCase().includes('noindex')
  const hasLangAttribute = $('html').attr('lang') ? true : false
  const langValue = $('html').attr('lang') || ''
  const hasFavicon = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').length > 0

  // ── Schema Markup ──────────────────────────────────────────
  const hasStructuredData = $('script[type="application/ld+json"]').length > 0
  const schemaTypes = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html())
      const type = json['@type'] || (Array.isArray(json) ? json[0]['@type'] : '')
      if (type) schemaTypes.push(type)
    } catch {}
  })

  // ── Social & OG ───────────────────────────────────────────
  const hasOpenGraph = $('meta[property^="og:"]').length > 0
  const ogTitle = $('meta[property="og:title"]').attr('content') || ''
  const ogDescription = $('meta[property="og:description"]').attr('content') || ''
  const ogImage = $('meta[property="og:image"]').attr('content') || ''
  const hasTwitterCard = $('meta[name="twitter:card"]').length > 0
  const hasCompleteOG = !!(ogTitle && ogDescription && ogImage)

  // ── Page Resources ─────────────────────────────────────────
  const scriptCount = $('script').length
  const stylesheetCount = $('link[rel="stylesheet"]').length
  const inlineScripts = $('script:not([src])').length
  const inlineStyles = $('style').length
  const hasViewportMeta = $('meta[name="viewport"]').length > 0
  const isHTTPS = url.startsWith('https')

  // ── Content signals ────────────────────────────────────────
  const paragraphCount = $('p').length
  const wordCount = words.length
  const hasCTA = ['buy','order','subscribe','sign up','get started','contact','book','demo','try','download','shop now','learn more','get a quote'].some(kw => bodyText.includes(kw))
  const hasPhoneNumber = /(\+?\d[\d\s\-().]{7,}\d)/.test($('body').text())
  const hasEmail = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test($('body').text())
  const hasSocialProof = ['review', 'testimonial', 'rating', 'trust', 'client', 'customer', 'partner'].some(kw => bodyText.includes(kw))

  return {
    // Title
    hasTitle, titleLength, titleText, titleOptimal,
    // Meta
    hasMetaDescription, metaDescriptionLength, metaDescOptimal,
    // Headings
    hasH1, h1Count, h1Text, h2Count, h3Count, hasHeadingHierarchy,
    // Images
    totalImages, imagesMissingAlt, imagesWithoutDimensions,
    // Links
    internalLinks, externalLinks, brokenAnchors,
    // Keywords
    topKeywords, primaryKeyword, keywordInTitle, keywordInH1, keywordInMeta, keywordInURL,
    // Indexability
    hasCanonical, canonicalURL, hasRobotsMeta, robotsContent, isIndexable,
    // Language & Favicon
    hasLangAttribute, langValue, hasFavicon,
    // Schema
    hasStructuredData, schemaTypes,
    // Social
    hasOpenGraph, ogTitle, ogDescription, ogImage, hasTwitterCard, hasCompleteOG,
    // Resources
    scriptCount, stylesheetCount, inlineScripts, inlineStyles,
    // Core
    hasViewportMeta, isHTTPS,
    // Content
    paragraphCount, wordCount, hasCTA, hasPhoneNumber, hasEmail, hasSocialProof,
  }
}

// ─── STEP 3: Technical Audit ───────────────────────────────────────────────
function auditTechnical(html, url) {
  const $ = cheerio.load(html);

  const isHTTPS = url.startsWith('https');
  const hasViewportMeta = $('meta[name="viewport"]').length > 0;

  let hasOpenGraph = false;
  $('meta').each((_, el) => {
    const prop = $(el).attr('property') || '';
    if (prop.startsWith('og:')) hasOpenGraph = true;
  });

  const scriptCount = $('script').length;
  const stylesheetCount = $('link[rel="stylesheet"]').length;
  const hasStructuredData = $('script[type="application/ld+json"]').length > 0;

  return {
    isHTTPS,
    hasViewportMeta,
    hasOpenGraph,
    scriptCount,
    stylesheetCount,
    hasStructuredData,
  };
}

// ─── Score SEO ────────────────────────────────────────────────────────────
function scoreSEO(seoData) {
  let score = 0

  // Title (15 pts)
  if (seoData.hasTitle) score += 5
  if (seoData.titleOptimal) score += 10

  // Meta description (15 pts)
  if (seoData.hasMetaDescription) score += 5
  if (seoData.metaDescOptimal) score += 10

  // Headings (10 pts)
  if (seoData.hasH1 && seoData.h1Count === 1) score += 7
  if (seoData.hasHeadingHierarchy) score += 3

  // Images (10 pts)
  if (seoData.imagesMissingAlt === 0) score += 10
  else if (seoData.totalImages > 0) score += Math.round((1 - seoData.imagesMissingAlt / seoData.totalImages) * 10)

  // Keywords (15 pts)
  if (seoData.keywordInTitle) score += 5
  if (seoData.keywordInH1) score += 5
  if (seoData.keywordInMeta) score += 5

  // Indexability (10 pts)
  if (seoData.hasCanonical) score += 4
  if (seoData.hasRobotsMeta) score += 2
  if (seoData.isIndexable) score += 4

  // Schema (10 pts)
  if (seoData.hasStructuredData) score += 7
  if (seoData.schemaTypes.length > 1) score += 3

  // Social tags (10 pts)
  if (seoData.hasOpenGraph) score += 4
  if (seoData.hasCompleteOG) score += 4
  if (seoData.hasTwitterCard) score += 2

  // Language & Favicon (5 pts)
  if (seoData.hasLangAttribute) score += 3
  if (seoData.hasFavicon) score += 2

  return Math.min(score, 100)
}

// ─── Score Technical ───────────────────────────────────────────────
function scoreTechnical(techData) {
  let score = 0;

  // HTTPS (20 pts)
  if (techData.isHTTPS) score += 20;

  // Viewport Meta (15 pts)
  if (techData.hasViewportMeta) score += 15;

  // Open Graph (15 pts)
  if (techData.hasOpenGraph) score += 10;
  if (techData.hasCompleteOG) score += 5;

  // Structured Data (15 pts)
  if (techData.hasStructuredData) score += 15;

  // Script Count (10 pts)
  if (techData.scriptCount < 15) score += 10;
  else if (techData.scriptCount < 30) score += 5;

  // Stylesheet Count (5 pts)
  if (techData.stylesheetCount < 5) score += 5;

  // Inline Scripts/Styles (10 pts)
  if (techData.inlineScripts === 0) score += 5;
  if (techData.inlineStyles === 0) score += 5;

  return Math.min(score, 100);
}

// ─── STEP 7: Content Audit ─────────────────────────────────────────────────
function auditContent(html) {
  const $ = cheerio.load(html);

  // ── Keyword Analysis ───────────────────────────────────────
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().toLowerCase();
  const words = bodyText.split(' ').filter(w => w.length > 3);
  const wordFreq = {};
  words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1 });
  const sortedWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]);
  const topKeywords = sortedWords.slice(0, 5).map(([word, count]) => ({
    word,
    count,
    density: parseFloat(((count / words.length) * 100).toFixed(2))
  }));

  const wordCount = words.length;

  const ctaKeywords = ['buy', 'order', 'subscribe', 'sign up', 'get started', 'contact', 'book', 'demo', 'try', 'download', 'shop now', 'learn more', 'get a quote'];
  const bodyLower = bodyText.toLowerCase();
  const hasCTA = ctaKeywords.some((kw) => bodyLower.includes(kw));

  const paragraphCount = $('p').length;
  const avgWordsPerParagraph = paragraphCount > 0
    ? Math.round((wordCount / paragraphCount) * 10) / 10
    : 0;

  const hasPhoneNumber = /(\+?\d[\d\s\-().]{7,}\d)/.test($('body').text());
  const hasEmail = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test($('body').text());
  const hasSocialProof = ['review', 'testimonial', 'rating', 'trust', 'client', 'customer', 'partner'].some(kw => bodyText.includes(kw));

  return {
    wordCount,
    hasCTA,
    paragraphCount,
    avgWordsPerParagraph,
    hasPhoneNumber,
    hasEmail,
    hasSocialProof,
    topKeywords,
  };
}

// ─── Score Content ─────────────────────────────────────────────────
function scoreContent(contentData) {
  let score = 0;

  // Word Count (25 pts)
  if (contentData.wordCount >= 500) score += 25;
  else if (contentData.wordCount >= 300) score += 20;
  else if (contentData.wordCount >= 150) score += 15;
  else if (contentData.wordCount > 0) score += 10;

  // CTA (15 pts)
  if (contentData.hasCTA) score += 15;

  // Paragraph Structure (15 pts)
  if (contentData.paragraphCount >= 5) score += 15;
  else if (contentData.paragraphCount >= 3) score += 10;
  else if (contentData.paragraphCount > 0) score += 5;

  // Contact Information (15 pts)
  if (contentData.hasPhoneNumber) score += 10;
  if (contentData.hasEmail) score += 5;

  // Social Proof (10 pts)
  if (contentData.hasSocialProof) score += 10;

  // Keyword Density (10 pts)
  const primaryKeywordDensity = contentData.topKeywords[0]?.density || 0;
  if (primaryKeywordDensity >= 1.0) score += 10;
  else if (primaryKeywordDensity >= 0.5) score += 5;

  // Average Words Per Paragraph (10 pts)
  if (contentData.avgWordsPerParagraph >= 20 && contentData.avgWordsPerParagraph <= 100) score += 10;

  return Math.min(score, 100);
}

// ─── STEP 9: Social Audit ──────────────────────────────────────────────────
function auditSocial(instagram, facebook, html) {
  const $ = cheerio.load(html)
  const pageText = $('body').html() || ''

  const instagramProvided = typeof instagram === 'string' && instagram.trim().length > 0
  const instagramHandleValid = instagramProvided
    ? /^@?[a-zA-Z0-9_.]{1,30}$/.test(instagram.trim())
    : false

  const facebookProvided = typeof facebook === 'string' && facebook.trim().length > 0
  const facebookURLValid = facebookProvided
    ? /^https?:\/\/(www\.)?facebook\.com\/.+/.test(facebook.trim())
    : false

  const bothProvided = instagramProvided && facebookProvided

  // Check if social links actually appear on the page
  const instagramHandle = instagram.replace('@', '').toLowerCase().trim()
  const instagramOnPage = instagramProvided
    ? pageText.toLowerCase().includes('instagram.com/' + instagramHandle) || pageText.toLowerCase().includes(instagramHandle)
    : false

  const facebookOnPage = facebookProvided
    ? pageText.toLowerCase().includes(facebook.trim().toLowerCase())
    : false

  return {
    instagramProvided,
    instagramHandleValid,
    facebookProvided,
    facebookURLValid,
    bothProvided,
    instagramOnPage,
    facebookOnPage,
  }
}

// ─── Score Social ─────────────────────────────────────────────────
function scoreSocial(socialData) {
  let score = 0
  if (socialData.instagramProvided && socialData.instagramHandleValid) score += 20
  if (socialData.instagramOnPage) score += 10
  if (socialData.facebookProvided && socialData.facebookURLValid) score += 20
  if (socialData.facebookOnPage) score += 10
  if (socialData.bothProvided) score += 40
  return score
}

// ─── Issue Severity Triage ─────────────────────────────────────────────────
function triageIssues(seoData, techData, contentData, socialData) {
  const issues = []

  // ── CRITICAL ───────────────────────────────────────────────
  if (!techData.isHTTPS) issues.push({
    severity: 'Critical',
    impact: 'High',
    pillar: 'Technical',
    code: 'NO_HTTPS',
    title: 'Site is not using HTTPS',
    detail: 'Your site is served over HTTP. Browsers flag it as "Not Secure", Google penalizes it in rankings, and users lose trust immediately.',
    fix: 'Install an SSL certificate on your server. Most hosting providers offer free SSL via Let\'s Encrypt.',
    effort: 'Quick Win',
  })

  if (!seoData.hasTitle) issues.push({
    severity: 'Critical',
    impact: 'High',
    pillar: 'SEO',
    code: 'NO_TITLE',
    title: 'Page is missing a title tag',
    detail: 'The title tag is the single most important on-page SEO element. Without it, search engines have no signal for what your page is about.',
    fix: 'Add a <title> tag inside your <head> with 30-60 characters describing your page\'s primary topic.',
    effort: 'Quick Win',
  })

  if (!seoData.isIndexable) issues.push({
    severity: 'Critical',
    impact: 'High',
    pillar: 'SEO',
    code: 'NOINDEX',
    title: 'Page is blocked from search engine indexing',
    detail: 'Your robots meta tag contains "noindex" which tells search engines not to index this page. It will not appear in search results.',
    fix: 'Remove the "noindex" directive from your robots meta tag unless this page is intentionally hidden.',
    effort: 'Quick Win',
  })

  if (!seoData.hasH1) issues.push({
    severity: 'Critical',
    impact: 'High',
    pillar: 'SEO',
    code: 'NO_H1',
    title: 'Page has no H1 heading',
    detail: 'The H1 is the primary heading that tells both users and search engines what this page is about. Missing it is a fundamental SEO error.',
    fix: 'Add exactly one H1 tag near the top of your page containing your primary keyword.',
    effort: 'Quick Win',
  })

  // ── HIGH ───────────────────────────────────────────────────
  if (seoData.hasTitle && !seoData.titleOptimal) issues.push({
    severity: 'High',
    impact: 'High',
    pillar: 'SEO',
    code: 'TITLE_LENGTH',
    title: `Page title is ${seoData.titleLength < 30 ? 'too short' : 'too long'} (${seoData.titleLength} chars)`,
    detail: seoData.titleLength < 30
      ? 'A title under 30 characters wastes valuable ranking space and fails to communicate the page topic clearly.'
      : 'A title over 60 characters gets truncated in search results, reducing click-through rates.',
    fix: `Rewrite your title tag to be between 30-60 characters. Current title: "${seoData.titleText}"`,
    effort: 'Quick Win',
  })

  if (!seoData.hasMetaDescription) issues.push({
    severity: 'High',
    impact: 'High',
    pillar: 'SEO',
    code: 'NO_META_DESC',
    title: 'Missing meta description',
    detail: 'Without a meta description, Google auto-generates one from your page content — often poorly. A well-written description increases CTR by up to 30%.',
    fix: 'Add a <meta name="description"> tag with 120-160 characters summarizing the page value proposition.',
    effort: 'Quick Win',
  })

  if (seoData.hasMetaDescription && !seoData.metaDescOptimal) issues.push({
    severity: 'High',
    impact: 'Medium',
    pillar: 'SEO',
    code: 'META_DESC_LENGTH',
    title: `Meta description is ${seoData.metaDescriptionLength < 120 ? 'too short' : 'too long'} (${seoData.metaDescriptionLength} chars)`,
    detail: seoData.metaDescriptionLength < 120
      ? 'A short meta description leaves ranking and CTR potential unused.'
      : 'A meta description over 160 characters gets truncated in search results.',
    fix: 'Rewrite your meta description to be between 120-160 characters.',
    effort: 'Quick Win',
  })

  if (seoData.h1Count > 1) issues.push({
    severity: 'High',
    impact: 'Medium',
    pillar: 'SEO',
    code: 'MULTIPLE_H1',
    title: `Multiple H1 tags found (${seoData.h1Count})`,
    detail: 'Having more than one H1 dilutes the page topic signal sent to search engines and creates a confusing content hierarchy.',
    fix: 'Keep exactly one H1 per page. Convert additional H1s to H2 or H3 as appropriate.',
    effort: 'Quick Win',
  })

  if (seoData.imagesMissingAlt > 0) issues.push({
    severity: 'High',
    impact: 'Medium',
    pillar: 'SEO',
    code: 'MISSING_ALT',
    title: `${seoData.imagesMissingAlt} image${seoData.imagesMissingAlt > 1 ? 's' : ''} missing alt text`,
    detail: 'Alt text helps search engines understand image content and is critical for accessibility compliance (WCAG). Missing alt text means lost image search traffic.',
    fix: 'Add descriptive alt attributes to all <img> tags. Include your primary keyword where naturally relevant.',
    effort: 'Medium',
  })

  if (!techData.hasOpenGraph || !seoData.hasCompleteOG) issues.push({
    severity: 'High',
    impact: 'Medium',
    pillar: 'Technical',
    code: 'INCOMPLETE_OG',
    title: !techData.hasOpenGraph ? 'Open Graph tags are missing' : 'Open Graph tags are incomplete',
    detail: 'Open Graph tags control how your page appears when shared on Facebook, LinkedIn, and WhatsApp. Missing or incomplete tags result in poor link previews that reduce click-through.',
    fix: 'Add og:title, og:description, og:image, and og:url meta tags to your page <head>.',
    effort: 'Quick Win',
  })

  if (!seoData.hasStructuredData) issues.push({
    severity: 'High',
    impact: 'Medium',
    pillar: 'SEO',
    code: 'NO_SCHEMA',
    title: 'No structured data (Schema.org) detected',
    detail: 'Structured data enables rich results in Google Search (star ratings, FAQs, breadcrumbs). Sites with rich results get significantly higher CTR.',
    fix: 'Add JSON-LD structured data relevant to your business type (Organization, LocalBusiness, Product, Article).',
    effort: 'Medium',
  })

  if (!contentData.hasCTA) issues.push({
    severity: 'High',
    impact: 'High',
    pillar: 'Content',
    code: 'NO_CTA',
    title: 'No call-to-action detected on the page',
    detail: 'Without a clear CTA, visitors have no direction and conversion rates suffer. Every page should guide the user toward one primary action.',
    fix: 'Add a prominent CTA button or link (e.g., "Contact Us", "Get Started", "Book a Demo") above the fold.',
    effort: 'Quick Win',
  })

  if (contentData.wordCount < 300) issues.push({
    severity: 'High',
    impact: 'High',
    pillar: 'Content',
    code: 'THIN_CONTENT',
    title: `Thin content — only ${contentData.wordCount} words detected`,
    detail: 'Pages with fewer than 300 words are considered thin content by Google. They rarely rank well and fail to build topical authority.',
    fix: 'Expand your page content to at least 300-500 words. Cover your topic comprehensively with headers, lists, and supporting detail.',
    effort: 'Medium',
  })

  // ── MEDIUM ─────────────────────────────────────────────────
  if (!seoData.hasCanonical) issues.push({
    severity: 'Medium',
    impact: 'Medium',
    pillar: 'SEO',
    code: 'NO_CANONICAL',
    title: 'Missing canonical tag',
    detail: 'Without a canonical tag, search engines may index multiple versions of your page (www vs non-www, HTTP vs HTTPS) as duplicate content.',
    fix: 'Add <link rel="canonical" href="your-preferred-url"> to your page <head>.',
    effort: 'Quick Win',
  })

  if (!seoData.hasHeadingHierarchy) issues.push({
    severity: 'Medium',
    impact: 'Medium',
    pillar: 'SEO',
    code: 'POOR_HEADING_HIERARCHY',
    title: 'Heading structure is flat or missing H2 tags',
    detail: 'A clear H1 → H2 → H3 hierarchy helps search engines understand your content structure and improves readability for users.',
    fix: 'Add H2 subheadings to break your content into logical sections. Use H3 for subsections within each H2.',
    effort: 'Medium',
  })

  if (!seoData.hasLangAttribute) issues.push({
    severity: 'Medium',
    impact: 'Low',
    pillar: 'Technical',
    code: 'NO_LANG',
    title: 'HTML language attribute is missing',
    detail: 'The lang attribute on the <html> tag tells browsers and search engines what language the page is in. Required for accessibility and correct rendering.',
    fix: 'Add lang="en" (or your page language code) to the <html> tag.',
    effort: 'Quick Win',
  })

  if (!seoData.hasFavicon) issues.push({
    severity: 'Medium',
    impact: 'Low',
    pillar: 'Technical',
    code: 'NO_FAVICON',
    title: 'No favicon detected',
    detail: 'A favicon appears in browser tabs, bookmarks, and search results. Its absence signals an incomplete or unprofessional website.',
    fix: 'Create a favicon.ico and add <link rel="icon" href="/favicon.ico"> to your <head>.',
    effort: 'Quick Win',
  })

  if (!seoData.hasTwitterCard) issues.push({
    severity: 'Medium',
    impact: 'Low',
    pillar: 'Technical',
    code: 'NO_TWITTER_CARD',
    title: 'Twitter/X Card meta tags missing',
    detail: 'Without Twitter Card tags, links shared on Twitter/X show as plain text with no image or preview — dramatically reducing engagement.',
    fix: 'Add <meta name="twitter:card">, <meta name="twitter:title">, and <meta name="twitter:image"> to your <head>.',
    effort: 'Quick Win',
  })

  if (!seoData.keywordInTitle && seoData.primaryKeyword) issues.push({
    severity: 'Medium',
    impact: 'Medium',
    pillar: 'SEO',
    code: 'KEYWORD_NOT_IN_TITLE',
    title: `Primary keyword "${seoData.primaryKeyword}" not found in title`,
    detail: 'Including your primary keyword in the title tag is one of the strongest on-page ranking signals.',
    fix: `Rewrite your title to naturally include "${seoData.primaryKeyword}".`,
    effort: 'Quick Win',
  })

  if (!seoData.keywordInMeta && seoData.primaryKeyword) issues.push({
    severity: 'Medium',
    impact: 'Low',
    pillar: 'SEO',
    code: 'KEYWORD_NOT_IN_META',
    title: `Primary keyword "${seoData.primaryKeyword}" not found in meta description`,
    detail: 'Including your keyword in the meta description reinforces relevance and Google bolds matching terms in search results.',
    fix: `Include "${seoData.primaryKeyword}" naturally in your meta description.`,
    effort: 'Quick Win',
  })

  if (seoData.internalLinks < 3) issues.push({
    severity: 'Medium',
    impact: 'Medium',
    pillar: 'SEO',
    code: 'FEW_INTERNAL_LINKS',
    title: `Only ${seoData.internalLinks} internal link${seoData.internalLinks !== 1 ? 's' : ''} detected`,
    detail: 'Internal links distribute page authority across your site and help search engines discover and index your content.',
    fix: 'Add links to at least 3-5 relevant internal pages from your homepage. Use descriptive anchor text.',
    effort: 'Medium',
  })

  // ── LOW ────────────────────────────────────────────────────
  if (!seoData.hasRobotsMeta) issues.push({
    severity: 'Low',
    impact: 'Low',
    pillar: 'Technical',
    code: 'NO_ROBOTS_META',
    title: 'No robots meta tag',
    detail: 'While not strictly required, a robots meta tag gives you fine-grained control over indexing and link following behavior.',
    fix: 'Add <meta name="robots" content="index, follow"> to your <head> unless you need to restrict crawling.',
    effort: 'Quick Win',
  })

  if (techData.inlineScripts > 5) issues.push({
    severity: 'Low',
    impact: 'Medium',
    pillar: 'Technical',
    code: 'INLINE_SCRIPTS',
    title: `${techData.inlineScripts} inline scripts detected`,
    detail: 'Inline scripts block rendering and cannot be cached. Too many hurt performance scores and Core Web Vitals.',
    fix: 'Move inline JavaScript to external .js files. Use event listeners instead of onclick attributes.',
    effort: 'Medium',
  })

  if (techData.inlineStyles > 3) issues.push({
    severity: 'Low',
    impact: 'Medium',
    pillar: 'Technical',
    code: 'INLINE_STYLES',
    title: `${techData.inlineStyles} inline stylesheets detected`,
    detail: 'Inline styles block rendering and cannot be cached. They also make maintenance harder and increase page weight.',
    fix: 'Move inline CSS to external .css files and use classes instead of style attributes.',
    effort: 'Medium',
  })

  if (seoData.schemaTypes.length === 0) issues.push({
    severity: 'Low',
    impact: 'Low',
    pillar: 'SEO',
    code: 'NO_SCHEMA_TYPES',
    title: 'No Schema.org types detected',
    detail: 'Specifying Schema.org types helps search engines understand your content context and may unlock rich results.',
    fix: 'Add "@type" properties to your JSON-LD structured data (e.g., Organization, Article, Product).',
    effort: 'Medium',
  })

  if (!contentData.hasPhoneNumber && !contentData.hasEmail) issues.push({
    severity: 'Low',
    impact: 'Low',
    pillar: 'Content',
    code: 'NO_CONTACT_INFO',
    title: 'No contact information detected',
    detail: 'Including contact information builds trust and qualifies leads. B2B sites especially benefit from clear contact details.',
    fix: 'Add a phone number or email address in a prominent location (header, footer, or contact section).',
    effort: 'Quick Win',
  })

  if (!contentData.hasSocialProof) issues.push({
    severity: 'Low',
    impact: 'Low',
    pillar: 'Content',
    code: 'NO_SOCIAL_PROOF',
    title: 'No social proof detected',
    detail: 'Trust signals like testimonials, reviews, and client logos increase conversion rates by up to 20%.',
    fix: 'Add customer testimonials, trust badges, or client logos to key pages.',
    effort: 'Medium',
  })

  if (techData.scriptCount > 20) issues.push({
    severity: 'Low',
    impact: 'Medium',
    pillar: 'Technical',
    code: 'TOO_MANY_SCRIPTS',
    title: `Too many scripts (${techData.scriptCount}) detected`,
    detail: 'Each script adds HTTP request overhead and increases page weight. Too many can significantly slow down your site.',
    fix: 'Minimize third-party scripts. Combine and minify JavaScript files. Defer non-critical scripts.',
    effort: 'Medium',
  })

  // Keyword over-optimization warning
  if (seoData.topKeywords && seoData.topKeywords.length > 0) {
    const overOptimized = seoData.topKeywords.filter(k => k.density > 3)
    if (overOptimized.length > 0) {
      issues.push({
        severity: 'Medium',
        impact: 'Medium',
        pillar: 'SEO',
        code: 'KEYWORD_STUFFING',
        title: `Keyword over-optimization detected: "${overOptimized[0].word}" at ${overOptimized[0].density}%`,
        detail: 'Keyword density above 3% is considered stuffing by Google and can trigger a penalty. Modern SEO favors natural language over repeated keywords.',
        fix: 'Reduce keyword repetition. Aim for 1-2% density. Use synonyms and related terms instead.',
        effort: 'Medium',
      })
    }
  }

  return issues
}

// ─── STEP 6: Route Handler ─────────────────────────────────────────────────
router.post('/audit', async (req, res) => {
  const { url, instagram = '', facebook = '' } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const html = await fetchPage(url);

    const [seoData, techData, contentData] = await Promise.all([
      Promise.resolve(auditSEO(html, url)),
      Promise.resolve(auditTechnical(html, url)),
      Promise.resolve(auditContent(html)),
    ]);

    const socialData = auditSocial(instagram, facebook, html);

    const seoScore = scoreSEO(seoData);
    const technicalScore = scoreTechnical(techData);
    const contentScore = scoreContent(contentData);
    const socialScore = scoreSocial(socialData);

    const result = {
      url,
      timestamp: new Date().toISOString(),
      seo: { ...seoData, score: seoScore },
      technical: { ...techData, score: technicalScore },
      content: { ...contentData, score: contentScore },
      social: { ...socialData, score: socialScore },
    };
    result.overallScore = Math.round(
      seoScore * 0.4 +
      technicalScore * 0.3 +
      contentScore * 0.2 +
      socialScore * 0.1
    );

    const [recommendations, pageSpeed, crawlData] = await Promise.all([
      generateRecommendations(result),
      getPageSpeedData(url),
      crawlSite(url, html),
    ]);
    const issues = triageIssues(seoData, techData, contentData, socialData);
    result.recommendations = recommendations;
    result.issues = issues;
    result.pageSpeed = pageSpeed;
    result.crawl = crawlData;

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;