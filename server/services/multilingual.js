// ─── Multilingual Text Processing with natural Library ─────────────────────
// Uses natural library for stemming instead of custom regex implementations

const natural = require('natural');
const snowballStemmers = require('snowball-stemmers');
const { eng, fra, ara } = require('stopword');

// ─── Natural Library Stemmers ──────────────────────────────────────────────
// PorterStemmer for English (industry standard)
// Note: In natural 8.x, stemmers are static objects with .stem() method
const EN_STEMMER = natural.PorterStemmer;

// PorterStemmerFr for French (natural 8.x does not have SnowballStemmer)
// Using PorterStemmerFr which is the French-specific stemmer in natural 8.x
const FR_STEMMER = natural.PorterStemmerFr;

// Arabic stemmer from snowball-stemmers package (natural 8.x has no Arabic stemmer)
const AR_STEMMER = snowballStemmers.newStemmer('arabic');

// ─── SEO Noise Words (common words to filter) ──────────────────────────────
const SEO_NOISE = [
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
];

// ─── English Stopwords ────────────────────────────────────────────────────
const EN_STOPWORDS = new Set([
  ...eng,
  ...SEO_NOISE,
  // Additional SEO noise
  'just', 'only', 'even', 'back', 'good', 'great', 'best', 'better',
  'big', 'small', 'way', 'ways', 'part', 'parts', 'make', 'makes',
  'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must',
  'shall', 'ought', 'need', 'dare', 'ought to', 'would rather',
]);

// ─── French Stopwords ─────────────────────────────────────────────────────
const FR_STOPWORDS = new Set([
  ...fra,
  ...SEO_NOISE,
  // Additional French stopwords not in stopword.fra
  'elles', 'etre', 'être', 'bonjour', 'merci', 'si', 'tres', 'très',
  'beaucoup', 'peu', 'autre', 'aussi', 'encore', 'deja', 'déjà',
  'sans', 'alors', 'donc', 'ni', 'or', 'puis', 'mais', 'ou', 'où',
]);

// ─── Arabic Stopwords ─────────────────────────────────────────────────────
const AR_STOPWORDS = new Set([
  ...ara,
  ...SEO_NOISE,
  // Additional Arabic stopwords not in stopword.ara
  'لماذا',
]);

// ─── Stemming Function ────────────────────────────────────────────────────
/**
 * Stem a word using language-specific stemmer from natural library
 * @param {string} word - Word to stem
 * @param {string} lang - Language code: 'en', 'fr', or 'ar'
 * @returns {string} - Stemmed word
 */
function stemWord(word, lang = 'en') {
  if (!word || word.length < 3) return word;

  let stem;
  switch (lang) {
    case 'fr':
      // natural 8.x PorterStemmerFr is a static object
      stem = FR_STEMMER.stem(word);
      break;
    case 'ar':
      // snowball-stemmers Arabic stemmer is an instance with .stem() method
      stem = AR_STEMMER.stem(word);
      break;
    case 'en':
    default:
      // natural 8.x PorterStemmer is a static object
      stem = EN_STEMMER.stem(word);
      break;
  }

  // Return stemmed word or original if stem is too short
  return stem && stem.length >= 3 ? stem : word;
}

// ─── Language Detection ───────────────────────────────────────────────────
/**
 * Detect language from text using regex heuristics
 * @param {string} text - Text to analyze
 * @returns {string} - Language code: 'en', 'fr', or 'ar'
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'en';

  // Check for Arabic (Arabic Unicode block)
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ar';
  }

  // Check for French (common French words) - require 2+ French words to trigger
  const frenchWords = /\b(le|la|les|de|et|une|est|qui|que|je|tu|nous|vous|ils|elles|d'|l'|c'|ne|pas|etre|avoir|faire|bonjour|merci|si|tres|beaucoup|peu|autre|aussi|encore|deja|sans|alors|donc|ni|or|puis|mais|ou)\b/gi;
  const frenchMatches = text.match(frenchWords);
  if (frenchMatches && frenchMatches.length >= 2) {
    return 'fr';
  }

  // Default to English
  return 'en';
}

// ─── Get Stopwords by Language ────────────────────────────────────────────
/**
 * Get stopwords set for a specific language
 * @param {string} lang - Language code: 'en', 'fr', or 'ar'
 * @returns {Set} - Set of stopwords
 */
function getStopwords(lang = 'en') {
  switch (lang) {
    case 'fr':
      return FR_STOPWORDS;
    case 'ar':
      return AR_STOPWORDS;
    case 'en':
    default:
      return EN_STOPWORDS;
  }
}

// ─── Export ───────────────────────────────────────────────────────────────
module.exports = {
  detectLanguage,
  stemWord,
  getStopwords,
  EN_STOPWORDS,
  FR_STOPWORDS,
  AR_STOPWORDS,
  SEO_NOISE,
};
