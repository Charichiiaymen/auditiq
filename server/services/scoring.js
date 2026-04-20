// ─── TF-IDF Scoring Engine for AuditIQ ─────────────────────────────────────
// Implements TF-IDF (Term Frequency - Inverse Document Frequency) for keyword
// importance scoring. Technical noise (appearing on every page) is penalized.

/**
 * TF-IDF Calculator
 * Formula: W(i,j) = tf(i,j) × log((N + 1) / (df(i) + 1))
 * Where:
 * - tf(i,j) = frequency of term i in document j
 * - df(i) = number of documents containing term i
 * - N = total number of documents
 *
 * Note: Uses smoothed IDF with +1 to avoid division by zero.
 * Words appearing in all documents get negative IDF (penalized).
 */
const TF_IDF = {
  /**
   * Calculate term frequency (TF) in a document
   * @param {string} term - Term to calculate frequency for
   * @param {Array<string>} docWords - Array of words in the document
   * @returns {number} - Term frequency (0 to 1)
   */
  calcTF: (term, docWords) => {
    if (!term || !docWords || !Array.isArray(docWords) || docWords.length === 0) {
      return 0;
    }
    const termCount = docWords.filter(w => w === term).length;
    return termCount / docWords.length;
  },

  /**
   * Calculate document frequency (DF) - how many docs contain this term
   * @param {string} term - Term to check
   * @param {Array<{words: Array<string>}>} allDocs - Array of documents
   * @returns {number} - Document frequency
   */
  calcDF: (term, allDocs) => {
    if (!term || !allDocs || !Array.isArray(allDocs)) return 0;
    let count = 0;
    for (const doc of allDocs) {
      if (doc.words && doc.words.includes(term)) {
        count++;
      }
    }
    return count;
  },

  /**
   * Calculate inverse document frequency (IDF)
   * log(N / (df + 1)) - +1 to avoid division by zero
   * @param {string} term - Term to check
   * @param {Array<{words: Array<string>}>} allDocs - Array of documents
   * @returns {number} - Inverse document frequency
   */
  calcIDF: (term, allDocs) => {
    const df = TF_IDF.calcDF(term, allDocs);
    const N = allDocs.length || 1;
    // +1 to avoid division by zero, +1 to DF to smooth
    return Math.log(N / (df + 1));
  },

  /**
   * Calculate TF-IDF weight for a term
   * @param {string} term - Term to score
   * @param {Array<string>} docWords - Words in current document
   * @param {Array<{words: Array<string>}>} allDocs - Corpus of all documents
   * @returns {number} - TF-IDF weight
   */
  calcTFIDF: (term, docWords, allDocs) => {
    if (!term) return 0;
    const tf = TF_IDF.calcTF(term, docWords);
    const idf = TF_IDF.calcIDF(term, allDocs);
    return tf * idf;
  },

  /**
   * Calculate all TF-IDF scores for terms in a document
   * @param {Array<string>} docWords - Words in current document
   * @param {Array<{words: Array<string>}>} allDocs - Corpus of all documents
   * @returns {Object} - Map of term -> TF-IDF score
   */
  calcAllTFIDF: (docWords, allDocs) => {
    const scores = {};
    const uniqueTerms = new Set(docWords);
    for (const term of uniqueTerms) {
      scores[term] = TF_IDF.calcTFIDF(term, docWords, allDocs);
    }
    return scores;
  },
};

/**
 * DOM Position Weighting
 * Words appearing in more prominent positions get higher weights
 */
const DOM_WEIGHT = {
  title: 10,      // Title tag - highest importance
  h1: 5,          // H1 heading - very high importance
  h2: 3,          // H2 heading - high importance
  h3: 3,          // H3 heading - medium-high importance
  h4: 2,          // H4 heading - medium importance
  h5: 1,          // H5 heading - low importance
  h6: 1,          // H6 heading - lowest heading importance
  first100words: 4, // First 100 words - high importance
  metaDescription: 3, // Meta description - high importance
  altText: 2,     // Image alt text - medium importance
  boldText: 1.5,  // Bold text - slightly emphasized
  body: 1,        // Body text - baseline importance
};

/**
 * Calculate weighted score by applying DOM position bonus
 * @param {number} baseScore - Base TF-IDF score
 * @param {string} domPosition - DOM position key from DOM_WEIGHT
 * @returns {number} - Weighted score
 */
function calculateWeightedScore(baseScore, domPosition) {
  const weight = DOM_WEIGHT[domPosition] || DOM_WEIGHT.body;
  return baseScore * weight;
}

/**
 * Normalize all scores to 0-100 range
 * @param {Object<string, number>} wordWeights - Map of term -> score
 * @returns {Object<string, number>} - Map of term -> normalized score (0-100)
 */
function normalizeScores(wordWeights) {
  if (!wordWeights || Object.keys(wordWeights).length === 0) return {};

  // Find max score
  const maxScore = Math.max(...Object.values(wordWeights));
  if (maxScore <= 0) return wordWeights;

  // Normalize to 0-100
  const normalized = {};
  for (const [term, score] of Object.entries(wordWeights)) {
    normalized[term] = Math.min(100, Math.round((score / maxScore) * 100));
  }

  return normalized;
}

/**
 * Calculate weighted frequency (fallback when no corpus available)
 * For single-page audits without a corpus, use DOM-weighted frequency
 * @param {string} term - Term to calculate weight for
 * @param {number} rawCount - Raw occurrence count
 * @param {string} domPosition - DOM position for bonus
 * @returns {number} - Weighted score
 */
function calculateWeightedFrequency(term, rawCount, domPosition) {
  const weight = DOM_WEIGHT[domPosition] || DOM_WEIGHT.body;
  return rawCount * weight;
}

// ─── Export ───────────────────────────────────────────────────────────────
module.exports = {
  TF_IDF,
  DOM_WEIGHT,
  calculateWeightedScore,
  normalizeScores,
  calculateWeightedFrequency,
};
