import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Threat intelligence data (simulated database - in production this would query real databases)
const KNOWN_MALICIOUS_DOMAINS = new Set([
  'malware-download.com', 'phishing-site.net', 'fake-bank-login.com',
  'crypto-scam.io', 'ransomware-c2.xyz'
]);

const TRUSTED_DOMAINS = new Set([
  'google.com', 'microsoft.com', 'apple.com', 'amazon.com', 'github.com',
  'facebook.com', 'twitter.com', 'linkedin.com', 'wikipedia.org',
  'reuters.com', 'bbc.com', 'nytimes.com', 'washingtonpost.com'
]);

const SUSPICIOUS_PATTERNS = [
  { pattern: /^[a-z0-9]{20,}\./, description: 'Random subdomain pattern', severity: 'medium' },
  { pattern: /\.(tk|ml|ga|cf|gq)$/, description: 'Free TLD commonly abused', severity: 'medium' },
  { pattern: /(login|signin|verify|secure|account|update|banking)/i, description: 'Phishing keywords in domain', severity: 'low' },
  { pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, description: 'IP address instead of domain', severity: 'medium' },
];

interface ThreatReport {
  domain: string;
  queriedAt: string;
  reputation: {
    score: number;
    riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
    category: string;
  };
  threats: Array<{
    type: string;
    severity: string;
    description: string;
    confidence: number;
  }>;
  attributes: {
    isTrusted: boolean;
    isKnownMalicious: boolean;
    hasSSL: boolean;
    domainAge: string;
    registrar: string | null;
  };
  recommendations: string[];
}

// Simple hash function for API key validation
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function validateApiKey(apiKey: string, supabase: any): Promise<{ valid: boolean; userId?: string; permissions?: string[] }> {
  if (!apiKey || apiKey.length < 32) {
    return { valid: false };
  }

  const keyPrefix = apiKey.substring(0, 8);
  const keyHash = await hashApiKey(apiKey);

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, permissions, rate_limit, requests_today, revoked_at, expires_at')
    .eq('key_prefix', keyPrefix)
    .eq('key_hash', keyHash)
    .single();

  if (error || !data) {
    return { valid: false };
  }

  // Check if revoked
  if (data.revoked_at) {
    return { valid: false };
  }

  // Check if expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false };
  }

  // Check rate limit
  if (data.requests_today >= data.rate_limit) {
    return { valid: false };
  }

  // Update usage stats
  await supabase
    .from('api_keys')
    .update({ 
      requests_today: data.requests_today + 1,
      last_used_at: new Date().toISOString()
    })
    .eq('id', data.id);

  return { valid: true, userId: data.user_id, permissions: data.permissions };
}

