import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRIES = 3;
const MAX_FAILURE_COUNT = 5; // Disable after this many consecutive failures

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    domain?: string;
    score?: number;
    riskLevel?: string;
    threats?: string[];
    message?: string;
  };
}

function formatSlackMessage(payload: WebhookPayload): object {
  const riskEmoji = {
    'critical': '🚨',
    'high': '⚠️',
    'medium': '⚡',
    'low': '💡',
    'safe': '✅'
  }[payload.data.riskLevel || 'medium'] || '📢';

  const color = {
    'critical': '#dc2626',
    'high': '#ea580c',
    'medium': '#ca8a04',
    'low': '#2563eb',
    'safe': '#16a34a'
  }[payload.data.riskLevel || 'medium'] || '#64748b';

  return {
    attachments: [{
      color,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${riskEmoji} TrustGuard Threat Alert`,
            emoji: true
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Domain:*\n${payload.data.domain || 'N/A'}`
            },
            {
              type: "mrkdwn",
              text: `*Trust Score:*\n${payload.data.score ?? 'N/A'}/100`
            },
            {
              type: "mrkdwn",
              text: `*Risk Level:*\n${(payload.data.riskLevel || 'unknown').toUpperCase()}`
            },
            {
              type: "mrkdwn",
              text: `*Event:*\n${payload.event}`
            }
          ]
        },
        ...(payload.data.threats && payload.data.threats.length > 0 ? [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Threats Detected:*\n${payload.data.threats.map(t => `• ${t}`).join('\n')}`
          }
        }] : []),
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Detected at ${new Date(payload.timestamp).toLocaleString()}`
            }
          ]
        }
      ]
    }]
  };
}

function formatDiscordMessage(payload: WebhookPayload): object {
  const color = {
    'critical': 0xdc2626,
    'high': 0xea580c,
    'medium': 0xca8a04,
    'low': 0x2563eb,
    'safe': 0x16a34a
  }[payload.data.riskLevel || 'medium'] || 0x64748b;

  return {
    embeds: [{
      title: "🛡️ TrustGuard Threat Alert",
      color,
      fields: [
        {
          name: "Domain",
          value: payload.data.domain || 'N/A',
          inline: true
        },
        {
          name: "Trust Score",
          value: `${payload.data.score ?? 'N/A'}/100`,
          inline: true
        },
        {
          name: "Risk Level",
          value: (payload.data.riskLevel || 'unknown').toUpperCase(),
          inline: true
        },
        ...(payload.data.threats && payload.data.threats.length > 0 ? [{
          name: "Threats Detected",
          value: payload.data.threats.map(t => `• ${t}`).join('\n'),
          inline: false
        }] : [])
      ],
      timestamp: payload.timestamp,
      footer: {
        text: `Event: ${payload.event}`
      }
    }]
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 30000;
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

async function sendDisabledNotificationEmail(
  supabase: any,
  userId: string,
  webhookName: string,
  webhookUrl: string,
  lastError: string
): Promise<void> {
  try {
    // Get user email from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('user_id', userId)
      .single();

    if (!profile?.email) {
      console.log('No email found for user, skipping disabled notification');
      return;
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured, skipping email notification');
      return;
    }

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Webhook Disabled</h1>
        </div>
        <div style="background: #1a1a2e; padding: 30px; border-radius: 0 0 12px 12px; color: #e2e8f0;">
          <p style="margin: 0 0 20px;">Hi ${profile.display_name || 'there'},</p>
          <p style="margin: 0 0 20px;">Your webhook <strong>"${webhookName}"</strong> has been automatically disabled after 5 consecutive delivery failures.</p>
          
          <div style="background: #0f0f1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px; color: #94a3b8; font-size: 14px;">Webhook URL:</p>
            <p style="margin: 0; font-family: monospace; word-break: break-all; color: #60a5fa;">${webhookUrl}</p>
            <p style="margin: 20px 0 10px; color: #94a3b8; font-size: 14px;">Last Error:</p>
            <p style="margin: 0; color: #f87171;">${lastError}</p>
          </div>
          
          <p style="margin: 20px 0;">To fix this:</p>
          <ol style="margin: 0 0 20px; padding-left: 20px; color: #94a3b8;">
            <li style="margin-bottom: 8px;">Check that your webhook endpoint is accessible and returning 2xx responses</li>
            <li style="margin-bottom: 8px;">Verify the URL is correct and the server is running</li>
            <li style="margin-bottom: 8px;">Re-enable the webhook in your TrustGuard settings</li>
          </ol>
          
          <a href="${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/settings" 
             style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
            Go to Settings
          </a>
        </div>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'TrustGuard <notifications@resend.dev>',
        to: profile.email,
        subject: `⚠️ Webhook "${webhookName}" has been disabled`,
        html: emailHtml
      })
    });

    if (!response.ok) {
      console.error('Failed to send disabled notification email:', await response.text());
    } else {
      console.log('Webhook disabled notification email sent to:', profile.email);
    }
  } catch (error) {
    console.error('Error sending disabled notification email:', error);
  }
}

