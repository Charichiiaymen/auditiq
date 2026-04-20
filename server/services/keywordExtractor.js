const { eng } = require('stopword')
const { detectLanguage, stemWord, getStopwords } = require('./multilingual')
const { TF_IDF, DOM_WEIGHT, calculateWeightedScore, normalizeScores } = require('./scoring')
const { extractCleanContent } = require('./cleanRoom')

// Merge stopword package with SEO noise (multilingual module handles SEO_NOISE)
const STOPWORDS = new Set([...eng])

// ─── Weight Map ────────────────────────────────────────────────────────────
const WEIGHT_MAP = {
  title: 10,
  h1: 5,
  h2: 3,
  h3: 3,
  h4: 2,
  h5: 1,
  h6: 1,
  body: 1,
}

// ─── Tokenizer ────────────────────────────────────────────────────────────
function tokenize(text) {
  return text.toLowerCase()
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length >= 3 && !/\d/.test(w))
}

function isStopword(word, stopwords) {
  return stopwords.has(word.toLowerCase())
}

// ─── Extract Keywords with TF-IDF + Multilingual + DOM Weighting ───────────
/**
 * Extract keywords with TF-IDF scoring, language detection, and DOM weighting
 * @param {Object} $ - Cheerio instance
 * @param {string} html - Full HTML content
 * @param {Array<{words: Array<string>}>} allDocs - Corpus of all documents for TF-IDF
 * @returns {Array} - Top keywords with TF-IDF scores and weights
 */