function analyzeDomain(domain: string): ThreatReport {
  const lowerDomain = domain.toLowerCase().replace(/^www\./, '');
  const threats: ThreatReport['threats'] = [];
  let score = 70;

  // Check against known lists
  const isTrusted = TRUSTED_DOMAINS.has(lowerDomain) || 
    Array.from(TRUSTED_DOMAINS).some(d => lowerDomain.endsWith('.' + d));
  const isKnownMalicious = KNOWN_MALICIOUS_DOMAINS.has(lowerDomain);

  if (isTrusted) {
    score = 95;
  } else if (isKnownMalicious) {
    score = 5;
    threats.push({
      type: 'known_malicious',
      severity: 'critical',
      description: 'Domain is listed in known malicious domains database',
      confidence: 0.99
    });
  }

  // Pattern analysis
  for (const { pattern, description, severity } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(lowerDomain)) {
      threats.push({
        type: 'pattern_match',
        severity,
        description,
        confidence: 0.7
      });
      score -= severity === 'high' ? 25 : severity === 'medium' ? 15 : 8;
    }
  }

  // Typosquatting detection
  const popularBrands = ['google', 'facebook', 'paypal', 'amazon', 'microsoft', 'apple', 'netflix', 'bank'];
  for (const brand of popularBrands) {
    if (lowerDomain.includes(brand) && !lowerDomain.endsWith(`${brand}.com`)) {
      threats.push({
        type: 'typosquatting',
        severity: 'high',
        description: `Possible typosquatting attempt on ${brand}`,
        confidence: 0.6
      });
      score -= 20;
      break;
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine risk level
  let riskLevel: ThreatReport['reputation']['riskLevel'];
  if (score >= 80) riskLevel = 'safe';
  else if (score >= 60) riskLevel = 'low';
  else if (score >= 40) riskLevel = 'medium';
  else if (score >= 20) riskLevel = 'high';
  else riskLevel = 'critical';

  // Determine category
  let category = 'Unknown';
  if (isTrusted) category = 'Trusted';
  else if (isKnownMalicious) category = 'Malicious';
  else if (threats.length > 0) category = 'Suspicious';
  else category = 'Uncategorized';

  // Generate recommendations
  const recommendations: string[] = [];
  if (riskLevel === 'critical' || riskLevel === 'high') {
    recommendations.push('Avoid visiting this website');
    recommendations.push('Do not enter any personal information');
    recommendations.push('If you visited, run a malware scan on your device');
  } else if (riskLevel === 'medium') {
    recommendations.push('Proceed with caution');
    recommendations.push('Verify the website authenticity before sharing data');
  } else if (riskLevel === 'low') {
    recommendations.push('Generally safe, but always verify before sharing sensitive data');
  }

  return {
    domain: lowerDomain,
    queriedAt: new Date().toISOString(),
    reputation: {
      score,
      riskLevel,
      category
    },
    threats,
    attributes: {
      isTrusted,
      isKnownMalicious,
      hasSSL: true, // Would check in production
      domainAge: isTrusted ? '5+ years' : 'Unknown',
      registrar: null
    },
    recommendations
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);

    // API Key validation - required for external access
    const apiKey = req.headers.get('x-api-key');
    let authResult: { valid: boolean; userId?: string; permissions?: string[] } = { valid: false };
    
    if (apiKey) {
      authResult = await validateApiKey(apiKey, supabase);
      if (!authResult.valid) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid or expired API key',
            code: 'INVALID_API_KEY'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Threat Intelligence API request:', { 
      hasApiKey: !!apiKey, 
      authenticated: authResult.valid,
      userId: authResult.userId 
    });

    let domains: string[] = [];

    if (req.method === 'GET') {
      const domain = url.searchParams.get('domain');
      if (domain) {
        domains = [domain];
      }
    } else if (req.method === 'POST') {
      const body = await req.json();
      if (body.domain) {
        domains = [body.domain];
      } else if (body.domains && Array.isArray(body.domains)) {
        // Limit based on auth status
        const limit = authResult.valid ? 100 : 10;
        domains = body.domains.slice(0, limit);
      }
    }

    if (domains.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing domain parameter. Use ?domain=example.com or POST {"domain": "example.com"}'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze domains
    const reports = domains.map(domain => analyzeDomain(domain));
    const scanDuration = Date.now() - startTime;

    // Collect threat types for stats
    const threatTypes: Record<string, number> = {};
    const maliciousDomains: string[] = [];
    reports.forEach(report => {
      if (report.reputation.riskLevel === 'critical' || report.reputation.riskLevel === 'high') {
        maliciousDomains.push(report.domain);
      }
      report.threats.forEach(threat => {
        threatTypes[threat.type] = (threatTypes[threat.type] || 0) + 1;
      });
    });

    // Store scan in threat_scans table for analytics
    const avgScore = reports.reduce((sum, r) => sum + r.reputation.score, 0) / reports.length;
    await supabase.from('threat_scans').insert({
      user_id: authResult.userId || null,
      scan_type: 'api',
      domains_scanned: domains.length,
      threats_found: reports.filter(r => r.threats.length > 0).length,
      avg_score: avgScore,
      threat_types: threatTypes,
      malicious_domains: maliciousDomains.slice(0, 10),
      scan_duration_ms: scanDuration
    });

    // Single domain query
    if (domains.length === 1) {
      console.log('Single domain analysis:', { domain: domains[0], score: reports[0].reputation.score });
      
      return new Response(
        JSON.stringify({
          success: true,
          authenticated: authResult.valid,
          data: reports[0]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bulk domain query
    const summary = {
      total: reports.length,
      safe: reports.filter(r => r.reputation.riskLevel === 'safe').length,
      low: reports.filter(r => r.reputation.riskLevel === 'low').length,
      medium: reports.filter(r => r.reputation.riskLevel === 'medium').length,
      high: reports.filter(r => r.reputation.riskLevel === 'high').length,
      critical: reports.filter(r => r.reputation.riskLevel === 'critical').length
    };

    console.log('Bulk domain analysis:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        authenticated: authResult.valid,
        summary,
        data: reports
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Threat Intelligence API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