async function logDeliveryAttempt(
  supabase: any,
  webhookId: string,
  userId: string,
  event: string,
  attemptNumber: number,
  success: boolean,
  statusCode: number | null,
  errorMessage: string | null,
  responseTimeMs: number | null
): Promise<void> {
  try {
    await supabase.from('webhook_delivery_logs').insert({
      webhook_id: webhookId,
      user_id: userId,
      event,
      attempt_number: attemptNumber,
      success,
      status_code: statusCode,
      error_message: errorMessage,
      response_time_ms: responseTimeMs
    });
  } catch (error) {
    console.error('Failed to log delivery attempt:', error);
  }
}

async function sendWithRetry(
  webhook: { id: string; name: string; type: string; url: string; secret?: string; failure_count?: number },
  payload: WebhookPayload,
  userId: string,
  supabase: any
): Promise<{ success: boolean; error?: string; attempts: number; disabled?: boolean }> {
  let lastError: string = '';
  let lastStatusCode: number | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const startTime = Date.now();
    
    try {
      if (attempt > 0) {
        const delay = getBackoffDelay(attempt - 1);
        console.log(`Webhook ${webhook.id}: Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms delay`);
        await sleep(delay);
      }

      let body: string;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (webhook.type === 'slack') {
        body = JSON.stringify(formatSlackMessage(payload));
      } else if (webhook.type === 'discord') {
        body = JSON.stringify(formatDiscordMessage(payload));
      } else {
        body = JSON.stringify(payload);
        if (webhook.secret) {
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(webhook.secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          );
          const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
          const signatureHex = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          headers['X-TrustGuard-Signature'] = signatureHex;
        }
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body
      });

      const responseTime = Date.now() - startTime;
      lastStatusCode = response.status;

      if (!response.ok) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        
        // Log the failed attempt
        await logDeliveryAttempt(
          supabase, webhook.id, userId, payload.event,
          attempt + 1, false, response.status, errorMsg, responseTime
        );

        if (response.status >= 500 || response.status === 429) {
          throw new Error(`${errorMsg} (retryable)`);
        }
        throw new Error(errorMsg);
      }

      // Success! Log and reset failure count
      await logDeliveryAttempt(
        supabase, webhook.id, userId, payload.event,
        attempt + 1, true, response.status, null, responseTime
      );

      await supabase
        .from('webhooks')
        .update({ 
          last_triggered_at: new Date().toISOString(),
          failure_count: 0
        })
        .eq('id', webhook.id);

      console.log(`Webhook ${webhook.id}: Success after ${attempt + 1} attempt(s)`);
      return { success: true, attempts: attempt + 1 };

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Webhook ${webhook.id} attempt ${attempt + 1} failed:`, lastError);
      
      // Log network errors
      if (!lastStatusCode) {
        await logDeliveryAttempt(
          supabase, webhook.id, userId, payload.event,
          attempt + 1, false, null, lastError, Date.now() - startTime
        );
      }
      
      if (lastError.includes('HTTP 4') && !lastError.includes('HTTP 429')) {
        break;
      }
    }
  }

  // All retries failed - update failure count
  const currentFailureCount = (webhook.failure_count || 0) + 1;
  const shouldDisable = currentFailureCount >= MAX_FAILURE_COUNT;

  await supabase
    .from('webhooks')
    .update({ 
      failure_count: currentFailureCount,
      ...(shouldDisable ? { enabled: false } : {})
    })
    .eq('id', webhook.id);

  if (shouldDisable) {
    console.warn(`Webhook ${webhook.id}: Disabled after ${currentFailureCount} consecutive failures`);
    // Send email notification about disabled webhook
    await sendDisabledNotificationEmail(supabase, userId, webhook.name, webhook.url, lastError);
  }

  return { 
    success: false, 
    error: lastError,
    attempts: MAX_RETRIES,
    disabled: shouldDisable
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { userId, event, data, webhookIds } = body;

    console.log('Webhook dispatch request:', { userId, event, webhookCount: webhookIds?.length });

    if (!userId || !event) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing userId or event' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let query = supabase
      .from('webhooks')
      .select('id, name, type, url, secret, events, failure_count')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (webhookIds && webhookIds.length > 0) {
      query = query.in('id', webhookIds);
    }

    const { data: webhooks, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch webhooks: ${fetchError.message}`);
    }

    if (!webhooks || webhooks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No webhooks configured', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const applicableWebhooks = webhooks.filter(w => 
      w.events.includes(event) || w.events.includes('*')
    );

    if (applicableWebhooks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No webhooks subscribed to this event', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: data || {}
    };

    const results = await Promise.all(
      applicableWebhooks.map(webhook => sendWithRetry(webhook, payload, userId, supabase))
    );

    const successCount = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success);
    const disabledCount = failures.filter(r => r.disabled).length;
    const totalAttempts = results.reduce((sum, r) => sum + r.attempts, 0);

    console.log('Webhook dispatch complete:', { 
      total: applicableWebhooks.length, 
      success: successCount, 
      failed: failures.length,
      disabled: disabledCount,
      totalAttempts
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failures.length,
        disabled: disabledCount,
        totalAttempts,
        errors: failures.length > 0 ? failures.map(f => f.error) : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook dispatch error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to dispatch webhooks' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
