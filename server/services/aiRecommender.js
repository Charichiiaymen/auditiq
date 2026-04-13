const axios = require('axios');
const { extractVisibleContent, recalculateWordCount } = require('./contentExtractor');

// ─── Data-Grounded Consultant System Prompt ─────────────────────────────────
const SYSTEM_PROMPT = `You are a Data-Grounded Digital Marketing Consultant who provides hyper-specific, data-backed recommendations. You MUST cross-reference every recommendation against the verified audit JSON data provided.

RULES:
1. NEVER suggest generic fixes like "adding a sitemap" or "breaking up content" unless specific thresholds are breached
2. EVERY recommendation MUST include a "Reasoning Trace" linking to specific captured metrics
3. Base recommendations ONLY on the exact data provided - no assumptions or hallucinations
4. Focus on quantifiable business impact with specific numbers when available
5. Prioritize issues with the highest measurable impact first

EXAMPLE OF CORRECT FORMAT:
"Fix 178 missing alt tags to recover lost image search traffic"
vs
"Add alt text to images" (INCORRECT - too generic)

Always quantify impact: "Fix X missing elements to recover Y potential traffic" or "Address Z issues affecting A% of your content"`;

const FALLBACK = [
  {
    priority: 'High',
    title: 'Fix missing page title',
    description: 'Add descriptive title tag to improve search visibility',
    pillar: 'SEO',
    reasoningTrace: 'Audit shows hasTitle: false → No search context provided → Add 30-60 char title tag'
  },
  {
    priority: 'High',
    title: 'Add meta description',
    description: 'Write 120-160 char meta desc to boost click-through rates',
    pillar: 'SEO',
    reasoningTrace: 'Audit shows hasMetaDescription: false → Missed CTR opportunity → Add compelling meta desc'
  },
  {
    priority: 'High',
    title: 'Enable HTTPS security',
    description: 'Switch to SSL to avoid Google penalties and build trust',
    pillar: 'Technical',
    reasoningTrace: 'Audit shows isHTTPS: false → Security risk and ranking penalty → Install SSL certificate'
  },
  {
    priority: 'Medium',
    title: 'Add call-to-action',
    description: 'Guide visitors to take desired action above the fold',
    pillar: 'Content',
    reasoningTrace: 'Audit shows hasCTA: false → Missed conversion opportunity → Add clear CTA button'
  },
  {
    priority: 'Low',
    title: 'Validate social handles',
    description: 'Verify Instagram/Facebook for improved social proof',
    pillar: 'Social',
    reasoningTrace: 'Audit shows social data validation issues → Weak trust signals → Confirm social links'
  },
];