async function extractKeywords($, html, allDocs = []) {
  const lang = detectLanguage(html)
  const stopwords = getStopwords(lang) || STOPWORDS

  const wordWeight = {}
  const stemToSurface = {} // maps stem → most common surface form
  const stemCount = {}     // tracks frequency of each stem to find most common surface
  let totalWeightedCount = 0

  // Track title/H1 appearance for bonus
  const titleStems = new Set()
  const h1Stems = new Set()

  // ── Title (10x) ──
  const titleText = $('title').first().text().trim()
  if (titleText) {
    const tokens = tokenize(titleText).filter(w => !isStopword(w, stopwords))
    tokens.forEach(w => {
      const s = stemWord(w, lang)
      const weight = calculateWeightedScore(1, 'title')
      wordWeight[s] = (wordWeight[s] || 0) + weight
      totalWeightedCount += weight
      titleStems.add(s)
      stemCount[s] = (stemCount[s] || 0) + 1
      if (!stemToSurface[s] || w.length > stemToSurface[s].length) {
        stemToSurface[s] = w
      }
    })
  }

  // ── H1 (5x) ──
  $('h1').each((_, el) => {
    const text = $(el).text().trim()
    const tokens = tokenize(text).filter(w => !isStopword(w, stopwords))
    tokens.forEach(w => {
      const s = stemWord(w, lang)
      const weight = calculateWeightedScore(1, 'h1')
      wordWeight[s] = (wordWeight[s] || 0) + weight
      totalWeightedCount += weight
      h1Stems.add(s)
      stemCount[s] = (stemCount[s] || 0) + 1
      if (!stemToSurface[s] || w.length > stemToSurface[s].length) {
        stemToSurface[s] = w
      }
    })
  })

  // ── H2-H3 (3x) ──
  ;['h2', 'h3'].forEach(tag => {
    $(tag).each((_, el) => {
      const text = $(el).text().trim()
      const tokens = tokenize(text).filter(w => !isStopword(w, stopwords))
      tokens.forEach(w => {
        const s = stemWord(w, lang)
        const weight = calculateWeightedScore(1, tag)
        wordWeight[s] = (wordWeight[s] || 0) + weight
        totalWeightedCount += weight
        stemCount[s] = (stemCount[s] || 0) + 1
        if (!stemToSurface[s] || w.length > stemToSurface[s].length) {
          stemToSurface[s] = w
        }
      })
    })
  })

  // ── Body content (1x) — use cleanRoom extraction to strip JSON-LD, nav, footer, etc.
  const bodyText = extractCleanContent(html)
  const bodyTokens = tokenize(bodyText).filter(w => !isStopword(w, stopwords))
  bodyTokens.forEach(w => {
    const s = stemWord(w, lang)
    const weight = calculateWeightedScore(1, 'body')
    wordWeight[s] = (wordWeight[s] || 0) + weight
    totalWeightedCount += weight
    stemCount[s] = (stemCount[s] || 0) + 1
    if (!stemToSurface[s] || w.length > stemToSurface[s].length) {
      stemToSurface[s] = w
    }
  })

  // ── Title/H1 appearance bonus ──
  for (const s of titleStems) {
    if (wordWeight[s]) wordWeight[s] += 1
  }
  for (const s of h1Stems) {
    if (wordWeight[s]) wordWeight[s] += 0.5
  }

  // ── Calculate TF-IDF scores for all terms ──
  // Build word array from body tokens for TF-IDF calculation
  const docWords = bodyTokens.map(w => stemWord(w, lang))
  const allWords = [...docWords, ...titleStems, ...h1Stems]

  const termWeights = {}
  const uniqueTerms = new Set(allWords)

  for (const term of uniqueTerms) {
    // Get base TF-IDF score
    const tfidf = TF_IDF.calcTFIDF(term, docWords, allDocs)

    // Apply DOM position weight (title words get title bonus, etc.)
    let weightedScore = tfidf

    // Apply title bonus for title stems
    if (titleStems.has(term)) {
      weightedScore = calculateWeightedScore(tfidf, 'title')
    }
    // Apply H1 bonus for H1 stems
    else if (h1Stems.has(term)) {
      weightedScore = calculateWeightedScore(tfidf, 'h1')
    }

    termWeights[term] = weightedScore
  }

  // ── Sort by weighted score (TF-IDF + DOM) ──
  const sortedStems = Object.entries(termWeights).sort((a, b) => b[1] - a[1])

  // ── N-gram detection from top unigrams ──
  const topUnigrams = sortedStems.slice(0, 20).map(([s]) => s)
  const ngrams = []
  const filteredBodyTokens = bodyTokens.filter(w => {
    const s = stemWord(w, lang)
    return !isStopword(w, stopwords) && topUnigrams.includes(s)
  })

  for (let i = 0; i < filteredBodyTokens.length - 1; i++) {
    const bigram = `${filteredBodyTokens[i]} ${filteredBodyTokens[i + 1]}`
    ngrams.push(bigram)
    if (i < filteredBodyTokens.length - 2) {
      const trigram = `${filteredBodyTokens[i]} ${filteredBodyTokens[i + 1]} ${filteredBodyTokens[i + 2]}`
      ngrams.push(trigram)
    }
  }

  const ngramFreq = {}
  ngrams.forEach(ng => { ngramFreq[ng] = (ngramFreq[ng] || 0) + 1 })
  const sortedNgrams = Object.entries(ngramFreq).sort((a, b) => b[1] - a[1])

  // ── Variable n-gram boosting ──
  const combined = [
    ...sortedStems.slice(0, 10).map(([s, weight]) => ({
      word: stemToSurface[s] || s,
      weight,
      isNgram: false,
    })),
    ...sortedNgrams.slice(0, 5).map(([phrase, count]) => {
      const boost = count >= 3 ? 3.5 : count >= 2 ? 2.5 : 2
      return { word: phrase, weight: count * boost, isNgram: true }
    }),
  ].sort((a, b) => b.weight - a.weight)

  // ── Normalize scores to 0-100 ──
  const topKeywords = combined.slice(0, 5).map(({ word, weight }) => {
    // Calculate density based on weighted count
    const density = totalWeightedCount > 0
      ? parseFloat(((weight / totalWeightedCount) * 100).toFixed(2))
      : 0

    // Get TF-IDF score (normalized 0-100)
    const normalizedWeights = normalizeScores({ [word]: termWeights[word] || 0 })
    const tfidfScore = normalizedWeights[word] || 0

    return {
      word,
      count: weight,
      density,
      tfidfScore,
    }
  })

  return topKeywords
}

