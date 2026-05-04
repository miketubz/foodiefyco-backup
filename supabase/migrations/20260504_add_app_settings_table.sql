create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy if not exists app_settings_select_all
on public.app_settings
for select
using (true);

create policy if not exists app_settings_authenticated_write
on public.app_settings
for insert
to authenticated
with check (true);

create policy if not exists app_settings_authenticated_update
on public.app_settings
for update
to authenticated
using (true)
with check (true);

create or replace function public.set_app_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.set_app_settings_updated_at();
