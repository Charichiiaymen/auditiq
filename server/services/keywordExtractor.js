const { eng } = require('stopword')

// ─── Domain-specific SEO noise words ──────────────────────────────────────
const SEO_NOISE = new Set([
  'without', 'within', 'upon', 'among', 'throughout', 'therefore',
  'however', 'whether', 'although', 'unless', 'towards', 'besides',
  'onto', 'per', 'via', 'vs', 'else', 'enough', 'rather', 'since',
  'though', 'yet', 'already', 'always', 'never', 'often', 'sometimes',
  'use', 'used', 'using', 'also', 'well', 'may', 'like', 'get', 'got',
  'way', 'ways', 'make', 'makes', 'made', 'let', 'new', 'one', 'two',
  'need', 'needs', 'want', 'set', 'see', 'look', 'go', 'going', 'come',
  'know', 'take', 'many', 'much', 'say', 'said', 'find', 'found', 'give',
  'back', 'still', 'click', 'here', 'more', 'home', 'menu', 'nav', 'footer',
  'copyright', 'privacy', 'terms', 'policy', 'all', 'rights', 'reserved',
  'follow', 'subscribe', 'newsletter', 'contact', 'about', 'services',
])

// Merge stopword package with SEO noise
const STOPWORDS = new Set([...eng, ...SEO_NOISE])

// ─── Lightweight Stemmer ──────────────────────────────────────────────────
// Suffix-stripping rules (longest-first) with minimum stem length of 3
const SUFFIX_RULES = [
  [/ization$/, ''],
  [/ational$/, ''],
  [/fulness$/, ''],
  [/ness$/, ''],
  [/able$/, ''],
  [/ible$/, ''],
  [/ment$/, ''],
  [/ing$/, ''],
  [/ed$/, ''],
  [/er$/, ''],
  [/ly$/, ''],
  [/s$/, ''],
]

function stem(word) {
  for (const [suffix, replacement] of SUFFIX_RULES) {
    if (suffix.test(word)) {
      const stemmed = word.replace(suffix, replacement)
      if (stemmed.length >= 3) return stemmed
    }
  }
  return word
}

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

function isStopword(word) {
  return STOPWORDS.has(word.toLowerCase())
}

// ─── Extract Keywords with Stemming + Variable N-gram Boost ──────────────
function extractKeywords($, html) {
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
    const tokens = tokenize(titleText).filter(w => !isStopword(w))
    tokens.forEach(w => {
      const s = stem(w)
      wordWeight[s] = (wordWeight[s] || 0) + WEIGHT_MAP.title
      totalWeightedCount += WEIGHT_MAP.title
      titleStems.add(s)
      // Track surface form
      stemCount[s] = (stemCount[s] || 0) + 1
      if (!stemToSurface[s] || w.length > stemToSurface[s].length) {
        stemToSurface[s] = w
      }
    })
  }

  // ── H1 (5x) ──
  $('h1').each((_, el) => {
    const text = $(el).text().trim()
    const tokens = tokenize(text).filter(w => !isStopword(w))
    tokens.forEach(w => {
      const s = stem(w)
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
      const tokens = tokenize(text).filter(w => !isStopword(w))
      tokens.forEach(w => {
        const s = stem(w)
        wordWeight[s] = (wordWeight[s] || 0) + WEIGHT_MAP[tag]
        totalWeightedCount += WEIGHT_MAP[tag]
        stemCount[s] = (stemCount[s] || 0) + 1
        if (!stemToSurface[s] || w.length > stemToSurface[s].length) {
          stemToSurface[s] = w
        }
      })
    })
  })

  // ── Body content (1x) — strip nav/footer/aside/header ──
  const bodyClone = $('body').clone()
  bodyClone.find('nav, footer, aside, header').remove()
  const bodyText = bodyClone.text()
  const bodyTokens = tokenize(bodyText).filter(w => !isStopword(w))
  bodyTokens.forEach(w => {
    const s = stem(w)
    wordWeight[s] = (wordWeight[s] || 0) + WEIGHT_MAP.body
    totalWeightedCount += WEIGHT_MAP.body
    stemCount[s] = (stemCount[s] || 0) + 1
    // Prefer longer surface form (e.g. "marketing" over "market")
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

  // ── Sort by weighted frequency ──
  const sortedStems = Object.entries(wordWeight).sort((a, b) => b[1] - a[1])

  // ── N-gram detection from top unigrams ──
  const topUnigrams = sortedStems.slice(0, 20).map(([s]) => s)
  const ngrams = []
  const filteredBodyTokens = bodyTokens.filter(w => {
    const s = stem(w)
    return !isStopword(w) && topUnigrams.includes(s)
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

  // ── Return top 5 with density calculation ──
  const topKeywords = combined.slice(0, 5).map(({ word, weight }) => ({
    word,
    count: weight,
    density: parseFloat(((weight / totalWeightedCount) * 100).toFixed(2)),
  }))

  return topKeywords
}

module.exports = { extractKeywords }