begin;

-- The collection is now global; every photograph is an independent record.
drop table if exists public.homepage_selections cascade;
drop table if exists public.homepage_layouts cascade;
drop table if exists public.stories cascade;
drop function if exists public.stories_set_slug() cascade;

alter table public.photographs drop column if exists story_id cascade;
alter table public.photographs drop column if exists photograph_title;
alter table public.photographs drop column if exists taken_on;
alter table public.photographs drop column if exists caption;
alter table public.photographs add column if not exists tags text[] not null default '{}';
alter table public.photographs add column if not exists year integer;
alter table public.photographs drop constraint if exists photographs_year_check;
alter table public.photographs add constraint photographs_year_check
  check (year is null or year between 1000 and 9999);
create index if not exists photographs_tags_idx on public.photographs using gin(tags);
create index if not exists photographs_created_idx on public.photographs(created_at desc);

drop policy if exists photos_public_read on public.photographs;
drop policy if exists photos_admin on public.photographs;
drop policy if exists photographs_public_read on public.photographs;
drop policy if exists photographs_admin on public.photographs;
create policy photographs_public_read on public.photographs for select to anon, authenticated
  using (web_path is not null);
create policy photographs_admin on public.photographs for all to authenticated
  using (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create table if not exists public.site_settings (
  singleton boolean primary key default true check (singleton),
  logo_path text,
  updated_at timestamptz not null default now()
);
insert into public.site_settings(singleton) values (true) on conflict (singleton) do nothing;
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
drop policy if exists site_settings_read on public.site_settings;
drop policy if exists site_settings_admin on public.site_settings;
create policy site_settings_read on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_admin on public.site_settings for all to authenticated
  using (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', true, 5242880, array['image/png','image/svg+xml'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists sarth_admin_storage on storage.objects;
create policy sarth_admin_storage on storage.objects for all to authenticated
  using (bucket_id in ('originals','photographs','thumbnails','brand') and exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (bucket_id in ('originals','photographs','thumbnails','brand') and exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));

commit;
