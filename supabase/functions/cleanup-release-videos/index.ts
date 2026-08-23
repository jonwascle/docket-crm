// This runs on Supabase's servers, on a daily schedule (see the cron
// migration), never triggered from the browser.
//
// Release-demo recordings (the video an admin makes while announcing a
// new feature or fix) are kept for 60 days so people have plenty of time
// to go back and watch them — then this quietly deletes the video file
// to save storage. The text transcript is never touched here; it stays
// permanently.
//
// No secrets of its own needed — uses the same service role key as the
// other functions (SB_SECRET_KEY).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SB_SECRET_KEY');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const { data: dueRows, error: fetchErr } = await adminClient
      .from('feature_requests')
      .select('id, release_video_path')
      .not('release_video_path', 'is', null)
      .lt('release_video_uploaded_at', cutoff);

    if (fetchErr) {
      return json({ error: fetchErr.message }, 500);
    }

    let deleted = 0;
    for (const row of (dueRows || [])) {
      try {
        await adminClient.storage.from('feature-request-media').remove([row.release_video_path]);
        await adminClient.from('feature_requests').update({ release_video_path: null }).eq('id', row.id);
        deleted++;
      } catch (e) {
        console.error('Could not clean up release video for', row.id, e);
      }
    }

    return json({ success: true, checked: (dueRows || []).length, deleted }, 200);
  } catch (e) {
    return json({ error: e.message || 'Unknown error.' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}