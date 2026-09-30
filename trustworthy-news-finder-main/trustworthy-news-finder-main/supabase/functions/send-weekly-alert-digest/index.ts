import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface AlertEntry {
  channel: string;
  message: string;
  timestamp: number;
  domain?: string;
}

interface GroupedAlerts {
  byDomain: Record<string, AlertEntry[]>;
  byChannel: Record<string, AlertEntry[]>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, displayName, alerts } = await req.json() as {
      email: string;
      displayName?: string;
      alerts: AlertEntry[];
    };

    if (!email || !alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No email or alerts provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group alerts by domain and channel
    const grouped: GroupedAlerts = { byDomain: {}, byChannel: {} };

    for (const alert of alerts) {
      // Extract domain from message
      const domainMatch = alert.message.match(/(?:domain|score drop|watchlist|scan).*?([a-z0-9-]+\.[a-z]{2,})/i);
      const domain = alert.domain || (domainMatch ? domainMatch[1] : 'Unknown');

      if (!grouped.byDomain[domain]) grouped.byDomain[domain] = [];
      grouped.byDomain[domain].push(alert);

      const ch = alert.channel || 'other';
      if (!grouped.byChannel[ch]) grouped.byChannel[ch] = [];
      grouped.byChannel[ch].push(alert);
    }

    const name = displayName || 'User';
    const totalAlerts = alerts.length;
    const domainCount = Object.keys(grouped.byDomain).length;
    const channelCounts = Object.entries(grouped.byChannel)
      .map(([ch, arr]) => `${ch}: ${arr.length}`)
      .join(' · ');

    const channelIcons: Record<string, string> = {
      browser: '🌐',
      email: '📧',
      sound: '🔊',
      watchlist: '👁️',
      other: '🔔',
    };

    const domainSections = Object.entries(grouped.byDomain)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([domain, domAlerts]) => {
        const rows = domAlerts.slice(0, 10).map(a => {
          const time = new Date(a.timestamp).toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
          const icon = channelIcons[a.channel] || '🔔';
          return `<tr>
            <td style="padding:6px 10px;font-size:12px;color:#94a3b8;">${icon} ${a.channel}</td>
            <td style="padding:6px 10px;font-size:12px;color:#e2e8f0;">${a.message}</td>
            <td style="padding:6px 10px;font-size:12px;color:#64748b;white-space:nowrap;">${time}</td>
          </tr>`;
        }).join('');
        return `
          <div style="margin-bottom:20px;">
            <div style="padding:10px 14px;background:rgba(45,212,191,0.08);border-radius:10px 10px 0 0;border-bottom:2px solid rgba(45,212,191,0.2);">
              <span style="font-size:14px;font-weight:600;color:#fff;">🌐 ${domain}</span>
              <span style="float:right;font-size:12px;color:#64748b;">${domAlerts.length} alert${domAlerts.length > 1 ? 's' : ''}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.02);border-radius:0 0 10px 10px;">
              ${rows}
            </table>
          </div>`;
      }).join('');

    const channelSummary = Object.entries(grouped.byChannel)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([ch, arr]) => {
        const icon = channelIcons[ch] || '🔔';
        const pct = Math.round((arr.length / totalAlerts) * 100);
        return `
          <div style="text-align:center;padding:12px;background:rgba(45,212,191,0.08);border-radius:10px;">
            <div style="font-size:20px;">${icon}</div>
            <div style="font-size:22px;font-weight:700;color:#2dd4bf;">${arr.length}</div>
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;">${ch} (${pct}%)</div>
          </div>`;
      }).join('');

    const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0f18;color:#e2e8f0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(45,212,191,0.1);border-radius:10px;">
        <span style="font-size:22px;">🛡️</span>
        <span style="font-size:16px;font-weight:700;color:#2dd4bf;">TrustGuard Weekly Alert Digest</span>
      </div>
    </div>

    <h1 style="color:#fff;font-size:22px;margin-bottom:6px;">Hi ${name}!</h1>
    <p style="color:#94a3b8;margin-bottom:24px;">Here's your weekly summary of all alerts fired across your monitored domains.</p>

    <!-- Overview -->
    <div style="background:rgba(255,255,255,0.05);border-radius:14px;padding:20px;margin-bottom:20px;">
      <h2 style="color:#fff;font-size:14px;margin:0 0 14px;text-transform:uppercase;letter-spacing:0.5px;">Overview</h2>
      <div style="display:flex;gap:12px;text-align:center;">
        <div style="flex:1;padding:14px;background:rgba(45,212,191,0.1);border-radius:10px;">
          <div style="font-size:28px;font-weight:700;color:#2dd4bf;">${totalAlerts}</div>
          <div style="font-size:10px;color:#94a3b8;">Total Alerts</div>
        </div>
        <div style="flex:1;padding:14px;background:rgba(45,212,191,0.1);border-radius:10px;">
          <div style="font-size:28px;font-weight:700;color:#2dd4bf;">${domainCount}</div>
          <div style="font-size:10px;color:#94a3b8;">Domains</div>
        </div>
        <div style="flex:1;padding:14px;background:rgba(45,212,191,0.1);border-radius:10px;">
          <div style="font-size:28px;font-weight:700;color:#2dd4bf;">${Object.keys(grouped.byChannel).length}</div>
          <div style="font-size:10px;color:#94a3b8;">Channels</div>
        </div>
      </div>
    </div>

    <!-- By Channel -->
    <div style="background:rgba(255,255,255,0.05);border-radius:14px;padding:20px;margin-bottom:20px;">
      <h2 style="color:#fff;font-size:14px;margin:0 0 14px;text-transform:uppercase;letter-spacing:0.5px;">Alerts by Channel</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;">
        ${channelSummary}
      </div>
    </div>

    <!-- By Domain -->
    <div style="background:rgba(255,255,255,0.05);border-radius:14px;padding:20px;margin-bottom:20px;">
      <h2 style="color:#fff;font-size:14px;margin:0 0 14px;text-transform:uppercase;letter-spacing:0.5px;">Alerts by Domain</h2>
      ${domainSections}
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-top:28px;">
      <a href="https://trustguard.app/history" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#2dd4bf,#14b8a6);color:#0a0f18;text-decoration:none;border-radius:10px;font-weight:600;">View Full History</a>
    </div>

    <div style="text-align:center;margin-top:36px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);">
      <p style="color:#64748b;font-size:11px;">
        Weekly alert digest · ${channelCounts}<br>
        <a href="https://trustguard.app" style="color:#2dd4bf;text-decoration:none;">trustguard.app</a>
      </p>
    </div>
  </div>
</body></html>`;

    const { error: emailError } = await resend.emails.send({
      from: 'TrustGuard <digest@resend.dev>',
      to: [email],
      subject: `Weekly Alert Digest: ${totalAlerts} alerts across ${domainCount} domains`,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Email send error:', emailError);
      return new Response(
        JSON.stringify({ success: false, error: emailError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-weekly-alert-digest:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