// ─── Backward compatible extractKeywords (synchronous, no TF-IDF) ─────────
/**
 * Backward compatible version without TF-IDF for synchronous use
 * @param {Object} $ - Cheerio instance
 * @param {string} html - Full HTML content
 * @returns {Array} - Top keywords without TF-IDF scores
 */
function extractKeywordsSync($, html) {
  const lang = detectLanguage(html)
  const stopwords = getStopwords(lang) || STOPWORDS

  const wordWeight = {}
  const stemToSurface = {}
  const stemCount = {}
  let totalWeightedCount = 0

  const titleStems = new Set()
  const h1Stems = new Set()

  // ── Title (10x) ──
  const titleText = $('title').first().text().trim()
  if (titleText) {
    const tokens = tokenize(titleText).filter(w => !isStopword(w, stopwords))
    tokens.forEach(w => {
      const s = stemWord(w, lang)
      wordWeight[s] = (wordWeight[s] || 0) + WEIGHT_MAP.title
      totalWeightedCount += WEIGHT_MAP.title
      titleStems.add(s)
      stemCount[s] = (stemCount[s] || 0) + 1
      if (!stemToSurface[s] || w.length > stemToSurface[s].length) {
        stemToSurface[s] = w
      }
    })
  }

  // ── H1 (5x) ──
  $('h1').each((_, el) => {
    const text = $(el).text().trim()
    const tokens = tokenize(text).filter(w => !isStopword(w, stopwords))
    tokens.forEach(w => {
      const s = stemWord(w, lang)
      wordWeight[s] = (wordWeight[s] || 0) + WEIGHT_MAP.h1
      totalWeightedCount += WEIGHT_MAP.h1
      h1Stems.add(s)
      stemCount[s] = (stemCount[s] || 0) + 1
      if (!stemToSurface[s] || w.length > stemToSurface[s].length) {
        stemToSurface[s] = w
      }
    })
  })

  // ── H2-H3 (3x) ──
  ;['h2', 'h3'].forEach(tag => {
    $(tag).each((_, el) => {
      const text = $(el).text().trim()
      const tokens = tokenize(text).filter(w => !isStopword(w, stopwords))
      tokens.forEach(w => {
        const s = stemWord(w, lang)
        wordWeight[s] = (wordWeight[s] || 0) + WEIGHT_MAP[tag]
        totalWeightedCount += WEIGHT_MAP[tag]
        stemCount[s] = (stemCount[s] || 0) + 1
        if (!stemToSurface[s] || w.length > stemToSurface[s].length) {
          stemToSurface[s] = w
        }
      })
    })
  })

  // ── Body content (1x) — use cleanRoom extraction to strip JSON-LD, nav, footer, etc.
  const bodyText = extractCleanContent(html)
  const bodyTokens = tokenize(bodyText).filter(w => !isStopword(w, stopwords))
  bodyTokens.forEach(w => {
    const s = stemWord(w, lang)
    wordWeight[s] = (wordWeight[s] || 0) + WEIGHT_MAP.body
    totalWeightedCount += WEIGHT_MAP.body
    stemCount[s] = (stemCount[s] || 0) + 1
    if (!stemToSurface[s] || w.length > stemToSurface[s].length) {
      stemToSurface[s] = w
    }
  })

  // ── Title/H1 bonus ──
  for (const s of titleStems) {
    if (wordWeight[s]) wordWeight[s] += 1
  }
  for (const s of h1Stems) {
    if (wordWeight[s]) wordWeight[s] += 0.5
  }

  // ── Sort by weighted frequency ──
  const sortedStems = Object.entries(wordWeight).sort((a, b) => b[1] - a[1])

  // ── Return top 5 ──
  const topKeywords = sortedStems.slice(0, 5).map(([s, weight]) => ({
    word: stemToSurface[s] || s,
    count: weight,
    density: parseFloat(((weight / totalWeightedCount) * 100).toFixed(2)),
    tfidfScore: 0, // No TF-IDF in sync mode
  }))

  return topKeywords
}

module.exports = { extractKeywords, extractKeywordsSync }
