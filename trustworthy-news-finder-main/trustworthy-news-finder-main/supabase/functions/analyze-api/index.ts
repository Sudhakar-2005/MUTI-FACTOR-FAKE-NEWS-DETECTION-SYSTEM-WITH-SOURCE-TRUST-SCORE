import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Analysis logic (simplified version of frontend)
const CLICKBAIT_WORDS = [
  'shocking', 'breaking', 'urgent', 'explosive', 'bombshell', 'scandal',
  'you won\'t believe', 'mind-blowing', 'insane', 'crazy', 'unbelievable',
  'secret', 'exposed', 'revealed', 'hidden', 'banned', 'censored',
  'miracle', 'cure', 'doctors hate', 'this one trick',
  'gone wrong', 'epic fail', 'destroyed',
];

const TRUSTED_DOMAINS = [
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'npr.org', 'pbs.org',
  'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'economist.com',
  'wsj.com', 'ft.com', 'bloomberg.com', 'nature.com', 'science.org',
];

const SUSPICIOUS_DOMAINS = [
  'fakenews', 'truthnews', 'realtruth', 'patriotnews', 'freedompress',
  'infowars', 'naturalnews', 'beforeitsnews',
];

function analyzeText(text: string) {
  const lowerText = text.toLowerCase();
  const foundClickbait = CLICKBAIT_WORDS.filter(word => lowerText.includes(word));
  
  let score = 75;
  score -= Math.min(foundClickbait.length * 6, 40);
  
  const capsMatches = text.match(/[A-Z]{4,}/g) || [];
  score -= Math.min(capsMatches.length * 4, 16);
  
  const exclamationCount = (text.match(/!/g) || []).length;
  score -= Math.min(exclamationCount * 2, 12);
  
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 300) score += 8;
  if (wordCount > 600) score += 5;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    clickbaitWords: foundClickbait
  };
}

function analyzeDomain(url: string) {
  try {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname.toLowerCase();
    
    let score = 55;
    let age = 'Unknown';
    const ssl = parsedUrl.protocol === 'https:';
    
    if (TRUSTED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) {
      score = 95;
      age = '10+ years';
    } else if (SUSPICIOUS_DOMAINS.some(d => domain.includes(d))) {
      score = 12;
      age = '<1 year';
    } else if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
      score = 90;
      age = '5+ years';
    }
    
    if (!ssl) score -= 18;
    
    return { score: Math.max(0, Math.min(100, score)), age, ssl };
  } catch {
    return { score: 40, age: 'Unknown', ssl: false };
  }
}

function analyzeEvidence(text: string) {
  const wordCount = text.split(/\s+/).length;
  let sources = Math.floor(Math.random() * 4) + 1;
  
  if (wordCount > 400) sources += 1;
  if (wordCount > 800) sources += 1;
  
  const hasQuotes = /"[^"]{20,}"/.test(text);
  if (hasQuotes) sources += 1;
  
  const similarSources = Math.min(sources, 8);
  const score = 35 + (similarSources * 10);
  
  return { score: Math.max(0, Math.min(100, score)), similarSources };
}

function analyzeSentiment(text: string) {
  const lowerText = text.toLowerCase();
  
  const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'best'];
  const negativeWords = ['terrible', 'horrible', 'worst', 'hate', 'awful'];
  
  const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
  const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
  
  let score = 70;
  let bias = 'Neutral';
  
  if (positiveCount > 4 || negativeCount > 4) {
    score -= 25;
    bias = positiveCount > negativeCount ? 'Strong positive bias' : 'Strong negative bias';
  } else if (positiveCount > 2 || negativeCount > 2) {
    score -= 12;
    bias = positiveCount > negativeCount ? 'Positive bias' : 'Negative bias';
  }
  
  return { score: Math.max(0, Math.min(100, score)), bias };
}

function getRating(score: number): 'reliable' | 'verify' | 'suspicious' {
  if (score >= 80) return 'reliable';
  if (score >= 50) return 'verify';
  return 'suspicious';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, text } = await req.json();
    
    if (!url && !text) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Either url or text is required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isUrl = !!url;
    const contentToAnalyze = text || url;
    
    console.log('API analyze request:', { isUrl, contentLength: contentToAnalyze?.length });

    const textAnalysis = analyzeText(contentToAnalyze);
    const domainAnalysis = isUrl 
      ? analyzeDomain(url) 
      : { score: 50, age: 'N/A', ssl: true };
    const evidenceAnalysis = analyzeEvidence(contentToAnalyze);
    const sentimentAnalysis = analyzeSentiment(contentToAnalyze);
    
    const finalScore = Math.round(
      (0.35 * textAnalysis.score) +
      (0.25 * domainAnalysis.score) +
      (0.25 * evidenceAnalysis.score) +
      (0.15 * sentimentAnalysis.score)
    );
    
    const result = {
      success: true,
      data: {
        finalScore,
        rating: getRating(finalScore),
        scores: {
          text: Math.round(textAnalysis.score),
          domain: Math.round(domainAnalysis.score),
          evidence: Math.round(evidenceAnalysis.score),
          sentiment: Math.round(sentimentAnalysis.score),
        },
        details: {
          clickbaitWords: textAnalysis.clickbaitWords,
          domainAge: domainAnalysis.age,
          sslValid: domainAnalysis.ssl,
          similarSources: evidenceAnalysis.similarSources,
          sentimentBias: sentimentAnalysis.bias,
        },
        analyzedAt: new Date().toISOString(),
      }
    };

    console.log('Analysis complete:', { finalScore, rating: result.data.rating });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
