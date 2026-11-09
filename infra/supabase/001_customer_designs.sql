-- StarKeepsake M1 SQL bootstrap: run ONLY in a new, dedicated StarKeepsake Supabase project.
-- Use the project's SQL Editor as an administrator.
-- No table is exposed to anon or authenticated clients; all writes and reads go
-- through the existing ASP.NET Core API using a server-side Supabase secret key.
-- Avoid running this on Rig Repair Connect or another live project.

CREATE TABLE IF NOT EXISTS public.customer_designs (
    design_id text PRIMARY KEY
        CHECK (design_id ~ '^SK-[0-9A-F]{16}$'),
    access_key_hash text NOT NULL
        CHECK (access_key_hash ~ '^[0-9A-F]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    design_json jsonb NOT NULL,
    preferences_json jsonb NOT NULL,
    original_mime text NOT NULL
        CHECK (original_mime IN ('image/jpeg', 'image/png', 'image/webp')),
    foreground_mime text
        CHECK (foreground_mime IS NULL OR foreground_mime = 'image/png')
);

CREATE INDEX IF NOT EXISTS customer_designs_created_at_idx
    ON public.customer_designs (created_at DESC);

ALTER TABLE public.customer_designs ENABLE ROW LEVEL SECURITY;

-- Defense in depth: API keys exposed in the browser must never be able to
-- list, create or read private customer design rows. No public policies exist.
REVOKE ALL ON TABLE public.customer_designs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_designs TO service_role;

-- Exactly one private bucket for original photos and polished foregrounds.
-- No public Storage object policy is created. The backend secret authorizes
-- storage operations without exposing object URLs to clients.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'starkeepsake-designs',
    'starkeepsake-designs',
    FALSE,
    10485760,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Verify in Storage > Buckets that starkeepsake-designs is PRIVATE,
-- has the 10 MiB object limit, and restricts uploads to those image MIME types.
