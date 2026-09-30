import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface DigestStats {
  totalAnalyses: number;
  avgScore: number;
  trustworthyCount: number;
  unreliableCount: number;
  topDomains: { domain: string; count: number }[];
  clickbaitPatterns: { pattern: string; count: number }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users with weekly digest enabled
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, weekly_digest_enabled')
      .eq('weekly_digest_enabled', true)
      .not('email', 'is', null);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} users to send digests to`);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const results = [];

    for (const profile of profiles || []) {
      try {
        // Get user's analyses from the past week
        const { data: analyses, error: analysesError } = await supabase
          .from('analysis_history')
          .select('*')
          .eq('user_id', profile.user_id)
          .gte('created_at', oneWeekAgo.toISOString())
          .order('created_at', { ascending: false });

        if (analysesError) {
          console.error(`Error fetching analyses for user ${profile.user_id}:`, analysesError);
          continue;
        }

        if (!analyses || analyses.length === 0) {
          console.log(`No analyses for user ${profile.user_id}, skipping`);
          continue;
        }

        // Calculate stats
        const stats: DigestStats = {
          totalAnalyses: analyses.length,
          avgScore: Math.round(analyses.reduce((sum, a) => sum + a.final_score, 0) / analyses.length),
          trustworthyCount: analyses.filter(a => a.final_score >= 70).length,
          unreliableCount: analyses.filter(a => a.final_score < 40).length,
          topDomains: [],
          clickbaitPatterns: [],
        };

        // Count domains
        const domainCounts: Record<string, number> = {};
        analyses.forEach(a => {
          if (a.input_type === 'url') {
            try {
              const domain = new URL(a.input_value).hostname;
              domainCounts[domain] = (domainCounts[domain] || 0) + 1;
            } catch {}
          }
        });
        stats.topDomains = Object.entries(domainCounts)
          .map(([domain, count]) => ({ domain, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Count clickbait patterns
        const patternCounts: Record<string, number> = {};
        analyses.forEach(a => {
          if (a.clickbait_words_found) {
            a.clickbait_words_found.forEach((word: string) => {
              patternCounts[word] = (patternCounts[word] || 0) + 1;
            });
          }
        });
        stats.clickbaitPatterns = Object.entries(patternCounts)
          .map(([pattern, count]) => ({ pattern, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Generate email HTML
        const emailHtml = generateDigestEmail(profile.display_name || 'User', stats);

        // Send email
        const { error: emailError } = await resend.emails.send({
          from: 'TrustGuard <digest@resend.dev>',
          to: [profile.email!],
          subject: `Your Weekly TrustGuard Digest - ${stats.totalAnalyses} analyses`,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Error sending email to ${profile.email}:`, emailError);
          results.push({ userId: profile.user_id, success: false, error: emailError.message });
        } else {
          console.log(`Successfully sent digest to ${profile.email}`);
          results.push({ userId: profile.user_id, success: true });
        }
      } catch (userError) {
        console.error(`Error processing user ${profile.user_id}:`, userError);
        results.push({ userId: profile.user_id, success: false, error: String(userError) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-weekly-digest:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateDigestEmail(name: string, stats: DigestStats): string {
  const scoreColor = stats.avgScore >= 70 ? '#22c55e' : stats.avgScore >= 40 ? '#facc15' : '#ef4444';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0f18; color: #e2e8f0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: rgba(45, 212, 191, 0.1); border-radius: 12px;">
        <span style="font-size: 24px;">🛡️</span>
        <span style="font-size: 18px; font-weight: 700; color: #2dd4bf;">TrustGuard</span>
      </div>
    </div>

    <!-- Greeting -->
    <h1 style="color: #fff; font-size: 24px; margin-bottom: 8px;">Hi ${name}!</h1>
    <p style="color: #94a3b8; margin-bottom: 32px;">Here's your weekly fact-checking summary:</p>

    <!-- Stats Card -->
    <div style="background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; margin-bottom: 24px;">
      <h2 style="color: #fff; font-size: 16px; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 0.5px;">This Week's Activity</h2>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
        <div style="text-align: center; padding: 16px; background: rgba(45, 212, 191, 0.1); border-radius: 12px;">
          <div style="font-size: 32px; font-weight: 700; color: #2dd4bf;">${stats.totalAnalyses}</div>
          <div style="font-size: 12px; color: #94a3b8;">Analyses</div>
        </div>
        <div style="text-align: center; padding: 16px; background: rgba(45, 212, 191, 0.1); border-radius: 12px;">
          <div style="font-size: 32px; font-weight: 700; color: ${scoreColor};">${stats.avgScore}</div>
          <div style="font-size: 12px; color: #94a3b8;">Avg Score</div>
        </div>
        <div style="text-align: center; padding: 16px; background: rgba(34, 197, 94, 0.1); border-radius: 12px;">
          <div style="font-size: 32px; font-weight: 700; color: #22c55e;">${stats.trustworthyCount}</div>
          <div style="font-size: 12px; color: #94a3b8;">Trustworthy</div>
        </div>
        <div style="text-align: center; padding: 16px; background: rgba(239, 68, 68, 0.1); border-radius: 12px;">
          <div style="font-size: 32px; font-weight: 700; color: #ef4444;">${stats.unreliableCount}</div>
          <div style="font-size: 12px; color: #94a3b8;">Flagged</div>
        </div>
      </div>
    </div>

    ${stats.topDomains.length > 0 ? `
    <!-- Top Domains -->
    <div style="background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; margin-bottom: 24px;">
      <h2 style="color: #fff; font-size: 16px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">Most Checked Domains</h2>
      ${stats.topDomains.map(d => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <span style="color: #e2e8f0;">${d.domain}</span>
          <span style="color: #64748b;">${d.count} checks</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${stats.clickbaitPatterns.length > 0 ? `
    <!-- Clickbait Patterns -->
    <div style="background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; margin-bottom: 24px;">
      <h2 style="color: #fff; font-size: 16px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">Common Red Flags Found</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${stats.clickbaitPatterns.map(p => `
          <span style="padding: 4px 12px; background: rgba(239, 68, 68, 0.15); color: #ef4444; border-radius: 20px; font-size: 12px;">"${p.pattern}" (${p.count}x)</span>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- CTA -->
    <div style="text-align: center; margin-top: 32px;">
      <a href="https://trustguard.app/history" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%); color: #0a0f18; text-decoration: none; border-radius: 12px; font-weight: 600;">View Full History</a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1);">
      <p style="color: #64748b; font-size: 12px;">
        Stay vigilant. Verify before you share.<br>
        <a href="https://trustguard.app" style="color: #2dd4bf; text-decoration: none;">trustguard.app</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}
