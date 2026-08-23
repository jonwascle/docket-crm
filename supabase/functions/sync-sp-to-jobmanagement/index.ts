// Supabase Edge Function: sync-sp-to-jobmanagement
//
// Called from Dockit (index.html) when a service provider is marked
// "Entered on Wapp". Forwards the provider's onboarding data to the
// jobmanagement (Wapp) API. The shared API key is kept here as a
// Supabase secret and never reaches the browser.
//
// Deploy: supabase functions deploy sync-sp-to-jobmanagement
// Secrets required (set once):
//   supabase secrets set JOBMANAGEMENT_IMPORT_ENDPOINT=https://<wapp-domain>/api/service-providers/import
//   supabase secrets set JOBMANAGEMENT_IMPORT_API_KEY=<the shared key jobmanagement generated>

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const endpoint = Deno.env.get('JOBMANAGEMENT_IMPORT_ENDPOINT');
    const apiKey = Deno.env.get('JOBMANAGEMENT_IMPORT_API_KEY');

    if (!endpoint || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Jobmanagement import is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await req.json();

    const wappRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(payload),
    });

    const wappData = await wappRes.json().catch(() => ({}));

    return new Response(JSON.stringify(wappData), {
      status: wappRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: 'Could not reach jobmanagement' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
