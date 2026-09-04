# Dockit CRM

## Keep the help-chat AI current

`supabase/functions/dockit-help-chat/index.ts` contains `DOCKIT_SYSTEM_PROMPT` — a description of everything Dockit does, fed to Claude to power the in-app "Ask for help" widget. It only knows what's written there; it does not read the app's code or database at answer time.

Whenever a change in this session adds, removes, or meaningfully alters a **user-facing** feature described in that prompt (new required/optional fields, new tabs/views, changed permissions, changed workflows, new buttons that do something staff-facing) — update the relevant section of `DOCKIT_SYSTEM_PROMPT` to match, as part of that same piece of work, without waiting to be asked. Skip it for internal refactors, bug fixes with no behavior change, or backend-only changes nobody types into or clicks on.

After editing the prompt, redeploy it with `mcp__supabase__deploy_edge_function` (project id `sjqjqthjvohebnjtaqaz`, function name `dockit-help-chat`, `verify_jwt: false` — check the current setting via `list_edge_functions` before deploying in case it's changed) so the live widget picks it up. Show the user the diff before or as part of deploying, same as any other change — this is still a production deploy, not a silent background task.
