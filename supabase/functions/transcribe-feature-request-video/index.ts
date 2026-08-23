// This runs on Supabase's servers, never in the browser.
//
// Called after a screen recording is uploaded — either the original
// bug/feature submission, or a release-demo recording an admin made
// while announcing something new. Downloads the video from private
// storage, sends it to OpenAI's Whisper API to transcribe the spoken
// audio, and saves the resulting text — so even after the video itself
// gets deleted (submission videos delete immediately on release;
// release-demo videos delete automatically after 60 days), what was
// actually said is kept permanently.
//
// Needs one secret of its own (Supabase -> Edge Functions ->
// transcribe-feature-request-video -> Settings -> Secrets):
//   OPENAI_API_KEY   - a real API key from platform.openai.com (separate
//                      account and billing from the Anthropic one used
//                      for Ask AI)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SB_SECRET_KEY');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return json({ error: 'Missing authorization header.' }, 401);
    const { data: { user } } = await adminClient.auth.getUser(token);
    if (!user) return json({ error: 'Not signed in.' }, 401);

    const body = await req.json().catch(() => ({}));
    const { requestId, videoField } = body;
    if (!requestId) return json({ error: 'Missing requestId.' }, 400);

    // Which pair of columns to work with — the original submission
    // recording, or a release-demo recording made while announcing
    // something. Defaults to the submission one for backwards
    // compatibility with existing calls.
    const isRelease = videoField === 'release';
    const pathCol = isRelease ? 'release_video_path' : 'video_path';
    const transcriptCol = isRelease ? 'release_video_transcript' : 'video_transcript';
    const statusCol = isRelease ? 'release_video_transcript_status' : 'video_transcript_status';

    const { data: reqRow, error: reqErr } = await adminClient
      .from('feature_requests').select(pathCol).eq('id', requestId).single();
    if (reqErr || !reqRow || !reqRow[pathCol]) {
      return json({ error: 'No video found for this request.' }, 404);
    }

    await adminClient.from('feature_requests').update({ [statusCol]: 'processing' }).eq('id', requestId);

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      await adminClient.from('feature_requests').update({ [statusCol]: 'failed' }).eq('id', requestId);
      return json({ error: 'Transcription isn\'t set up yet — ask an admin to add the OPENAI_API_KEY secret in Supabase.' }, 400);
    }

    const { data: fileBlob, error: downloadErr } = await adminClient.storage
      .from('feature-request-media').download(reqRow[pathCol]);
    if (downloadErr || !fileBlob) {
      await adminClient.from('feature_requests').update({ [statusCol]: 'failed' }).eq('id', requestId);
      return json({ error: 'Could not read the video from storage.' }, 500);
    }

    const formData = new FormData();
    formData.append('file', fileBlob, 'recording.webm');
    formData.append('model', 'whisper-1');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      await adminClient.from('feature_requests').update({ [statusCol]: 'failed' }).eq('id', requestId);
      return json({ error: 'Transcription failed: ' + errText }, 500);
    }

    const whisperData = await whisperRes.json();
    const transcript = whisperData.text || '';

    await adminClient.from('feature_requests').update({
      [transcriptCol]: transcript,
      [statusCol]: 'done'
    }).eq('id', requestId);

    return json({ success: true, transcript }, 200);
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