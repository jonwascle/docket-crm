-- Dockit CRM — live database schema (pulled from Supabase, project sjqjqthjvohebnjtaqaz)
-- Reference only: reconstructed from information_schema via the Supabase MCP
-- list_tables call. Not a pg_dump — column order and exact defaults are
-- accurate, but this has not been applied/tested as a runnable migration.

-- ============================================================================
-- profiles — one row per Dockit login (mirrors auth.users)
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id),
  email text not null,
  name text,
  role text not null default 'user' check (role = any (array['user','manager','admin'])),
  created_at timestamptz default now(),
  must_reset_password boolean default false,
  last_seen_at timestamptz
);

-- ============================================================================
-- organisations — customer companies
-- ============================================================================
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  website text,
  notes text,
  address_line1 text,
  address_line2 text,
  city text,
  county text,
  postcode text,
  contact_first_name text,
  contact_last_name text,
  contact_job_title text,
  contact_phone text,
  contact_email text,
  contact_send_wtn boolean default false,
  contact_wtn_email text,
  finance_first_name text,
  finance_last_name text,
  finance_job_title text,
  finance_phone text,
  finance_email text,
  finance_send_wtn boolean default false,
  finance_invoice_email text,
  waste_bags_required text,
  waste_bag_delivery_address text,
  waste_bag_amount text,
  smart_skip_required text,
  smart_skip_address text,
  smart_skip_asset_number text,
  smart_skip_delivery_date date,
  smart_skip_go_live_date date,
  property_clearance_required text,
  onboarding_status text default 'onboarding' check (onboarding_status = any (array['onboarding','live'])),
  created_at timestamptz default now(),
  waste_bag_address_line1 text,
  waste_bag_address_line2 text,
  waste_bag_town text,
  waste_bag_county text,
  waste_bag_postcode text,
  waste_bag_po_reference text,
  smart_skip_address_line1 text,
  smart_skip_address_line2 text,
  smart_skip_town text,
  smart_skip_county text,
  smart_skip_postcode text,
  onboarding_pdf_path text,
  onboarding_pdf_generated_at timestamptz,
  is_builders_merchant boolean default false
);

-- ============================================================================
-- contacts — individual people at an organisation
-- ============================================================================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organisation_id uuid references public.organisations(id),
  title text,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================================
-- deals — pipeline kanban
-- ============================================================================
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  contact_id uuid references public.contacts(id),
  value numeric,
  stage text not null default 'lead',
  notes text,
  created_at timestamptz default now()
);

-- ============================================================================
-- quotes / quote_items
-- ============================================================================
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id),
  business_name text,
  adjustment_pct numeric default 0,
  status text default 'draft' check (status = any (array['draft','sent'])),
  created_at timestamptz default now(),
  additional_info text
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes(id),
  name text not null,
  category text,
  base_price numeric not null default 0
);

-- ============================================================================
-- assets — smart skips / collection points
-- ============================================================================
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null default 'skip' check (asset_type = any (array['skip','scp'])),
  asset_number text not null,
  batch text,
  information text,
  address text,
  address_line_1 text,
  address_line_2 text,
  town text,
  county text,
  postcode text,
  sited_date date,
  customer_name text,
  housing_association text,
  branch_invoice_no text,
  invoice_contact text,
  container_type text,
  container_volume text,
  waste_stream text,
  paint_drum text,
  padlock_number text,
  sensor_serial text,
  gate_code_number text,
  fill_sensor text,
  qr text,
  signage text,
  subbie text,
  grouped_invoicing text,
  weekly_rental text,
  master_pin text,
  branch text,
  branch_contact text,
  notes text,
  created_at timestamptz default now(),
  latitude double precision,
  longitude double precision,
  retired boolean default false,
  on_order boolean default false,
  manufacturer text,
  reserved_for_name text,
  reserved_for_address text,
  reserved_confirmed boolean default false,
  -- customer_name/housing_association are raw free-typed strings from the JobiT export
  -- (a new "customer" is created per skip in JobiT, so the same real merchant/housing
  -- association shows up under dozens of spelling variants, e.g. "JPS - LW - exeter").
  -- These two columns resolve that fragmentation to real public.organisations rows —
  -- same fix as applied on the Lockit side. Raw text columns are kept for display/audit.
  customer_org_id uuid references public.organisations(id),
  housing_association_org_id uuid references public.organisations(id)
);

-- ============================================================================
-- tasks
-- ============================================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  organisation_id uuid references public.organisations(id),
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  status text not null default 'todo' check (status = any (array['todo','done'])),
  chain_key text,
  chain_step integer,
  created_at timestamptz default now(),
  completed_at timestamptz,
  due_date date
  -- note: send-task-reminders also reads/writes a `last_reminder_sent_at`
  -- column that was not present in the live list_tables snapshot — check
  -- before relying on it.
);

