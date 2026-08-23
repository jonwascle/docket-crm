// This runs on Supabase's servers, never in the browser.
//
// It's what lets a service provider fill in their own details through a
// link — with NO Dockit login — without opening up direct anonymous
// writes to the database. The link just carries a token; this function
// checks the token is real, then does the actual writing itself using the
// privileged service role key.
//
// Two things it can do (sent as `action` in the POST body):
//   'get'    - given a token, return the provider's name plus whatever
//              they've already filled in (so the form can show existing
//              answers if they're finishing this later, or updating it)
//   'submit' - given a token and the filled-in form, save everything:
//              company/contact details, team members, waste transfer
//              stations, and any uploaded documents.
//
// Sends two kinds of emails via SMTP2GO, using different senders:
//   TASK_EMAIL_FROM  - the internal notification to whichever staff
//                       member owns this recruitment (mentions Dockit,
//                       since staff know what that is)
//   SP_EMAIL_FROM    - the supplier-facing "thanks, here's your link"
//                       confirmation (a no-reply address, and never
//                       mentions Dockit, since suppliers don't know it)

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SB_SECRET_KEY');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { action, token } = body;
    if (!token) {
      return json({ error: 'Missing token.' }, 400);
    }

    const { data: link, error: linkErr } = await adminClient
      .from('sp_onboarding_links').select('*').eq('token', token).single();
    if (linkErr || !link) {
      return json({ error: 'This link is not valid. Please ask Wascle for a new one.' }, 404);
    }

    const spId = link.service_provider_id;

    if (action === 'get') {
      const { data: sp } = await adminClient.from('service_providers').select('*').eq('id', spId).single();
      const { data: team } = await adminClient.from('service_provider_team_members').select('*').eq('service_provider_id', spId);
      const { data: stations } = await adminClient.from('service_provider_waste_stations').select('*').eq('service_provider_id', spId);
      const { data: documents } = await adminClient.from('service_provider_documents').select('id, document_name, document_type, expiry_date, original_file_name').eq('service_provider_id', spId);
      const { data: postcodes } = await adminClient.from('service_provider_postcodes').select('postcode_area').eq('service_provider_id', spId);
      if (!sp) {
        return json({ error: 'Could not find this service provider.' }, 404);
      }
      return json({
        success: true, provider: sp, team: team || [], stations: stations || [], documents: documents || [],
        postcodeAreas: (postcodes || []).map(p => p.postcode_area)
      }, 200);
    }

    if (action === 'submit') {
      const { company, teamMembers, wasteStations, documents, postcodeAreas, isFinal } = body;

      if (company) {
        const allowed = ['name', 'address_line1', 'address_line2', 'city', 'county', 'postcode',
          'waste_carriers_licence_number', 'email', 'phone', 'vat_registered', 'vat_number',
          'utr_number', 'business_type', 'company_number', 'sic_code',
          'invoice_recipient_name', 'invoice_recipient_email',
          'bank_account_name', 'bank_account_number', 'bank_sort_code'];
        const update = {};
        allowed.forEach(k => { if (company[k] !== undefined) update[k] = company[k]; });
        if (Object.keys(update).length > 0) {
          const { error } = await adminClient.from('service_providers').update(update).eq('id', spId);
          if (error) return json({ error: 'Could not save company details: ' + error.message }, 400);
        }
      }

      if (Array.isArray(postcodeAreas)) {
        await adminClient.from('service_provider_postcodes').delete().eq('service_provider_id', spId);
        const rows = postcodeAreas.filter(pc => pc && pc.trim()).map(pc => ({
          service_provider_id: spId, postcode_area: pc.trim().toUpperCase()
        }));
        if (rows.length > 0) {
          await adminClient.from('service_provider_postcodes').insert(rows);
        }
      }

      // Team members and waste stations: the form the supplier sees is
      // always pre-filled with their current full list, so whatever they
      // submit now IS their complete, current list — replace outright
      // rather than appending, so re-submitting never creates duplicates.
      if (Array.isArray(teamMembers)) {
        await adminClient.from('service_provider_team_members').delete().eq('service_provider_id', spId);
        const rows = teamMembers.filter(m => m.name).map(m => ({
          service_provider_id: spId, name: m.name, email: m.email || null, phone: m.phone || null
        }));
        if (rows.length > 0) {
          await adminClient.from('service_provider_team_members').insert(rows);
        }
      }

      if (Array.isArray(wasteStations)) {
        await adminClient.from('service_provider_waste_stations').delete().eq('service_provider_id', spId);
        const rows = wasteStations.filter(w => w.station_name).map(w => ({
          service_provider_id: spId, station_name: w.station_name, licence_number: w.licence_number || null,
          address_line1: w.address_line1 || null, address_line2: w.address_line2 || null,
          city: w.city || null, county: w.county || null, postcode: w.postcode || null
        }));
        if (rows.length > 0) {
          await adminClient.from('service_provider_waste_stations').insert(rows);
        }
      }

      // Documents: the three standard types (insurance, licence, etc.) each
      // only ever have one entry per provider, so re-submitting updates
      // that same entry rather than creating a second one. Anything else
      // ("other" documents) doesn't have an obvious match to update, so
      // those are simply added each time.
      if (Array.isArray(documents)) {
        for (const d of documents) {
          if (!d.name) continue;

          let existing = null;
          if (d.documentType) {
            const { data: existingDoc } = await adminClient
              .from('service_provider_documents').select('id, file_path')
              .eq('service_provider_id', spId).eq('document_type', d.documentType).maybeSingle();
            existing = existingDoc;
          }

          if (d.textValue) {
            if (existing) {
              await adminClient.from('service_provider_documents').update({
                document_name: d.name, text_value: d.textValue, expiry_date: d.expiryDate || null
              }).eq('id', existing.id);
            } else {
              await adminClient.from('service_provider_documents').insert({
                service_provider_id: spId, document_name: d.name, text_value: d.textValue,
                expiry_date: d.expiryDate || null, document_type: d.documentType || null
              });
            }
            continue;
          }

          if (!d.fileBase64 || !d.fileName) continue;
          try {
            const bytes = base64ToBytes(d.fileBase64);
            const path = spId + '/' + Date.now() + '-' + d.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const { error: uploadErr } = await adminClient.storage
              .from('service-provider-documents')
              .upload(path, bytes, { contentType: d.mimeType || 'application/octet-stream' });
            if (!uploadErr) {
              if (existing) {
                if (existing.file_path) {
                  await adminClient.storage.from('service-provider-documents').remove([existing.file_path]);
                }
                await adminClient.from('service_provider_documents').update({
                  document_name: d.name, file_path: path, original_file_name: d.fileName,
                  expiry_date: d.expiryDate || null
                }).eq('id', existing.id);
              } else {
                await adminClient.from('service_provider_documents').insert({
                  service_provider_id: spId, document_name: d.name, file_path: path,
                  original_file_name: d.fileName, expiry_date: d.expiryDate || null,
                  document_type: d.documentType || null
                });
              }
            }
          } catch (e) {
            // Skip a document that fails to upload rather than fail the whole submission.
          }
        }
      }

      await adminClient.from('sp_onboarding_links').update({ last_submitted_at: new Date().toISOString() }).eq('id', link.id);

      // Notify whichever staff member generated this link, every time the
      // provider submits or updates the form — partial saves included.
      // Wrapped in its own try/catch: a problem sending this notification
      // must never cause the actual submission (already saved above) to
      // come back as a failure to the supplier.
      try {
        if (link.created_by) {
          const { data: staffProfile } = await adminClient.from('profiles').select('email, name').eq('id', link.created_by).maybeSingle();
          if (staffProfile && staffProfile.email) {
            const spName = (company && company.name) || 'A service provider';
            const staffHtml = buildStaffNotificationEmailHtml(staffProfile.name, spName, isFinal, spId);
            await sendEmail([staffProfile.email], spName + ' has updated their onboarding form', staffHtml, []);
          }
        }
      } catch (notifyErr) {
        console.error('Staff notification email failed:', notifyErr);
      }

      try {
        if (!isFinal) {
          const spEmail = (company && company.email) || null;
          const spName = (company && company.name) || null;
          if (spEmail) {
            // Rebuild the same public link the supplier used, from this
            // request's origin (falls back to the known production URL).
            const origin = req.headers.get('origin') || 'https://dockit-wascle.vercel.app';
            const continueLink = origin + '/#supplier-onboard=' + token;
            const html = buildFollowUpEmailHtml(spName, continueLink);
            await sendEmail([spEmail], 'Thanks for the update — Wascle onboarding', html, [], 'SP_EMAIL_FROM');
          }
        }
      } catch (followUpErr) {
        console.error('Supplier follow-up email failed:', followUpErr);
      }

      return json({ success: true }, 200);
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: e.message || 'Unknown error.' }, 500);
  }
});

