alter table public.photographs
  add column if not exists photograph_title text check (photograph_title is null or length(photograph_title) <= 200),
  add column if not exists taken_on date,
  add column if not exists city text check (city is null or length(city) <= 120),
  add column if not exists country text check (country is null or length(country) <= 120);
