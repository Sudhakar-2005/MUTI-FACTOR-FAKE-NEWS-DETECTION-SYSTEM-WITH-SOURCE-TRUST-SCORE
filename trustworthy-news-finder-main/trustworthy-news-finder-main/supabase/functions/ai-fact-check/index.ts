import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, title, url } = await req.json();
    
    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client to check fact-check database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract key phrases for matching against fact-check database
    const contentWords = content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
    const sampleKeywords = contentWords.slice(0, 20);

    // Search for matching fact-checks
    const { data: relatedFactChecks } = await supabase
      .from('fact_checks')
      .select('*')
      .or(sampleKeywords.map((kw: string) => `claim.ilike.%${kw}%`).join(','))
      .limit(5);

    console.log('Found related fact-checks:', relatedFactChecks?.length || 0);

    // Build context from existing fact-checks
    const factCheckContext = relatedFactChecks?.length 
      ? `\n\nRelevant verified fact-checks from our database:\n${relatedFactChecks.map(fc => 
          `- Claim: "${fc.claim}" - Verdict: ${fc.verdict} - ${fc.explanation || ''}`
        ).join('\n')}`
      : '';

    // Call Lovable AI for comprehensive fact-checking
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert fact-checker and misinformation analyst. Analyze content for:
1. Factual accuracy - identify claims that can be verified
2. Source credibility - assess if sources are reliable
3. Logical fallacies - detect misleading reasoning
4. Emotional manipulation - identify clickbait or fear-mongering language
5. Missing context - find important omissions

Respond with a JSON object containing:
{
  "overallAssessment": "reliable" | "mostly_accurate" | "needs_verification" | "misleading" | "false",
  "confidenceScore": 0-100,
  "factualClaims": [{ "claim": string, "assessment": "verified" | "likely_true" | "unverified" | "likely_false" | "false", "explanation": string }],
  "redFlags": [string],
  "missingContext": [string],
  "sourceAnalysis": { "credibility": "high" | "medium" | "low" | "unknown", "reasoning": string },
  "recommendation": string
}`
          },
          {
            role: 'user',
            content: `Analyze this article for factual accuracy and potential misinformation:

Title: ${title || 'Unknown'}
URL: ${url || 'Not provided'}

Content:
${content.slice(0, 8000)}${factCheckContext}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'Invalid AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response from AI
    let analysis;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = aiContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                       aiContent.match(/```\n?([\s\S]*?)\n?```/) ||
                       [null, aiContent];
      analysis = JSON.parse(jsonMatch[1] || aiContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw AI content:', aiContent);
      // Return a basic analysis if parsing fails
      analysis = {
        overallAssessment: 'needs_verification',
        confidenceScore: 50,
        factualClaims: [],
        redFlags: ['Unable to fully analyze content'],
        missingContext: [],
        sourceAnalysis: { credibility: 'unknown', reasoning: 'Analysis incomplete' },
        recommendation: 'Manual verification recommended'
      };
    }

    return new Response(
      JSON.stringify({
        analysis,
        relatedFactChecks: relatedFactChecks || [],
        analyzedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-fact-check:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
