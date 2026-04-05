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
function auditSEO(html) {
  const $ = cheerio.load(html);

  const titleText = $('title').first().text().trim();
  const hasTitle = titleText.length > 0;
  const titleLength = titleText.length;

  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const hasMetaDescription = metaDesc.trim().length > 0;
  const metaDescriptionLength = metaDesc.trim().length;

  const h1Tags = $('h1');
  const hasH1 = h1Tags.length > 0;
  const h1Count = h1Tags.length;

  let imagesMissingAlt = 0;
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt.trim() === '') {
      imagesMissingAlt++;
    }
  });

  const hasCanonical = $('link[rel="canonical"]').length > 0;
  const hasRobotsMeta = $('meta[name="robots"]').length > 0;

  return {
    hasTitle,
    titleLength,
    hasMetaDescription,
    metaDescriptionLength,
    hasH1,
    h1Count,
    imagesMissingAlt,
    hasCanonical,
    hasRobotsMeta,
  };
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

// ─── STEP 4: Score SEO ─────────────────────────────────────────────────────
function scoreSEO(seoData) {
  let score = 0;
  if (seoData.hasTitle && seoData.titleLength >= 30 && seoData.titleLength <= 60) score += 20;
  if (seoData.hasMetaDescription && seoData.metaDescriptionLength >= 120 && seoData.metaDescriptionLength <= 160) score += 20;
  if (seoData.hasH1 && seoData.h1Count === 1) score += 20;
  if (seoData.imagesMissingAlt === 0) score += 20;
  if (seoData.hasCanonical) score += 10;
  if (seoData.hasRobotsMeta) score += 10;
  return score;
}

// ─── STEP 5: Score Technical ───────────────────────────────────────────────
function scoreTechnical(techData) {
  let score = 0;
  if (techData.isHTTPS) score += 30;
  if (techData.hasViewportMeta) score += 20;
  if (techData.hasOpenGraph) score += 20;
  if (techData.hasStructuredData) score += 20;
  if (techData.scriptCount < 10) score += 10;
  return score;
}

// ─── STEP 7: Content Audit ─────────────────────────────────────────────────
function auditContent(html) {
  const $ = cheerio.load(html);

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const words = bodyText.split(' ').filter((w) => w.length > 0);
  const wordCount = words.length;

  const ctaKeywords = ['buy', 'order', 'subscribe', 'sign up', 'get started', 'contact', 'book', 'demo', 'try', 'download'];
  const bodyLower = bodyText.toLowerCase();
  const hasCTA = ctaKeywords.some((kw) => bodyLower.includes(kw));

  const paragraphCount = $('p').length;
  const avgWordsPerParagraph = paragraphCount > 0
    ? Math.round((wordCount / paragraphCount) * 10) / 10
    : 0;

  const hasPhoneNumber = /(\+?\d[\d\s\-().]{7,}\d)/.test(bodyText);
  const hasEmail = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(bodyText);

  return {
    wordCount,
    hasCTA,
    paragraphCount,
    avgWordsPerParagraph,
    hasPhoneNumber,
    hasEmail,
  };
}

// ─── STEP 8: Score Content ─────────────────────────────────────────────────
function scoreContent(contentData) {
  let score = 0;
  if (contentData.wordCount >= 300) score += 25;
  if (contentData.hasCTA) score += 25;
  if (contentData.paragraphCount >= 3) score += 20;
  if (contentData.hasPhoneNumber || contentData.hasEmail) score += 15;
  if (contentData.avgWordsPerParagraph >= 20 && contentData.avgWordsPerParagraph <= 100) score += 15;
  return score;
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

// ─── STEP 10: Score Social ─────────────────────────────────────────────────
function scoreSocial(socialData) {
  let score = 0;
  if (socialData.instagramProvided && socialData.instagramHandleValid) score += 30;
  if (socialData.facebookProvided && socialData.facebookURLValid) score += 30;
  if (socialData.bothProvided) score += 40;
  return score;
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
      Promise.resolve(auditSEO(html)),
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