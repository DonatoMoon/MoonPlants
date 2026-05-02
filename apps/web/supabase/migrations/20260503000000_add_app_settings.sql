CREATE TABLE IF NOT EXISTS public.app_settings (
    id integer PRIMARY KEY DEFAULT 1,
    is_cron_enabled boolean NOT NULL DEFAULT true,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT app_settings_single_row CHECK (id = 1)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to app_settings" ON public.app_settings FOR SELECT USING (true);

-- We only allow reading safely. Full updates will be done via Service Role (Admin client) in Server Actions
INSERT INTO public.app_settings (id, is_cron_enabled) VALUES (1, true) ON CONFLICT (id) DO NOTHING;
