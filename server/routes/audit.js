const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { generateRecommendations } = require('../services/aiRecommender');

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
function auditSocial(instagram, facebook) {
  const instagramProvided = typeof instagram === 'string' && instagram.trim().length > 0;
  const instagramHandleValid = instagramProvided
    ? /^@?[a-zA-Z0-9_.]{1,30}$/.test(instagram.trim())
    : false;

  const facebookProvided = typeof facebook === 'string' && facebook.trim().length > 0;
  const facebookURLValid = facebookProvided
    ? /^https?:\/\/(www\.)?facebook\.com\/.+/.test(facebook.trim())
    : false;

  const bothProvided = instagramProvided && facebookProvided;

  return {
    instagramProvided,
    instagramHandleValid,
    facebookProvided,
    facebookURLValid,
    bothProvided,
  };
}

// ─── Score Social ─────────────────────────────────────────────────
function scoreSocial(socialData) {
  let score = 0;

  // Instagram (40 pts)
  if (socialData.instagramProvided) score += 20;
  if (socialData.instagramHandleValid) score += 20;

  // Facebook (40 pts)
  if (socialData.facebookProvided) score += 20;
  if (socialData.facebookURLValid) score += 20;

  // Both provided bonus (20 pts)
  if (socialData.bothProvided) score += 20;

  return Math.min(score, 100);
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

    const socialData = auditSocial(instagram, facebook);

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

    const recommendations = await generateRecommendations(result);
    result.recommendations = recommendations;

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;