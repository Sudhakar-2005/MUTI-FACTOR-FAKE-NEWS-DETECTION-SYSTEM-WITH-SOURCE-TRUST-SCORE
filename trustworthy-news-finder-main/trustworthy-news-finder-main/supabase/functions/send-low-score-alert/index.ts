import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertRequest {
  user_id: string;
  score: number;
  title: string;
  url?: string;
  rating: string;
  is_test?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, score, title, url, rating, is_test }: AlertRequest = await req.json();
    
    console.log(`Low score alert triggered for user ${user_id}, score: ${score}, is_test: ${is_test}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile and preferences
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, display_name, low_score_alerts_enabled, low_score_threshold")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw profileError;
    }

    if (!profile || !profile.email) {
      console.log("No profile or email found");
      return new Response(
        JSON.stringify({ success: false, reason: "no_email" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // For test emails, skip threshold check but still check if alerts are enabled
    if (!is_test) {
      // Check if alerts are enabled and score is below threshold
      if (!profile.low_score_alerts_enabled) {
        console.log("Low score alerts disabled for user");
        return new Response(
          JSON.stringify({ success: false, reason: "alerts_disabled" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const threshold = profile.low_score_threshold ?? 40;
      if (score >= threshold) {
        console.log(`Score ${score} is above threshold ${threshold}`);
        return new Response(
          JSON.stringify({ success: false, reason: "above_threshold" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    const threshold = profile.low_score_threshold ?? 40;

    const html = generateAlertEmail(
      profile.display_name || profile.email.split("@")[0],
      score,
      title,
      url,
      rating,
      threshold
    );

    const { error: emailError } = await resend.emails.send({
      from: "TrustGuard Alert <onboarding@resend.dev>",
      to: [profile.email],
      subject: `⚠️ Low Trust Score Alert: ${score}/100`,
      html,
    });

    if (emailError) {
      console.error("Failed to send alert email:", emailError);
      throw emailError;
    }

    console.log(`Alert email sent to ${profile.email}`);

    // Create in-app notification
    const notificationMessage = is_test
      ? `This is a test notification. Your email alerts are working correctly!`
      : `"${title}" scored ${score}/100 - rated as ${rating}. Verify before sharing.`;

    const { error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id,
        type: is_test ? "test" : "low_score_alert",
        title: is_test ? "Test Alert Successful! ✅" : `Low Trust Score: ${score}/100`,
        message: notificationMessage,
        metadata: { score, title, url, rating, is_test },
      });

    if (notifError) {
      console.error("Failed to create notification:", notifError);
      // Don't throw - notification is secondary to email
    } else {
      console.log("In-app notification created");
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: true, notification_created: !notifError }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in low score alert:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

function generateAlertEmail(
  name: string,
  score: number,
  title: string,
  url: string | undefined,
  rating: string,
  threshold: number
): string {
  const ratingColor = score < 25 ? "#dc2626" : "#f59e0b";
  const ratingBg = score < 25 ? "#fef2f2" : "#fffbeb";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 24px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 8px;">⚠️</div>
      <h1 style="color: white; margin: 0; font-size: 22px;">Low Trust Score Alert</h1>
    </div>
    
    <div style="padding: 24px;">
      <p style="color: #475569; margin: 0 0 20px;">Hi ${name}, you just analyzed content that scored below your threshold of ${threshold}:</p>
      
      <div style="background: ${ratingBg}; border: 2px solid ${ratingColor}; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <div style="font-size: 48px; font-weight: bold; color: ${ratingColor};">${score}</div>
          <div style="color: ${ratingColor}; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">${rating}</div>
        </div>
        
        <div style="border-top: 1px solid ${ratingColor}40; padding-top: 16px;">
          <p style="margin: 0 0 8px; color: #1e293b; font-weight: 600;">${title}</p>
          ${url ? `<p style="margin: 0; color: #64748b; font-size: 12px; word-break: break-all;">${url}</p>` : ''}
        </div>
      </div>
      
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px;">
        <h3 style="margin: 0 0 8px; color: #1e293b; font-size: 14px;">🛡️ What to do:</h3>
        <ul style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 14px;">
          <li style="margin-bottom: 4px;">Verify claims with trusted news sources</li>
          <li style="margin-bottom: 4px;">Check if the source has a known bias</li>
          <li style="margin-bottom: 4px;">Look for citations and evidence</li>
          <li>Be cautious before sharing</li>
        </ul>
      </div>
    </div>
    
    <div style="background: #f1f5f9; padding: 16px; text-align: center;">
      <p style="margin: 0; color: #64748b; font-size: 11px;">
        You're receiving this because you have low score alerts enabled (threshold: ${threshold}).<br>
        Manage preferences in TrustGuard settings.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

serve(handler);
