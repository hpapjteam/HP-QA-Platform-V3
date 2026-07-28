-- HP QA Application - Complete Supabase Database Schema
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run)

-- 1. CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS public.campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT DEFAULT 'IN',
  version_name TEXT DEFAULT 'Standard',
  status TEXT DEFAULT 'Draft',
  web_view_url TEXT DEFAULT '',
  figma_url TEXT DEFAULT '',
  html_source TEXT DEFAULT '',
  litmus_url TEXT DEFAULT '',
  design_type TEXT DEFAULT 'figma',
  team TEXT DEFAULT 'HP-APJ',
  mockup_file_name TEXT DEFAULT '',
  mockup_data_url TEXT DEFAULT '',
  outlook_file_name TEXT DEFAULT '',
  outlook_extracted_html TEXT DEFAULT '',
  outlook_subject TEXT DEFAULT '',
  folder_id TEXT DEFAULT '2026',
  user_email TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  last_edited_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by TEXT,
  deleted_at TIMESTAMPTZ,
  review_note TEXT DEFAULT '',
  qa_results JSONB DEFAULT '[]'::jsonb,
  checklists JSONB DEFAULT '[]'::jsonb,
  checklist_answers JSONB DEFAULT '{}'::jsonb,
  current_step INTEGER DEFAULT 1
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access for campaigns" ON public.campaigns;
CREATE POLICY "Public access for campaigns" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);

-- 2. APP_USERS TABLE
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',
  team TEXT DEFAULT 'HP-APJ',
  status TEXT DEFAULT 'active',
  last_login TEXT DEFAULT 'Never',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access for app_users" ON public.app_users;
CREATE POLICY "Public access for app_users" ON public.app_users FOR ALL USING (true) WITH CHECK (true);

-- 3. TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access for teams" ON public.teams;
CREATE POLICY "Public access for teams" ON public.teams FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.teams (name) VALUES 
  ('HP-APJ'),
  ('HP-IND'),
  ('HP-SEA')
ON CONFLICT (name) DO NOTHING;

-- 4. COUNTRIES TABLE
CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  flag TEXT DEFAULT '🌐',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access for countries" ON public.countries;
CREATE POLICY "Public access for countries" ON public.countries FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.countries (code, name, flag) VALUES 
  ('IN', 'India', '🇮🇳'),
  ('AU', 'Australia', '🇦🇺'),
  ('SG', 'Singapore', '🇸🇬'),
  ('MY', 'Malaysia', '🇲🇾'),
  ('NZ', 'New Zealand', '🇳🇿')
ON CONFLICT (code) DO NOTHING;

-- 5. APP_SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expanded_logo_url TEXT DEFAULT '',
  collapsed_logo_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access for app_settings" ON public.app_settings;
CREATE POLICY "Public access for app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

-- 6. ACTIVITY_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  action_type TEXT NOT NULL,
  details TEXT,
  campaign_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access for activity_logs" ON public.activity_logs;
CREATE POLICY "Public access for activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- 7. CHECKLISTS TABLE
CREATE TABLE IF NOT EXISTS public.checklists (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  title TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access for checklists" ON public.checklists;
CREATE POLICY "Public access for checklists" ON public.checklists FOR ALL USING (true) WITH CHECK (true);
