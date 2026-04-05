const axios = require('axios');

const SYSTEM_PROMPT = `You are a senior digital marketing consultant with 10 years of experience auditing brand websites and online presence. You write clear, direct, and actionable recommendations. You always prioritize by business impact. Your tone is professional but human — like a trusted advisor, not a robot.`;

const FALLBACK = [
  { priority: 'High', title: 'Add or fix your page title tag', description: 'A descriptive title between 30-60 characters is your single most important SEO element.', pillar: 'SEO' },
  { priority: 'High', title: 'Write a compelling meta description', description: 'A 120-160 character meta description directly increases click-through rates from search results.', pillar: 'SEO' },
  { priority: 'High', title: 'Ensure your site uses HTTPS', description: 'Google penalizes non-secure sites and users distrust them — switch to SSL immediately.', pillar: 'Technical' },
  { priority: 'Medium', title: 'Add a clear call-to-action above the fold', description: 'Tell visitors exactly what to do next — book, buy, or contact — within the first screen.', pillar: 'Content' },
  { priority: 'Low', title: 'Complete your social media presence', description: 'Consistent branding across Instagram and Facebook builds trust and drives referral traffic.', pillar: 'Social' },
];

async function generateRecommendations(auditResult) {
  const { seo, technical, content, social } = auditResult;

  const userPrompt = `I just ran an automated audit of a website. Here are the results:

SEO PILLAR — Score: ${seo.score}/100
- Page title: ${seo.hasTitle ? 'Present' : 'Missing'}, length: ${seo.titleLength} characters (ideal: 30-60)
- Meta description: ${seo.hasMetaDescription ? 'Present' : 'Missing'}, length: ${seo.metaDescriptionLength} characters (ideal: 120-160)
- H1 tags found: ${seo.h1Count} (ideal: exactly 1)
- Images missing alt text: ${seo.imagesMissingAlt}
- Has canonical tag: ${seo.hasCanonical}
- Has robots meta: ${seo.hasRobotsMeta}

TECHNICAL PILLAR — Score: ${technical.score}/100
- HTTPS: ${technical.isHTTPS}
- Mobile viewport meta: ${technical.hasViewportMeta}
- Open Graph tags: ${technical.hasOpenGraph}
- Structured data (JSON-LD): ${technical.hasStructuredData}
- Script count: ${technical.scriptCount}

CONTENT PILLAR — Score: ${content.score}/100
- Word count: ${content.wordCount} words (minimum recommended: 300)
- Has a call-to-action: ${content.hasCTA}
- Paragraph count: ${content.paragraphCount}
- Contact info visible: ${content.hasPhoneNumber || content.hasEmail}

SOCIAL PILLAR — Score: ${social.score}/100
- Instagram provided: ${social.instagramProvided}, valid handle: ${social.instagramHandleValid}
- Facebook provided: ${social.facebookProvided}, valid URL: ${social.facebookURLValid}

Based on this data, give me exactly 5 prioritized recommendations. Focus on the issues that will have the highest impact on visibility, trust, and conversions.

Return ONLY a valid JSON array with no explanation, no markdown, no backticks. Use exactly this structure:
[
  {
    "priority": "High" or "Medium" or "Low",
    "title": "max 8 words",
    "description": "one sentence, max 25 words, written as direct advice",
    "pillar": "SEO" or "Technical" or "Content" or "Social"
  }
]`;

  try {
const response = await axios.post('http://localhost:11434/api/chat', {
  model: 'qwen3.5:cloud',
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ],
  stream: false,
  options: {
    temperature: 0.4,
  },
});

    const responseText = response.data.message.content;

    const cleaned = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const jsonStart = cleaned.indexOf('[');
    const jsonEnd = cleaned.lastIndexOf(']');

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('AI did not return a valid JSON array. Raw response:', responseText);
      return FALLBACK;
    }

    const jsonString = cleaned.slice(jsonStart, jsonEnd + 1);
    const recommendations = JSON.parse(jsonString);

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      console.error('Parsed result is not a valid array.');
      return FALLBACK;
    }

    return recommendations;
  } catch (err) {
    console.error('AI recommender error:', err.message);
    return FALLBACK;
  }
}

module.exports = { generateRecommendations };