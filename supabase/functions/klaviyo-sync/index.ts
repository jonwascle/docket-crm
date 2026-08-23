// This runs on Supabase's servers, never in the browser — so the
// Klaviyo API key is never exposed to the app itself.
//
// Handles two things:
//   'sync_contact'  - creates/updates a Klaviyo profile for a contact
//                     (used whenever a new contact is added in Dockit)
//   'track_event'   - records a named event against a profile, which
//                     can then trigger Klaviyo flows/automations
//                     (used for quote sent, customer live, deal won)
//
// Needs one secret (Supabase -> Edge Functions -> klaviyo-sync ->
// Settings -> Secrets):
//   KLAVIYO_PRIVATE_API_KEY   - your Private API Key from Klaviyo
//                               (Account -> Settings -> API Keys —
//                               NOT the public site ID)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Klaviyo requires a specific API revision date on every request. If
// Klaviyo ever rejects this with a revision-related error, check their
// current docs (developers.klaviyo.com) for the latest valid date and
// update this constant.
const KLAVIYO_REVISION = '2024-10-15';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('KLAVIYO_PRIVATE_API_KEY');
    if (!apiKey) {
      return json({ error: 'KLAVIYO_PRIVATE_API_KEY is not set on this function yet — add it in Supabase.' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const { action, email, name, phone, organisation } = body;

    if (!email) return json({ error: 'Missing email — Klaviyo profiles are identified by email.' }, 400);

    const klaviyoHeaders = {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'revision': KLAVIYO_REVISION,
    };

    const profileAttributes = { email };
    if (name) {
      const parts = name.trim().split(' ');
      profileAttributes.first_name = parts[0];
      if (parts.length > 1) profileAttributes.last_name = parts.slice(1).join(' ');
    }
    if (phone) profileAttributes.phone_number = phone;
    if (organisation) profileAttributes.properties = { organisation };

    if (action === 'sync_contact') {
      const res = await fetch('https://a.klaviyo.com/api/profile-import/', {
        method: 'POST',
        headers: klaviyoHeaders,
        body: JSON.stringify({ data: { type: 'profile', attributes: profileAttributes } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return json({ error: 'Klaviyo error syncing contact', details: data }, res.status);
      return json({ success: true }, 200);
    }

    if (action === 'track_event') {
      const { eventName, eventProperties } = body;
      if (!eventName) return json({ error: 'Missing eventName.' }, 400);

      const res = await fetch('https://a.klaviyo.com/api/events/', {
        method: 'POST',
        headers: klaviyoHeaders,
        body: JSON.stringify({
          data: {
            type: 'event',
            attributes: {
              properties: eventProperties || {},
              metric: { data: { type: 'metric', attributes: { name: eventName } } },
              profile: { data: { type: 'profile', attributes: profileAttributes } },
              time: new Date().toISOString(),
            },
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return json({ error: 'Klaviyo error tracking event', details: data }, res.status);
      return json({ success: true }, 200);
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: e.message || 'Unknown error.' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}