async function generateRecommendations(auditResult) {
  const { seo, technical, content, social, pageSpeed, crawl } = auditResult;

  // Extract clean visible content and recalculate true word count
  const cleanContent = auditResult.html ? extractVisibleContent(auditResult.html) : '';
  const visibleWordCount = cleanContent ? recalculateWordCount(cleanContent) : content.wordCount;

  // Override inflated raw-HTML word count with the true visible count
  const correctedContent = { ...content, wordCount: visibleWordCount };
  const rawWordCount = content.wordCount;
  const wordCountInflated = rawWordCount !== visibleWordCount;

  const userPrompt = `DATA-GROUNDED AUDIT ANALYSIS
============================

VERIFIED AUDIT METRICS:
SEO PILLAR — Score: ${seo.score}/100
- Title tag: ${seo.hasTitle ? 'Present' : 'MISSING'}, length: ${seo.titleLength}/30-60 chars
- Meta description: ${seo.hasMetaDescription ? 'Present' : 'MISSING'}, length: ${seo.metaDescriptionLength}/120-160 chars
- H1 tags: ${seo.h1Count} found (target: exactly 1)
- Images missing alt text: ${seo.imagesMissingAlt} (IMPACT: Lost image search traffic)
- Canonical tag: ${seo.hasCanonical ? 'Present' : 'MISSING'}
- Robots meta: ${seo.hasRobotsMeta ? 'Present' : 'MISSING'}

TECHNICAL PILLAR — Score: ${technical.score}/100
- HTTPS security: ${technical.isHTTPS ? 'SECURE' : 'INSECURE'}
- Mobile viewport: ${technical.hasViewportMeta ? 'Present' : 'MISSING'}
- Open Graph tags: ${technical.hasOpenGraph ? 'Present' : 'MISSING'}
- Structured data: ${technical.hasStructuredData ? 'Present' : 'MISSING'}
- Script count: ${technical.scriptCount} scripts (perf impact: high if >20)

CONTENT PILLAR — Score: ${correctedContent.score}/100
- Visible word count: ${visibleWordCount} words (min recommended: 300)${wordCountInflated ? ` [CORRECTED: raw HTML reported ${rawWordCount} — scripts/styles inflated count by ${rawWordCount - visibleWordCount}]` : ''}
- Call-to-action: ${correctedContent.hasCTA ? 'Present' : 'MISSING'}
- Paragraph structure: ${correctedContent.paragraphCount} paragraphs
- Contact information: ${correctedContent.hasPhoneNumber || correctedContent.hasEmail ? 'Present' : 'MISSING'}

EXTRACTED VISIBLE CONTENT PREVIEW (first 500 chars):
${cleanContent.substring(0, 500)}

SOCIAL PILLAR — Score: ${social.score}/100
- Instagram: ${social.instagramProvided ? 'Provided' : 'Missing'}, validity: ${social.instagramHandleValid ? 'Valid' : 'Invalid'}
- Facebook: ${social.facebookProvided ? 'Provided' : 'Missing'}, validity: ${social.facebookURLValid ? 'Valid' : 'Invalid'}

PAGE SPEED CORE WEB VITALS:
${pageSpeed ? `
- Performance Score: ${pageSpeed.performanceScore}/100
- LCP (Loading): ${pageSpeed.coreWebVitals?.LCP?.value || 'N/A'} (${pageSpeed.coreWebVitals?.LCP?.status || 'Unknown'})
- CLS (Stability): ${pageSpeed.coreWebVitals?.CLS?.value || 'N/A'} (${pageSpeed.coreWebVitals?.CLS?.status || 'Unknown'})
- TBT (Interactivity): ${pageSpeed.coreWebVitals?.TBT?.value || 'N/A'} (${pageSpeed.coreWebVitals?.TBT?.status || 'Unknown'})
` : 'PageSpeed data not available'}

CRAWL DATA:
${crawl ? `
- Pages crawled: ${crawl.pagesCrawled}
- Cross-page issues detected: ${crawl.crossPageIssues?.length || 0}
` : 'Crawl data not available'}

YOUR TASK: Provide EXACTLY 5 data-grounded recommendations with Reasoning Traces.

MANDATORY FORMAT REQUIREMENTS:
1. Each recommendation MUST cite specific audit metrics
2. Quantify business impact with actual numbers when available
3. Link each suggestion to verified data above
4. NEVER suggest generic fixes not backed by the data
5. Include a Reasoning Trace showing data → insight → action

EXAMPLE OUTPUT FORMAT:
[
  {
    "priority": "High",
    "title": "Fix 23 missing alt tags",
    "description": "Recover lost image search traffic from 23 unlabeled images",
    "pillar": "SEO",
    "reasoningTrace": "Audit shows 23 images missing alt text → Lost image search visibility → Add descriptive alt attributes"
  }
]

RETURN ONLY VALID JSON ARRAY - NO EXPLANATIONS, NO MARKDOWN.`;

  try {
    const apiUrl = process.env.OLLAMA_API_KEY
      ? 'https://ollama.com/api/chat'
      : 'http://localhost:11434/api/chat'

    const headers = {
      'Content-Type': 'application/json',
      ...(process.env.OLLAMA_API_KEY && {
        'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`
      })
    }

    const response = await axios.post(apiUrl, {
      model: 'qwen3.5:cloud',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      options: {
        temperature: 0.4,
      },
    }, { headers })

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
    let recommendations = [];

    try {
      recommendations = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI JSON response:', parseError.message);
      return FALLBACK;
    }

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      console.error('Parsed result is not a valid array.');
      return FALLBACK;
    }

    // Validate and enrich recommendations with reasoning traces if missing
    const validatedRecommendations = recommendations.map(rec => ({
      priority: rec.priority || 'Medium',
      title: rec.title || 'Generic improvement',
      description: rec.description || 'Improve website performance',
      pillar: rec.pillar || 'Technical',
      reasoningTrace: rec.reasoningTrace || 'Data-driven recommendation based on audit metrics'
    }));

    // Ensure we have exactly 5 recommendations
    while (validatedRecommendations.length < 5) {
      validatedRecommendations.push(FALLBACK[validatedRecommendations.length]);
    }

    return validatedRecommendations.slice(0, 5);
  } catch (err) {
    console.error('AI recommender error:', err.message);
    return FALLBACK;
  }
}

module.exports = { generateRecommendations };