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
    title: 'Enable HTTPS security',
    description: 'Switch to SSL to avoid Google penalties and build trust — Technical carries 40% of overall score',
    pillar: 'Technical',
    reasoningTrace: 'Audit shows isHTTPS: false → Security risk and ranking penalty (affects 40% weight pillar) → Install SSL certificate'
  },
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
    priority: 'Medium',
    title: 'Add call-to-action',
    description: 'Guide visitors to take desired action above the fold',
    pillar: 'Content',
    reasoningTrace: 'Audit shows hasCTA: false → Missed conversion opportunity → Add clear CTA button'
  },
  {
    priority: 'Low',
    title: 'Validate social handles',
    description: 'Verify Instagram/Facebook for improved social proof — DOM verification can confirm presence on page',
    pillar: 'Social',
    reasoningTrace: 'Audit shows social data validation issues → Weak trust signals (10% weight pillar) → Confirm social links on page via DOM verification'
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

SCORING METHODOLOGY:
Overall = Technical (40%) + SEO (30%) + Content (20%) + Social (10%)
Technical includes PageSpeed Core Web Vitals (20 pts of 100)

VERIFIED AUDIT METRICS:
SEO PILLAR — Score: ${seo.score}/100
- Title tag: ${seo.hasTitle ? 'Present' : 'MISSING'}, length: ${seo.titleLength}/30-60 chars
- Meta description: ${seo.hasMetaDescription ? 'Present' : 'MISSING'}, length: ${seo.metaDescriptionLength}/120-160 chars
- H1 tags: ${seo.h1Count} found (target: exactly 1)
- Images missing alt text: ${seo.imagesMissingAlt} (IMPACT: Lost image search traffic)
- Canonical tag: ${seo.hasCanonical ? 'Present' : 'MISSING'}
- Robots meta: ${seo.hasRobotsMeta ? 'Present' : 'MISSING'}

TECHNICAL PILLAR — Score: ${technical.score}/100 (WEIGHTED HIGHEST AT 40%)
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

KEYWORD ANALYSIS:
- Primary keyword: "${seo.topKeywords?.[0]?.word || 'N/A'}" (density: ${seo.topKeywords?.[0]?.density || 0}%)
- Top 3 keywords: ${(seo.topKeywords || []).slice(0, 3).map(k => `${k.word} (${k.density}%)`).join(', ') || 'N/A'}
- Keyword in title: ${seo.keywordInTitle ? 'YES' : 'NO'}
- Keyword in H1: ${seo.keywordInH1 ? 'YES' : 'NO'}
- Keyword in meta: ${seo.keywordInMeta ? 'YES' : 'NO'}

EXTRACTED VISIBLE CONTENT PREVIEW (first 500 chars):
${cleanContent.substring(0, 500)}

SOCIAL PILLAR — Score: ${social.score}/100
- Instagram: ${social.instagramProvided ? 'Provided' : 'Missing'}, validity: ${social.instagramHandleValid ? 'Valid' : 'Invalid'}
- Facebook: ${social.facebookProvided ? 'Provided' : 'Missing'}, validity: ${social.facebookURLValid ? 'Valid' : 'Invalid'}

SOCIAL DOM VERIFICATION:
- Instagram verified on page: ${social.instagramOnPage ? 'YES' : 'NO'}${social.instagramLinkFound ? ` (link: ${social.instagramLinkFound})` : ''}
- Facebook verified on page: ${social.facebookOnPage ? 'YES' : 'NO'}${social.facebookLinkFound ? ` (link: ${social.facebookLinkFound})` : ''}
- Other social platforms on page: ${(social.socialLinksOnPage || []).filter(l => !['Instagram','Facebook'].includes(l.platform)).map(l => l.platform).join(', ') || 'None'}
- Verified by Puppeteer: ${social.verifiedByPuppeteer ? 'YES' : 'NO (static HTML only)'}

ISSUE SUMMARY:
- Total issues: ${auditResult.issues?.length || 0}
- Critical: ${(auditResult.issues || []).filter(i => i.severity === 'Critical').length}
- High: ${(auditResult.issues || []).filter(i => i.severity === 'High').length}
- Medium: ${(auditResult.issues || []).filter(i => i.severity === 'Medium').length}

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
- Site type: ${crawl.siteType || 'Unknown'}
` : 'Crawl data not available'}

YOUR TASK: Provide EXACTLY 5 data-grounded recommendations with Reasoning Traces.

MANDATORY FORMAT REQUIREMENTS:
1. Each recommendation MUST cite specific audit metrics
2. Quantify business impact with actual numbers when available
3. Link each suggestion to verified data above
4. NEVER suggest generic fixes not backed by the data
5. Include a Reasoning Trace showing data → insight → action
6. Prioritize Technical pillar issues (40% weight) when scores are low

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
    }, { headers, timeout: 120000 }) // 2-minute timeout for deep analysis

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
    const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout') || err.message.includes('ETIMEDOUT');
    console.error('AI recommender error:', err.message);

    // Graceful degradation: return fallback with timeout warning
    if (isTimeout) {
      return {
        recommendations: FALLBACK,
        _warning: 'AI recommendations timed out after 120s. Using fallback recommendations. Please retry later for personalized insights.',
        _timeout: true,
      };
    }

    return FALLBACK;
  }
}

module.exports = { generateRecommendations };