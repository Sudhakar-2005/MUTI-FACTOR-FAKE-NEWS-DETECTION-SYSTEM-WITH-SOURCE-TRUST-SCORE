import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUSPICIOUS_PATTERNS = [
  { pattern: /\.(tk|ml|ga|cf|gq)$/, description: 'Free TLD commonly abused' },
  { pattern: /(login|signin|verify|secure|account|update)/i, description: 'Phishing keywords' },
];

const KNOWN_MALICIOUS_DOMAINS = new Set([
  'malware-download.com', 'phishing-site.net', 'fake-bank-login.com'
]);

interface ScanResult {
  domain: string;
  previousScore: number | null;
  currentScore: number;
  threats: string[];
  isNewThreat: boolean;
  changeType: 'degraded' | 'improved' | 'new_threat' | 'stable';
}

function analyzeBookmarkedDomain(domain: string, previousScore: number | null): ScanResult {
  let score = 80;
  const threats: string[] = [];
  const lowerDomain = domain.toLowerCase();

  // Check known malicious
  if (KNOWN_MALICIOUS_DOMAINS.has(lowerDomain)) {
    score = 10;
    threats.push('Domain is on known malicious list');
  }

  // Pattern checks
  for (const { pattern, description } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(lowerDomain)) {
      score -= 15;
      threats.push(description);
    }
  }

  score = Math.max(0, Math.min(100, score));

  // Determine change type
  let changeType: ScanResult['changeType'] = 'stable';
  const isNewThreat = threats.length > 0 && (previousScore === null || previousScore > 50);
  
  if (previousScore !== null) {
    if (score < previousScore - 10) {
      changeType = 'degraded';
    } else if (score > previousScore + 10) {
      changeType = 'improved';
    } else if (isNewThreat) {
      changeType = 'new_threat';
    }
  } else if (threats.length > 0) {
    changeType = 'new_threat';
  }

  return {
    domain,
    previousScore,
    currentScore: score,
    threats,
    isNewThreat,
    changeType
  };
}

async function sendAlertEmail(
  resend: any,
  email: string,
  threatResults: ScanResult[]
): Promise<boolean> {
  const threatsHTML = threatResults.map(result => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px; font-weight: 500;">${result.domain}</td>
      <td style="padding: 12px;">
        <span style="background: ${result.currentScore < 40 ? '#fee2e2' : '#fef3c7'}; 
                     color: ${result.currentScore < 40 ? '#dc2626' : '#d97706'}; 
                     padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          ${result.currentScore}/100
        </span>
      </td>
      <td style="padding: 12px; font-size: 13px; color: #64748b;">
        ${result.threats.join(', ') || 'Reputation degraded'}
      </td>
    </tr>
  `).join('');

  const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #0f172a; margin: 0;">🛡️ Daily Threat Scan Report</h1>
      <p style="color: #64748b; margin: 8px 0 0;">TrustGuard Scheduled Security Scan</p>
    </div>
    
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); padding: 24px; margin-bottom: 20px;">
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
        <h2 style="margin: 0 0 8px; color: #dc2626; font-size: 16px;">⚠️ ${threatResults.length} Site${threatResults.length !== 1 ? 's' : ''} Require Attention</h2>
        <p style="margin: 0; color: #7f1d1d; font-size: 14px;">
          Our scheduled scan detected new threats or score degradation on sites you've bookmarked.
        </p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 12px; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase;">Domain</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase;">Score</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase;">Issues</th>
          </tr>
        </thead>
        <tbody>
          ${threatsHTML}
        </tbody>
      </table>
    </div>
    
    <div style="background: white; border-radius: 12px; padding: 16px; text-align: center;">
      <p style="margin: 0; color: #64748b; font-size: 13px;">
        Consider removing these sites from your bookmarks or verifying their legitimacy.
      </p>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 11px;">
      <p>Generated by TrustGuard Security Scanner</p>
      <p>Scanned at ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await resend.emails.send({
      from: 'TrustGuard <onboarding@resend.dev>',
      to: [email],
      subject: `🚨 TrustGuard: ${threatResults.length} Bookmarked Site${threatResults.length !== 1 ? 's' : ''} Flagged`,
      html: emailHTML
    });
    return true;
  } catch (error) {
    console.error('Failed to send alert email:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = resendKey ? new Resend(resendKey) : null;

    const body = await req.json().catch(() => ({}));
    const { userId, bookmarkedDomains, previousScores, email, sendNotification } = body;

    console.log('Scheduled scan request:', { 
      userId, 
      domainCount: bookmarkedDomains?.length || 0,
      email: email ? '***' : 'none'
    });

    if (!bookmarkedDomains || !Array.isArray(bookmarkedDomains) || bookmarkedDomains.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No bookmarked domains provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze all domains
    const results: ScanResult[] = bookmarkedDomains.map((domain: string) => {
      const prevScore = previousScores?.[domain] ?? null;
      return analyzeBookmarkedDomain(domain, prevScore);
    });

    // Find threats that need alerting
    const threatResults = results.filter(r => 
      r.changeType === 'new_threat' || 
      r.changeType === 'degraded' || 
      r.currentScore < 40
    );

    // Store scan results in notifications table if we have a userId
    if (userId && threatResults.length > 0) {
      for (const threat of threatResults.slice(0, 5)) { // Limit to 5 notifications
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'scheduled_scan_threat',
          title: `⚠️ Threat detected: ${threat.domain}`,
          message: `Score: ${threat.currentScore}/100. ${threat.threats[0] || 'Security concerns detected'}`,
          metadata: {
            domain: threat.domain,
            score: threat.currentScore,
            previousScore: threat.previousScore,
            threats: threat.threats,
            changeType: threat.changeType
          }
        });
      }
    }

    // Send email alert if requested and we have threats
    let emailSent = false;
    if (sendNotification && email && threatResults.length > 0 && resend) {
      emailSent = await sendAlertEmail(resend, email, threatResults);
    }

    const summary = {
      total: results.length,
      safe: results.filter(r => r.currentScore >= 70).length,
      degraded: results.filter(r => r.changeType === 'degraded').length,
      newThreats: results.filter(r => r.changeType === 'new_threat').length,
      critical: results.filter(r => r.currentScore < 30).length
    };

    console.log('Scheduled scan completed:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        threatCount: threatResults.length,
        emailSent,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scheduled scan error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Scan failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
