-- Bootstrap for a new, empty Sārth project. Apply once, before first launch.
begin;

create table public.admin_users (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
create policy admin_self on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

create table public.photographs (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  web_path text,
  thumbnail_path text,
  width integer check (width > 0),
  height integer check (height > 0),
  tags text[] not null default '{}',
  city text check (city is null or length(city) <= 120),
  country text check (country is null or length(country) <= 120),
  year integer check (year is null or year between 1000 and 9999),
  display_target text not null default 'desktop' check (display_target in ('desktop', 'mobile')),
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index photographs_created_idx on public.photographs(created_at desc);
create index photographs_tags_idx on public.photographs using gin(tags);
create index photographs_display_target_created_idx on public.photographs(display_target, created_at desc);

create table public.site_settings (
  singleton boolean primary key default true check (singleton),
  logo_path text,
  updated_at timestamptz not null default now()
);
insert into public.site_settings(singleton) values (true);

alter table public.photographs enable row level security;
alter table public.site_settings enable row level security;
revoke all on public.photographs, public.site_settings from anon, authenticated;
grant select on public.photographs, public.site_settings to anon, authenticated;
grant insert, update, delete on public.photographs, public.site_settings to authenticated;
grant all on public.admin_users, public.photographs, public.site_settings to service_role;
create policy photographs_public_read on public.photographs for select to anon, authenticated
  using (web_path is not null);
create policy photographs_admin on public.photographs for all to authenticated
  using (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy site_settings_read on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_admin on public.site_settings for all to authenticated
  using (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('originals', 'originals', false, 52428800, array['image/jpeg','image/png','image/webp']),
 ('photographs', 'photographs', true, 10485760, array['image/jpeg']),
 ('thumbnails', 'thumbnails', true, 2097152, array['image/jpeg']),
 ('brand', 'brand', true, 5242880, array['image/png','image/svg+xml']);
create policy sarth_admin_storage on storage.objects for all to authenticated
  using (bucket_id in ('originals','photographs','thumbnails','brand') and exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (bucket_id in ('originals','photographs','thumbnails','brand') and exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));

commit;