-- ============================================================================
-- service_providers and related tables
-- ============================================================================
create table public.service_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  county text,
  postcode text,
  waste_carriers_licence_number text,
  email text,
  phone text,
  vat_registered boolean,
  vat_number text,
  business_type text check (business_type = any (array['sole_trader','company'])),
  company_number text,
  notes text,
  created_at timestamptz default now(),
  sic_code text,
  invoice_recipient_name text,
  invoice_recipient_email text,
  bank_account_name text,
  bank_account_number text,
  bank_sort_code text,
  pricing_adjustment_pct numeric default -40,
  service_groups text[] default '{}',
  recruitment_stage text default 'prospect',
  utr_number text,
  declined boolean default false,
  declined_reason text,
  declined_at timestamptz,
  website text,
  info_pricing_email_sent_by uuid references public.profiles(id),
  info_pricing_email_sent_at timestamptz,
  archived boolean default false,
  archived_at timestamptz,
  waste_carriers_licence_confirmed_by uuid references public.profiles(id),
  waste_carriers_licence_confirmed_at timestamptz,
  recruitment_completed_stages text[] default '{}',
  call_notes text,
  call_notes_updated_by uuid references public.profiles(id),
  call_notes_updated_at timestamptz
);

create table public.service_provider_postcodes (
  id uuid primary key default gen_random_uuid(),
  service_provider_id uuid not null references public.service_providers(id),
  postcode_area text not null,
  created_at timestamptz default now()
);

create table public.service_provider_team_members (
  id uuid primary key default gen_random_uuid(),
  service_provider_id uuid not null references public.service_providers(id),
  name text not null,
  email text,
  phone text,
  created_at timestamptz default now()
);

create table public.service_provider_waste_stations (
  id uuid primary key default gen_random_uuid(),
  service_provider_id uuid not null references public.service_providers(id),
  station_name text not null,
  licence_number text,
  created_at timestamptz default now(),
  address_line1 text,
  address_line2 text,
  city text,
  county text,
  postcode text,
  licence_confirmed_by uuid references public.profiles(id),
  licence_confirmed_at timestamptz
);

create table public.service_provider_documents (
  id uuid primary key default gen_random_uuid(),
  service_provider_id uuid not null references public.service_providers(id),
  document_name text not null,
  file_path text,
  original_file_name text,
  expiry_date date,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  document_type text,
  text_value text,
  expiry_reminder_sent_at timestamptz
);

create table public.service_provider_pricing (
  id uuid primary key default gen_random_uuid(),
  service_provider_id uuid not null references public.service_providers(id),
  service_name text not null,
  category text,
  rate numeric not null,
  created_at timestamptz default now(),
  sort_order integer,
  is_active boolean default true
);

create table public.sp_default_pricing (
  id uuid primary key default gen_random_uuid(),
  service_name text not null unique,
  category text,
  rate numeric not null,
  created_at timestamptz default now(),
  sort_order integer,
  is_active boolean default true
);

create table public.sp_onboarding_links (
  id uuid primary key default gen_random_uuid(),
  service_provider_id uuid not null references public.service_providers(id),
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz default now(),
  last_submitted_at timestamptz,
  created_by uuid references public.profiles(id)
);

-- ============================================================================
-- notification_emails — who gets onboarding/wapp-setup PDFs
-- ============================================================================
create table public.notification_emails (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category = any (array['operations','finance'])),
  email text not null,
  created_at timestamptz default now()
);

-- ============================================================================
-- organisation_links — builders-merchant <-> supplied-organisation
-- ============================================================================
create table public.organisation_links (
  id uuid primary key default gen_random_uuid(),
  builders_merchant_id uuid not null references public.organisations(id),
  linked_organisation_id uuid not null references public.organisations(id),
  created_at timestamptz default now()
);

-- ============================================================================
-- quote_default_pricing — shared services catalogue for quotes
-- ============================================================================
create table public.quote_default_pricing (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  price numeric,
  sort_order integer not null,
  requires_manual_price boolean default false,
  editable_by_user boolean default false,
  created_at timestamptz default now()
);

-- ============================================================================
-- password_setup_tokens — welcome / reset-password links
-- ============================================================================
create table public.password_setup_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz default now(),
  used_at timestamptz
);

-- ============================================================================
-- feature_requests — Feedback section (bugs + feature requests, changelog)
-- ============================================================================
create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type = any (array['bug','feature'])),
  title text not null,
  details text,
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz default now(),
  status text not null default 'pending' check (status = any (array['pending','released'])),
  release_notes text,
  released_at timestamptz,
  released_by uuid references public.profiles(id),
  screenshot_path text,
  video_path text,
  video_transcript text,
  video_transcript_status text,
  release_video_path text,
  release_video_transcript text,
  release_video_transcript_status text,
  release_video_uploaded_at timestamptz
);

-- ============================================================================
-- login_events / activity_pings — used for "last seen" / usage tracking
-- ============================================================================
create table public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  logged_in_at timestamptz default now()
);

create table public.activity_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  pinged_at timestamptz default now()
);

-- ============================================================================
-- skip_requests — appears unused/early-stage (1 row live)
-- ============================================================================
create table public.skip_requests (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  address_note text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Every table above has RLS enabled in production. Policies themselves were
-- not enumerated by this pull (list_tables reports rls_enabled but not the
-- policy definitions) — check the Supabase dashboard or query pg_policies
-- before relying on specific access rules.
