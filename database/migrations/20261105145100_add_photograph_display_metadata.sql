alter table public.photographs
  add column photograph_title text check (photograph_title is null or length(photograph_title) <= 200),
  add column taken_on date,
  add column city text check (city is null or length(city) <= 120),
  add column country text check (country is null or length(country) <= 120);
