import { supabase } from '@/integrations/supabase/client';
import { AnalysisResult } from '@/lib/analysis';

interface ScrapedArticle {
  title: string;
  content: string;
  url: string;
  domain: string;
  success: boolean;
  error?: string;
}

export async function scrapeArticle(url: string): Promise<ScrapedArticle> {
  const { data, error } = await supabase.functions.invoke('scrape-article', {
    body: { url },
  });

  if (error) {
    console.error('Scrape error:', error);
    return {
      title: '',
      content: '',
      url,
      domain: new URL(url).hostname,
      success: false,
      error: error.message,
    };
  }

  return data as ScrapedArticle;
}

export async function saveAnalysis(
  userId: string,
  input: string,
  isUrl: boolean,
  result: AnalysisResult,
  articleTitle?: string,
  articleContent?: string
): Promise<void> {
  const { error } = await supabase.from('analysis_history').insert({
    user_id: userId,
    input_type: isUrl ? 'url' : 'text',
    input_value: input,
    article_title: articleTitle || null,
    article_content: articleContent?.slice(0, 2000) || null,
    text_score: result.textScore,
    domain_score: result.domainScore,
    evidence_score: result.evidenceScore,
    sentiment_score: result.sentimentScore,
    final_score: result.finalScore,
    rating: result.rating,
    domain_age: result.details.domainAge,
    ssl_valid: result.details.sslValid,
    similar_sources: result.details.similarSources,
    sentiment_bias: result.details.sentimentBias,
    clickbait_words_found: result.details.clickbaitWords,
  });

  if (error) {
    console.error('Error saving analysis:', error);
    throw error;
  }

  // Trigger low score alert in the background (don't await)
  sendLowScoreAlert(userId, result.finalScore, articleTitle || input.slice(0, 100), isUrl ? input : undefined, result.rating);
}

export async function sendLowScoreAlert(
  userId: string,
  score: number,
  title: string,
  url?: string,
  rating?: string
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-low-score-alert', {
      body: { user_id: userId, score, title, url, rating },
    });

    if (error) {
      console.error('Low score alert error:', error);
    }
  } catch (err) {
    // Silently fail - alerts are non-critical
    console.error('Failed to send low score alert:', err);
  }
}
