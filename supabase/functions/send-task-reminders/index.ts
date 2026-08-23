// This runs on Supabase's servers, never in the browser.
//
// It's called two different ways:
//  1. By Dockit itself, right when a task is assigned to someone — sends
//     one immediate email for that specific task.
//  2. By a scheduled job (see the cron setup in the deployment notes) once
//     a day — checks every open, assigned task and emails anyone whose
//     task hasn't had a reminder in 2+ days.
//
// ============================================================================
// TODO before this can send real emails — one thing your dev team needs to
// fill in: which email service you're using.
//
// This is written for SMTP2GO (https://www.smtp2go.com), since that's
// what Wascle already has an account and verified sending domain with.
// You'll need to set two settings on this function (Supabase -> Edge
// Functions -> send-task-reminders -> Settings -> Secrets):
//   SMTP2GO_API_KEY    - the API key from SMTP2GO
//   TASK_EMAIL_FROM    - the verified "from" address, e.g.
//                        "Dockit <tasks@wascle.co.uk>"
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REMINDER_GAP_MS = 2 * 24 * 60 * 60 * 1000; // "every other day" for ordinary open tasks
const URGENT_REMINDER_GAP_MS = 24 * 60 * 60 * 1000; // daily, for anything overdue or due very soon

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

    // Two ways to call this function: the scheduled sweep authenticates as
    // the service role itself (see the cron setup); a one-off "just
    // assigned this" call from the app authenticates as the signed-in user.
    const isScheduledSweep = token && token === serviceRoleKey;
    const body = await req.json().catch(() => ({}));

    if (!isScheduledSweep) {
      if (!token) {
        return json({ error: 'Missing authorization header.' }, 401);
      }
      const { data: { user }, error: userErr } = await adminClient.auth.getUser(token);
      if (userErr || !user) {
        return json({ error: 'Not signed in.' }, 401);
      }
      if (!body.taskId) {
        return json({ error: 'Missing taskId.' }, 400);
      }
    }

    const appUrl = Deno.env.get('DOCKIT_APP_URL') || 'https://dockit-wascle.vercel.app';
    let tasksToNotify;

    if (body.taskId) {
      // A specific task — someone was just assigned to it, send now
      // regardless of when it last got a reminder.
      const { data, error } = await adminClient.from('tasks').select('*').eq('id', body.taskId).single();
      if (error || !data) {
        return json({ error: 'Task not found.' }, 404);
      }
      tasksToNotify = (data.status === 'done' || !data.assigned_to) ? [] : [data];
    } else {
      // The scheduled sweep. Ordinary open tasks still get the "every
      // couple of days" cadence — but a task that's overdue, or due
      // today/tomorrow, gets reminded about daily instead, since that's
      // exactly the moment a nudge is actually useful.
      const normalCutoff = new Date(Date.now() - REMINDER_GAP_MS).toISOString();
      const urgentCutoff = new Date(Date.now() - URGENT_REMINDER_GAP_MS).toISOString();
      const today = new Date().toISOString().slice(0,10);
      const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().slice(0,10);

      const { data, error } = await adminClient
        .from('tasks')
        .select('*')
        .eq('status', 'todo')
        .not('assigned_to', 'is', null);
      if (error) {
        return json({ error: error.message }, 500);
      }
      tasksToNotify = (data || []).filter(t => {
        const isUrgent = t.due_date && t.due_date <= tomorrow;
        const cutoff = isUrgent ? urgentCutoff : normalCutoff;
        return !t.last_reminder_sent_at || t.last_reminder_sent_at < cutoff;
      });
    }

    const results = [];
    for (const task of tasksToNotify) {
      const { data: assignee } = await adminClient
        .from('profiles').select('email, name').eq('id', task.assigned_to).single();
      if (!assignee || !assignee.email) continue;

      const link = `${appUrl}/#task=${task.id}`;
      const today = new Date().toISOString().slice(0,10);
      const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().slice(0,10);
      let urgencyBanner = '';
      if (task.due_date && task.due_date < today) {
        urgencyBanner = `<p style="background:#FBE9E7;color:#C0392B;padding:10px 14px;border-radius:6px;font-weight:600;margin:0 0 16px;">⚠ This task is overdue — it was due ${new Date(task.due_date).toLocaleDateString('en-GB')}.</p>`;
      } else if (task.due_date === today) {
        urgencyBanner = `<p style="background:#FDF6E7;color:#B8860B;padding:10px 14px;border-radius:6px;font-weight:600;margin:0 0 16px;">This task is due today.</p>`;
      } else if (task.due_date === tomorrow) {
        urgencyBanner = `<p style="background:#FDF6E7;color:#B8860B;padding:10px 14px;border-radius:6px;font-weight:600;margin:0 0 16px;">This task is due tomorrow.</p>`;
      }
      const html = `
        <p>Hi ${escapeHtmlServer(assignee.name || 'there')},</p>
        <p>You've got an open task in Dockit:</p>
        <p style="font-size:16px;font-weight:600;margin:16px 0 4px;">${escapeHtmlServer(task.title)}</p>
        ${task.notes ? `<p style="color:#555;margin:0 0 16px;">${escapeHtmlServer(task.notes)}</p>` : ''}
        ${urgencyBanner}
        <p><a href="${link}" style="display:inline-block;background:#1B1B1B;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">View this task in Dockit</a></p>
        <p style="color:#999;font-size:12px;margin-top:24px;">You'll get a reminder like this every couple of days until it's marked done — daily if it's overdue or due very soon.</p>
      `;

      const sendResult = await sendEmail(assignee.email, `Task: ${task.title}`, html);
      if (!sendResult.error) {
        await adminClient.from('tasks').update({ last_reminder_sent_at: new Date().toISOString() }).eq('id', task.id);
      }
      results.push({ taskId: task.id, email: assignee.email, ...sendResult });
    }

    return json({ success: true, notified: results.length, results }, 200);
  } catch (e) {
    return json({ error: e.message || 'Unknown error.' }, 500);
  }
});

// The one function to swap out if you're using a different email provider.
async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('SMTP2GO_API_KEY');
  const fromAddress = Deno.env.get('TASK_EMAIL_FROM');
  if (!apiKey || !fromAddress) {
    return { error: 'Email service is not configured yet (missing SMTP2GO_API_KEY or TASK_EMAIL_FROM).' };
  }
  const res = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      sender: fromAddress,
      to: [to],
      subject,
      html_body: html,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.data?.succeeded !== 1) {
    return { error: (data && JSON.stringify(data)) || await res.text() };
  }
  return { success: true };
}

function escapeHtmlServer(str: string) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}