begin;

alter table public.photographs
  add column if not exists display_target text not null default 'desktop'
  check (display_target in ('desktop', 'mobile'));

create index if not exists photographs_display_target_created_idx
  on public.photographs(display_target, created_at desc);

commit;