function base64ToBytes(b64: string) {
  const binStr = atob(b64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sendEmail(to: string[], subject: string, html: string, attachments: { filename: string, content: string }[], fromSecret: string = 'TASK_EMAIL_FROM') {
  const apiKey = Deno.env.get('SMTP2GO_API_KEY');
  const fromAddress = Deno.env.get(fromSecret);
  if (!apiKey || !fromAddress) {
    return { error: `Email service is not configured yet (missing SMTP2GO_API_KEY or ${fromSecret}).` };
  }
  const res = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      sender: fromAddress,
      to,
      subject,
      html_body: html,
      attachments: attachments.map(a => ({
        filename: a.filename,
        fileblob: a.content,
        mimetype: 'application/pdf',
      })),
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

function buildStaffNotificationEmailHtml(staffName: string, spName: string, isFinal: boolean, spId: string) {
  const greetingName = escapeHtmlServer((staffName || '').split(' ')[0] || 'there');
  const safeSpName = escapeHtmlServer(spName);
  const dockitLink = 'https://dockit-wascle.vercel.app/#view=serviceproviders&sp=' + spId + '&subtab=recruitment';
  const statusLine = isFinal
    ? `<b>${safeSpName}</b> has just finished submitting their onboarding form.`
    : `<b>${safeSpName}</b> has just saved some progress on their onboarding form — they may still be filling in the rest.`;
  return `<!DOCTYPE html>
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
          <p style="margin: 0;">${statusLine}</p>
        </div>
        <p style="margin: 0 0 24px;text-align:center;">
          <a href="${dockitLink}" style="display: inline-block; background-color: #1B1B1B; color: #F5B429; text-decoration: none; padding: 13px 26px; border-radius: 6px; font-weight: 700; font-size: 14px;">View in Dockit →</a>
        </p>
        <p style="margin: 0 0 32px;border-top:1px solid #F0EBDD;padding-top:20px;color:#7A7568;font-size:12.5px;">This is an automatic notification from Dockit.</p>
      </div>
      <div style="height: 4px; background: linear-gradient(90deg, #F5B429 0%, #f0a51e 100%);"></div>
    </div>
  </div>
</body>
</html>
  `;
}

function buildFollowUpEmailHtml(spName: string, continueLink: string) {
  const greetingName = escapeHtmlServer(spName || 'there');
  return `<!DOCTYPE html>
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
          <p style="margin: 0;">Thank you for sending over some information — we've saved it safely on our system.</p>
        </div>
        <p style="margin: 0 0 16px;">Whenever you're ready to complete the rest, just use the link below to pick up exactly where you left off — nothing you've already entered will need to be redone.</p>
        <p style="margin: 0 0 24px;text-align:center;">
          <a href="${escapeHtmlServer(continueLink)}" style="display: inline-block; background-color: #1B1B1B; color: #F5B429; text-decoration: none; padding: 13px 26px; border-radius: 6px; font-weight: 700; font-size: 14px;">Continue onboarding form →</a>
        </p>
        <p style="margin: 0 0 28px;">If you have any questions in the meantime, please don't hesitate to get in touch — we're always happy to help.</p>
        <p style="margin: 0 0 32px;border-top:1px solid #F0EBDD;padding-top:20px;">Kind regards,<br><b style="color:#B8860B;">The Wascle Team</b></p>
      </div>
      <div style="height: 4px; background: linear-gradient(90deg, #F5B429 0%, #f0a51e 100%);"></div>
      <div style="background-color: #F7F5F0; padding: 16px 32px; font-family: Arial, sans-serif; font-size: 12px; color: #7A7568;">
        <b style="color:#1B1B1B;">Wascle</b> &middot; <a href="https://wascle.co.uk" style="color: #B8860B;font-weight:600;">wascle.co.uk</a>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}