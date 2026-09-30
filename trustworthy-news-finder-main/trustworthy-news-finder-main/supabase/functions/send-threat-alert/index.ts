import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ThreatAlertRequest {
  email: string;
  domain: string;
  riskLevel: string;
  threatCount: number;
  threats: Array<{
    source: string;
    type: string;
    severity: string;
    description: string;
  }>;
  recommendations: Array<{
    action: string;
    reason: string;
    priority: string;
  }>;
  overallScore: number;
}

const getRiskColor = (level: string): string => {
  switch (level) {
    case 'safe': return '#22c55e';
    case 'low': return '#2dd4bf';
    case 'medium': return '#facc15';
    case 'high': return '#fb923c';
    case 'critical': return '#ef4444';
    default: return '#94a3b8';
  }
};

const getSeverityBadge = (severity: string): string => {
  const color = severity === 'critical' ? '#ef4444' : 
                severity === 'high' ? '#fb923c' : 
                severity === 'medium' ? '#facc15' : '#2dd4bf';
  return `<span style="background: ${color}20; color: ${color}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${severity}</span>`;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      domain, 
      riskLevel, 
      threatCount, 
      threats, 
      recommendations,
      overallScore 
    }: ThreatAlertRequest = await req.json();

    if (!email || !domain) {
      throw new Error("Email and domain are required");
    }

    const riskColor = getRiskColor(riskLevel);
    const threatsHTML = threats.length > 0 
      ? threats.map(t => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px;">${t.source}</td>
          <td style="padding: 12px;">${t.type}</td>
          <td style="padding: 12px;">${getSeverityBadge(t.severity)}</td>
          <td style="padding: 12px; font-size: 13px; color: #64748b;">${t.description}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #64748b;">No specific threats detected</td></tr>';

    const recommendationsHTML = recommendations.map(r => `
      <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
        <strong style="color: ${r.priority === 'high' ? '#ef4444' : '#0f172a'};">${r.action}</strong>
        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">${r.reason}</p>
      </li>
    `).join('');

    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #2dd4bf, #14b8a6); padding: 12px; border-radius: 12px; margin-bottom: 16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <h1 style="color: #0f172a; margin: 0; font-size: 24px;">🚨 Security Alert</h1>
      <p style="color: #64748b; margin: 8px 0 0;">TrustGuard Threat Detection</p>
    </div>
    
    <!-- Alert Box -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; margin-bottom: 20px;">
      <div style="background: ${riskColor}; padding: 20px; text-align: center;">
        <h2 style="color: white; margin: 0; font-size: 18px;">⚠️ ${riskLevel.toUpperCase()} RISK DETECTED</h2>
      </div>
      
      <div style="padding: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
          <div>
            <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Domain</p>
            <p style="margin: 4px 0 0; color: #0f172a; font-weight: 600; font-size: 18px;">${domain}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Trust Score</p>
            <p style="margin: 4px 0 0; color: ${riskColor}; font-weight: 700; font-size: 24px;">${overallScore}/100</p>
          </div>
        </div>
        
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0; color: #0f172a; font-weight: 600;">
            ${threatCount} threat${threatCount !== 1 ? 's' : ''} detected
          </p>
          <p style="margin: 8px 0 0; color: #64748b; font-size: 14px;">
            Our security analysis has identified potential risks associated with this domain.
          </p>
        </div>
      </div>
    </div>
    
    <!-- Threats Table -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; margin-bottom: 20px;">
      <div style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">
        <h3 style="margin: 0; color: #0f172a; font-size: 16px;">🔍 Detected Threats</h3>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 12px; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase;">Source</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase;">Type</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase;">Severity</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase;">Description</th>
          </tr>
        </thead>
        <tbody>
          ${threatsHTML}
        </tbody>
      </table>
    </div>
    
    <!-- Recommendations -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; margin-bottom: 20px;">
      <div style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">
        <h3 style="margin: 0; color: #0f172a; font-size: 16px;">📋 Recommendations</h3>
      </div>
      <div style="padding: 24px;">
        <ul style="list-style: none; margin: 0; padding: 0;">
          ${recommendationsHTML}
        </ul>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 20px;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        This alert was generated by TrustGuard Security Extension
      </p>
      <p style="color: #94a3b8; font-size: 11px; margin: 8px 0 0;">
        Generated at ${new Date().toLocaleString()}
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "TrustGuard <onboarding@resend.dev>",
      to: [email],
      subject: `🚨 Security Alert: ${riskLevel.toUpperCase()} risk detected on ${domain}`,
      html: emailHTML,
    });

    console.log("Threat alert email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-threat-alert function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
