// This runs on Supabase's servers, never in the browser.
// It's the only piece of Docket allowed to hold the powerful "service role"
// key — that's why creating, editing, or deleting logins can't just happen
// directly from the website.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LOGO_JPEG_BASE64 = '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';

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header.' }, 401);
    }
    const token = authHeader.replace('Bearer ', '').trim();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SB_SECRET_KEY');
    console.log('DEBUG supabaseUrl present:', !!supabaseUrl);
    console.log('DEBUG serviceRoleKey present:', !!serviceRoleKey, serviceRoleKey ? '(starts ' + serviceRoleKey.slice(0,10) + ')' : '');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    let user, userErr;
    try {
      const result = await adminClient.auth.getUser(token);
      user = result.data.user;
      userErr = result.error;
    } catch (thrown) {
      console.log('DEBUG getUser THREW an exception:', thrown.message || JSON.stringify(thrown));
      return json({ error: 'Auth check threw: ' + (thrown.message || 'unknown') }, 500);
    }
    console.log('DEBUG token (first 30 chars):', token ? token.slice(0, 30) : 'none');
    console.log('DEBUG userErr:', userErr ? JSON.stringify(userErr) : 'none');
    console.log('DEBUG user found:', user ? user.id : 'none');
    if (userErr || !user) {
      return json({ error: 'Not signed in.' }, 401);
    }

    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles').select('role').eq('id', user.id).single();

    if (profileErr || !callerProfile) {
      return json({ error: 'Could not verify your account.' }, 403);
    }

    // Managers and admins can create new logins; only admins can edit or
    // delete an existing one, or create another admin/manager account.
    if (callerProfile.role !== 'manager' && callerProfile.role !== 'admin') {
      return json({ error: 'Only managers and admins can manage team members.' }, 403);
    }

    const body = await req.json();
    const action = body.action || 'create';

    if (action === 'create') {
      const { email, name } = body;
      let { role } = body;

      // Managers can only ever create user-level logins — even if the
      // request tries to ask for something else, it's overridden here.
      if (callerProfile.role === 'manager') {
        if (role && role !== 'user') {
          return json({ error: 'Managers can only create logins with the "user" role.' }, 403);
        }
        role = 'user';
      }

      if (!email || !name) {
        return json({ error: 'Name and email are required.' }, 400);
      }

      // A password still has to be set to create the underlying auth
      // user — but nobody ever uses this one. It's immediately replaced
      // the moment the new team member sets their own via the welcome
      // email link below.
      const tempPassword = crypto.randomUUID() + crypto.randomUUID();

      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: name || '' },
      });
      if (createErr) {
        return json({ error: createErr.message }, 400);
      }

      await adminClient.from('profiles')
        .update({ ...(role ? { role } : {}), name, must_reset_password: true })
        .eq('id', newUser.user.id);

      try {
        const { data: linkRow } = await adminClient
          .from('password_setup_tokens').insert({ user_id: newUser.user.id }).select('token').single();
        if (linkRow) {
          const origin = req.headers.get('origin') || 'https://docket-wascle.vercel.app';
          const setupLink = origin + '/#set-password=' + linkRow.token;
          await sendWelcomeEmail(email, name, setupLink);
        }
      } catch (emailErr) {
        // A problem sending the welcome email shouldn't stop the account
        // from having been created successfully.
        console.error('Welcome email failed:', emailErr);
      }

      return json({ success: true }, 200);
    }

    if (action === 'update') {
      if (callerProfile.role !== 'admin') {
        return json({ error: 'Only admins can edit an existing team member.' }, 403);
      }
      const { userId, name, email, password, role } = body;
      if (!userId) {
        return json({ error: 'Missing userId.' }, 400);
      }
      if (password && password.length < 6) {
        return json({ error: 'New password must be at least 6 characters.' }, 400);
      }

      // Changes that touch the login itself (email/password) go through the
      // admin auth API — this is the part that needs the privileged key.
      const authUpdates = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      if (Object.keys(authUpdates).length > 0) {
        const { error: authErr } = await adminClient.auth.admin.updateUserById(userId, authUpdates);
        console.log('DEBUG authErr on updateUserById:', authErr ? JSON.stringify(authErr) : 'none');
        if (authErr) {
          return json({ error: authErr.message }, 400);
        }
      }

      // Name, email, and role are also mirrored on the profiles table.
      const profileUpdates = {};
      if (name !== undefined) profileUpdates.name = name;
      if (email) profileUpdates.email = email;
      if (role) profileUpdates.role = role;
      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileUpdateErr } = await adminClient
          .from('profiles').update(profileUpdates).eq('id', userId);
        console.log('DEBUG profileUpdateErr:', profileUpdateErr ? JSON.stringify(profileUpdateErr) : 'none');
        if (profileUpdateErr) {
          return json({ error: profileUpdateErr.message }, 400);
        }
      }

      return json({ success: true }, 200);
    }

    if (action === 'delete') {
      if (callerProfile.role !== 'admin') {
        return json({ error: 'Only admins can delete a team member.' }, 403);
      }
      const { userId } = body;
      if (!userId) {
        return json({ error: 'Missing userId.' }, 400);
      }
      if (userId === user.id) {
        return json({ error: "You can't delete your own login while signed in as them." }, 400);
      }
      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);
      console.log('DEBUG deleteErr on deleteUser:', deleteErr ? JSON.stringify(deleteErr) : 'none');
      if (deleteErr) {
        return json({ error: deleteErr.message }, 400);
      }
      return json({ success: true }, 200);
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: e.message || 'Unknown error.' }, 500);
  }
});

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sendWelcomeEmail(email: string, name: string, setupLink: string) {
  const greetingName = escapeHtmlServer((name || '').split(' ')[0] || 'there');
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body style="margin:0;padding:0;">
  <div style="font-family: Arial, sans-serif; background-color: #F7F5F0; padding: 32px 16px;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E5E1D8; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
      <div style="background-color: #FFFFFF; padding: 26px 32px; border-bottom: 1px solid #F0EBDD;">
        <img src="data:image/jpeg;base64,${LOGO_JPEG_BASE64}" alt="Wascle" width="160" style="display:block;">
      </div>
      <div style="padding: 36px 32px 8px; font-family: Arial, sans-serif; font-size: 14.5px; line-height: 1.65; color: #1B1B1B;">
        <p style="margin: 0 0 16px;">Hi ${greetingName},</p>
        <div style="border-left: 3px solid #F5B429; background-color: #FDF6E7; border-radius: 0 6px 6px 0; padding: 14px 18px; margin: 0 0 20px;">
          <p style="margin: 0;"><b>Welcome to Docket!</b></p>
        </div>
        <p style="margin: 0 0 16px;">Your account has been set up. Your username is your email address: <b>${escapeHtmlServer(email)}</b></p>
        <p style="margin: 0 0 16px;">Before you can sign in, please set your own password using the button below.</p>
        <p style="margin: 0 0 24px;text-align:center;">
          <a href="${escapeHtmlServer(setupLink)}" style="display: inline-block; background-color: #1B1B1B; color: #F5B429; text-decoration: none; padding: 13px 26px; border-radius: 6px; font-weight: 700; font-size: 14px;">Set your password →</a>
        </p>
        <p style="margin: 0 0 16px;">Docket: <a href="https://docket-wascle.vercel.app" style="color:#B8860B;">docket-wascle.vercel.app</a></p>
        <p style="margin: 0 0 32px;border-top:1px solid #F0EBDD;padding-top:20px;color:#7A7568;font-size:12.5px;">This is an automatic notification from Docket.</p>
      </div>
      <div style="height: 4px; background: linear-gradient(90deg, #F5B429 0%, #f0a51e 100%);"></div>
    </div>
  </div>
</body>
</html>
  `;
  const apiKey = Deno.env.get('SMTP2GO_API_KEY');
  const fromAddress = Deno.env.get('TASK_EMAIL_FROM');
  if (!apiKey || !fromAddress) return;
  await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, sender: fromAddress, to: [email], subject: 'Welcome to Docket', html_body: html }),
  });
}

function escapeHtmlServer(str: string) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}