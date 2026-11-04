-- Bootstrap for a new, empty Sarth project. Apply once, before first launch.
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

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  slug text not null unique,
  introduction text,
  published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.photographs (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  storage_path text not null unique,
  web_path text,
  thumbnail_path text,
  width integer check (width > 0),
  height integer check (height > 0),
  caption text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index photographs_story_order_idx on public.photographs(story_id, display_order);
create table public.homepage_selections (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  photograph_id uuid not null references public.photographs(id) on delete cascade,
  shown_at timestamptz not null default now(),
  cycle_number integer not null default 1 check (cycle_number > 0)
);
create index selections_story_cycle_idx on public.homepage_selections(story_id, cycle_number desc);
create table public.homepage_layouts (
  id uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  layout_data jsonb not null,
  is_active boolean not null default true
);
create index layouts_active_expiry_idx on public.homepage_layouts(expires_at desc) where is_active;

create function public.stories_set_slug() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare base text; candidate text; suffix integer := 1;
begin
  if new.slug is null or trim(new.slug) = '' then
    base := trim(both '-' from regexp_replace(lower(new.title), '[^a-z0-9]+', '-', 'g'));
    if base = '' then base := 'story'; end if;
    candidate := base;
    while exists(select 1 from public.stories where slug = candidate and id <> new.id) loop
      suffix := suffix + 1;
      candidate := base || '-' || suffix;
    end loop;
    new.slug := candidate;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.stories_set_slug() from public, anon, authenticated;
create trigger stories_slug before insert or update on public.stories
for each row execute function public.stories_set_slug();

alter table public.stories enable row level security;
alter table public.photographs enable row level security;
alter table public.homepage_selections enable row level security;
alter table public.homepage_layouts enable row level security;
revoke all on public.stories, public.photographs, public.homepage_selections, public.homepage_layouts from anon, authenticated;
grant select on public.stories, public.photographs to anon, authenticated;
grant insert, update, delete on public.stories, public.photographs to authenticated;
grant all on public.admin_users, public.stories, public.photographs, public.homepage_selections, public.homepage_layouts to service_role;

create policy stories_public_read on public.stories for select to anon, authenticated using (published);
create policy photos_public_read on public.photographs for select to anon, authenticated
  using (exists(select 1 from public.stories s where s.id = story_id and s.published));
create policy stories_admin on public.stories for all to authenticated
  using (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy photos_admin on public.photographs for all to authenticated
  using (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));
-- Homepage layout and selection writes run only on the server with service credentials.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('originals', 'originals', false, 52428800, array['image/jpeg','image/png','image/webp']),
 ('photographs', 'photographs', true, 10485760, array['image/jpeg']),
 ('thumbnails', 'thumbnails', true, 2097152, array['image/jpeg']);
create policy sarth_admin_storage on storage.objects for all to authenticated
  using (bucket_id in ('originals','photographs','thumbnails') and exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (bucket_id in ('originals','photographs','thumbnails') and exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())));

commit;
