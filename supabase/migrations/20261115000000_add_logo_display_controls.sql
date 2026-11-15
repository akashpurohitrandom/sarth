alter table public.site_settings
  add column if not exists logo_scale smallint not null default 100
    check (logo_scale between 50 and 200),
  add column if not exists logo_opacity smallint not null default 100
    check (logo_opacity between 0 and 100);
