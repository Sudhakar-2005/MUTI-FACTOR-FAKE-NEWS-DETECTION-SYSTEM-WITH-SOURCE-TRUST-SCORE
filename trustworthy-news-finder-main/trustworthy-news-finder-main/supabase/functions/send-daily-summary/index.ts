import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalysisRecord {
  id: string;
  input_type: string;
  input_value: string;
  final_score: number;
  rating: string;
  created_at: string;
  article_title: string | null;
}

interface Profile {
  user_id: string;
  email: string;
  display_name: string | null;
  daily_summary_enabled: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting daily summary job...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users with daily summary enabled
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, display_name, daily_summary_enabled")
      .eq("daily_summary_enabled", true)
      .not("email", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} users with daily summary enabled`);

    // Get yesterday's date range
    const now = new Date();
    const yesterdayStart = new Date(now);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(now);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    yesterdayEnd.setHours(23, 59, 59, 999);

    let emailsSent = 0;
    const errors: string[] = [];

    for (const profile of (profiles as Profile[]) || []) {
      if (!profile.email) continue;

      try {
        const { data: analyses, error: analysesError } = await supabase
          .from("analysis_history")
          .select("*")
          .eq("user_id", profile.user_id)
          .gte("created_at", yesterdayStart.toISOString())
          .lte("created_at", yesterdayEnd.toISOString())
          .order("created_at", { ascending: false });

        if (analysesError) {
          console.error(`Error fetching analyses for ${profile.user_id}:`, analysesError);
          continue;
        }

        if (!analyses || analyses.length === 0) {
          console.log(`No analyses yesterday for user ${profile.user_id}`);
          continue;
        }

        const typedAnalyses = analyses as AnalysisRecord[];
        const avgScore = Math.round(typedAnalyses.reduce((sum, a) => sum + a.final_score, 0) / typedAnalyses.length);
        const trustworthyCount = typedAnalyses.filter(a => a.final_score >= 70).length;
        const flaggedCount = typedAnalyses.filter(a => a.final_score < 40).length;

        const html = generateDailySummaryEmail(
          profile.display_name || profile.email.split("@")[0],
          typedAnalyses,
          avgScore,
          trustworthyCount,
          flaggedCount
        );

        const { error: emailError } = await resend.emails.send({
          from: "TrustGuard <onboarding@resend.dev>",
          to: [profile.email],
          subject: `Daily Summary: ${typedAnalyses.length} analyses yesterday`,
          html,
        });

        if (emailError) {
          console.error(`Failed to send to ${profile.email}:`, emailError);
          errors.push(`${profile.email}: ${emailError.message}`);
        } else {
          console.log(`Daily summary sent to ${profile.email}`);
          emailsSent++;
        }
      } catch (userError) {
        console.error(`Error for user ${profile.user_id}:`, userError);
        errors.push(`${profile.email}: ${userError}`);
      }
    }

    console.log(`Daily summary complete. Sent ${emailsSent} emails.`);

    return new Response(
      JSON.stringify({ success: true, emailsSent, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in daily summary:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

function generateDailySummaryEmail(
  name: string,
  analyses: AnalysisRecord[],
  avgScore: number,
  trustworthyCount: number,
  flaggedCount: number
): string {
  const scoreColor = avgScore >= 70 ? "#22c55e" : avgScore >= 40 ? "#eab308" : "#ef4444";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">📰 Your Daily Summary</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">${dateStr}</p>
    </div>
    
    <div style="padding: 24px;">
      <p style="color: #475569; margin: 0 0 20px;">Hi ${name}, here's what you analyzed yesterday:</p>
      
      <div style="display: flex; gap: 12px; margin-bottom: 24px;">
        <div style="flex: 1; background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #3b82f6;">${analyses.length}</div>
          <div style="color: #64748b; font-size: 12px;">Analyzed</div>
        </div>
        <div style="flex: 1; background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: ${scoreColor};">${avgScore}</div>
          <div style="color: #64748b; font-size: 12px;">Avg Score</div>
        </div>
      </div>
      
      <div style="display: flex; gap: 8px; margin-bottom: 24px;">
        <div style="flex: 1; background: #dcfce7; padding: 10px; border-radius: 6px; text-align: center;">
          <span style="font-weight: bold; color: #166534;">${trustworthyCount}</span>
          <span style="color: #166534; font-size: 12px;"> trustworthy</span>
        </div>
        <div style="flex: 1; background: #fee2e2; padding: 10px; border-radius: 6px; text-align: center;">
          <span style="font-weight: bold; color: #991b1b;">${flaggedCount}</span>
          <span style="color: #991b1b; font-size: 12px;"> flagged</span>
        </div>
      </div>
      
      <h3 style="color: #1e293b; margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Recent Analyses</h3>
      
      ${analyses.slice(0, 5).map(a => {
        const itemColor = a.final_score >= 70 ? "#22c55e" : a.final_score >= 40 ? "#eab308" : "#ef4444";
        const title = a.article_title || (a.input_type === 'url' ? new URL(a.input_value).hostname : a.input_value.substring(0, 50) + '...');
        return `
        <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #334155; font-size: 14px; max-width: 80%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</span>
            <span style="background: ${itemColor}20; color: ${itemColor}; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">${a.final_score}</span>
          </div>
        </div>
        `;
      }).join('')}
      
      ${analyses.length > 5 ? `<p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 12px;">+ ${analyses.length - 5} more analyses</p>` : ''}
    </div>
    
    <div style="background: #f1f5f9; padding: 16px; text-align: center;">
      <p style="margin: 0; color: #64748b; font-size: 11px;">
        Manage preferences in TrustGuard settings
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

serve(handler);
