import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting daily rate limit reset...');

    // Reset all API key request counters to 0
    const { data, error } = await supabase
      .from('api_keys')
      .update({ requests_today: 0 })
      .neq('requests_today', 0)
      .select('id');

    if (error) {
      throw new Error(`Failed to reset rate limits: ${error.message}`);
    }

    const resetCount = data?.length || 0;
    console.log(`Rate limits reset for ${resetCount} API keys`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Reset rate limits for ${resetCount} API keys`,
        reset_count: resetCount,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rate limit reset error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to reset rate limits' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
