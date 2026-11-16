-- =====================================================================
-- Society Hub — database schema for Supabase (PostgreSQL)
-- Run this whole file once in: Supabase dashboard → SQL Editor → New query
-- Safe rules: every table has Row Level Security (RLS) switched on.
-- =====================================================================

-- ---------- tables ----------------------------------------------------

create table if not exists public.societies (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(trim(name)) between 2 and 120),
  address            text not null default '',
  upi_id             text not null default '',
  maintenance_amount integer not null default 0 check (maintenance_amount >= 0),
  due_day            smallint not null default 10 check (due_day between 1 and 28),
  opening_balance    numeric(12,2) not null default 0,
  amenities          text[] not null default array['Clubhouse hall','Guest room','Badminton court','Swimming pool'],
  contacts           jsonb not null default '[]'::jsonb,   -- [{ "name": "Main gate", "phone": "98..." }]
  invite_code        text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_by         uuid references auth.users on delete set null default auth.uid(),
  created_at         timestamptz not null default now()
);

-- Secret key used only by the Google Sheet backup. Admins only.
create table if not exists public.society_secrets (
  society_id uuid primary key references public.societies on delete cascade,
  export_key text not null default replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')
);

create table if not exists public.villas (
  id         uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies on delete cascade,
  number     text not null check (length(trim(number)) between 1 and 20),
  owner_name text not null default '',
  villa_type text not null default '',
  created_at timestamptz not null default now(),
  unique (society_id, number)
);

create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies on delete cascade,
  user_id    uuid references auth.users on delete cascade,      -- empty until the person first signs in
  villa_id   uuid references public.villas on delete set null,
  name       text not null check (length(trim(name)) between 1 and 80),
  phone      text not null default '',
  email      text not null default '',
  role       text not null default 'resident' check (role in ('resident','admin')),
  title      text not null default '',            -- President, Treasurer, Secretary ...
  status     text not null default 'invited' check (status in ('invited','active')),
  created_at timestamptz not null default now(),
  unique (society_id, user_id)
);

-- Upgrade older databases (safe to run again)
alter table public.members alter column user_id drop not null;
alter table public.members alter column status set default 'invited';
alter table public.members drop constraint if exists members_status_check;
delete from public.members where status not in ('invited','active');   -- old unapproved join requests
alter table public.members add constraint members_status_check check (status in ('invited','active'));
create unique index if not exists members_society_email on public.members (society_id, email) where email <> '';

-- People allowed to create new societies (the app owner). Add rows from the SQL editor.
create table if not exists public.platform_admins (
  email text primary key check (email = lower(trim(email)))
);

create table if not exists public.dues (
  id           bigint generated always as identity primary key,
  society_id   uuid not null references public.societies on delete cascade,
  villa_id     uuid not null references public.villas on delete cascade,
  month        date not null check (extract(day from month) = 1),
  amount       integer not null check (amount >= 0),
  status       text not null default 'due' check (status in ('due','pending','paid')),
  utr          text not null default '',
  mode         text not null default '' check (mode in ('','UPI','Cash','Cheque','Bank')),
  paid_on      date,
  submitted_by uuid references auth.users on delete set null,
  confirmed_by uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  unique (villa_id, month)
);
create index if not exists dues_society_month on public.dues (society_id, month);

create table if not exists public.notices (
  id         bigint generated always as identity primary key,
  society_id uuid not null references public.societies on delete cascade,
  title      text not null check (length(trim(title)) between 1 and 160),
  body       text not null default '',
  tag        text not null default 'General',
  pinned     boolean not null default false,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists notices_society on public.notices (society_id, created_at desc);

create table if not exists public.tickets (
  id         bigint generated always as identity primary key,
  society_id uuid not null references public.societies on delete cascade,
  villa_id   uuid references public.villas on delete set null,
  created_by uuid references auth.users on delete set null default auth.uid(),
  category   text not null default 'Other',
  title      text not null check (length(trim(title)) between 1 and 160),
  details    text not null default '',
  status     text not null default 'open' check (status in ('open','in-progress','resolved')),
  note       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_society on public.tickets (society_id, created_at desc);

create table if not exists public.bookings (
  id         bigint generated always as identity primary key,
  society_id uuid not null references public.societies on delete cascade,
  villa_id   uuid not null references public.villas on delete cascade,
  created_by uuid references auth.users on delete set null default auth.uid(),
  amenity    text not null,
  day        date not null,
  slot       text not null check (slot in ('morning','afternoon','evening','full')),
  purpose    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists bookings_society_day on public.bookings (society_id, day);

create table if not exists public.expenses (
  id         bigint generated always as identity primary key,
  society_id uuid not null references public.societies on delete cascade,
  spent_on   date not null default current_date,
  head       text not null,
  amount     numeric(12,2) not null check (amount > 0),
  note       text not null default '',
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists expenses_society on public.expenses (society_id, spent_on desc);

-- ---------- helper functions (used by the security rules) -------------

create or replace function public.is_member(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members
                 where society_id = sid and user_id = auth.uid() and status = 'active');
$$;

create or replace function public.is_admin(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members
                 where society_id = sid and user_id = auth.uid() and status = 'active' and role = 'admin');
$$;

create or replace function public.my_villa(sid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select villa_id from members
  where society_id = sid and user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.is_linked(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where society_id = sid and user_id = auth.uid());
$$;

-- ---------- triggers --------------------------------------------------

-- A villa used in any row must belong to the same society.
create or replace function public.check_villa_society() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.villa_id is not null and not exists
     (select 1 from villas where id = new.villa_id and society_id = new.society_id) then
    raise exception 'This villa does not belong to this society.';
  end if;
  return new;
end $$;

drop trigger if exists members_villa_check  on public.members;
drop trigger if exists dues_villa_check     on public.dues;
drop trigger if exists tickets_villa_check  on public.tickets;
drop trigger if exists bookings_villa_check on public.bookings;
create trigger members_villa_check  before insert or update on public.members  for each row execute function public.check_villa_society();
create trigger dues_villa_check     before insert or update on public.dues     for each row execute function public.check_villa_society();
create trigger tickets_villa_check  before insert or update on public.tickets  for each row execute function public.check_villa_society();
create trigger bookings_villa_check before insert or update on public.bookings for each row execute function public.check_villa_society();

-- Members: cannot move to another society/user, and the last admin cannot be removed.
create or replace function public.guard_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.society_id <> old.society_id then
      raise exception 'The society of a member cannot be changed.';
    end if;
    if new.user_id is distinct from old.user_id and not (
         old.user_id is null and new.user_id = auth.uid()
         and new.email = lower(coalesce(auth.jwt() ->> 'email', ''))) then
      raise exception 'The login of a member cannot be changed. Remove the member and add them again.';
    end if;
    if old.role = 'admin' and old.status = 'active' and (new.role <> 'admin' or new.status <> 'active')
       and not exists (select 1 from members where society_id = old.society_id and role = 'admin'
                       and status = 'active' and id <> old.id) then
      raise exception 'A society needs at least one admin. Make someone else admin first.';
    end if;
    return new;
  end if;
  -- DELETE
  if old.role = 'admin' and old.status = 'active'
     and not exists (select 1 from members where society_id = old.society_id and role = 'admin'
                     and status = 'active' and id <> old.id) then
    raise exception 'A society needs at least one admin. Make someone else admin first.';
  end if;
  return old;
end $$;

-- Store emails in lower case so sign-in matching is exact.
create or replace function public.normalize_member() returns trigger
language plpgsql as $$ begin new.email = lower(trim(coalesce(new.email,''))); new.name = trim(new.name); return new; end $$;
drop trigger if exists members_normalize on public.members;
create trigger members_normalize before insert or update on public.members
  for each row execute function public.normalize_member();

drop trigger if exists members_guard on public.members;
create trigger members_guard before update or delete on public.members
  for each row execute function public.guard_members();

-- Bookings: no double booking of the same amenity and slot.
create or replace function public.check_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from bookings b
             where b.society_id = new.society_id and b.amenity = new.amenity and b.day = new.day
               and b.id is distinct from new.id
               and (b.slot = new.slot or b.slot = 'full' or new.slot = 'full')) then
    raise exception 'This slot is already booked. Please pick another slot or date.';
  end if;
  return new;
end $$;

drop trigger if exists bookings_check on public.bookings;
create trigger bookings_check before insert or update on public.bookings
  for each row execute function public.check_booking();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists tickets_touch on public.tickets;
create trigger tickets_touch before update on public.tickets
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ---------------------------------------

alter table public.societies       enable row level security;
alter table public.society_secrets enable row level security;
alter table public.villas          enable row level security;
alter table public.members         enable row level security;
alter table public.dues            enable row level security;
alter table public.notices         enable row level security;
alter table public.tickets         enable row level security;
alter table public.bookings        enable row level security;
alter table public.expenses        enable row level security;
alter table public.platform_admins enable row level security;   -- no policies: only reachable through functions

-- societies
drop policy if exists soc_read   on public.societies;
drop policy if exists soc_update on public.societies;
create policy soc_read   on public.societies for select to authenticated using (public.is_linked(id));
create policy soc_update on public.societies for update to authenticated using (public.is_admin(id)) with check (public.is_admin(id));

-- society_secrets (admins only)
drop policy if exists sec_read   on public.society_secrets;
drop policy if exists sec_update on public.society_secrets;
create policy sec_read   on public.society_secrets for select to authenticated using (public.is_admin(society_id));
create policy sec_update on public.society_secrets for update to authenticated using (public.is_admin(society_id)) with check (public.is_admin(society_id));

-- villas: members read, admins write
drop policy if exists villa_read  on public.villas;
drop policy if exists villa_write on public.villas;
create policy villa_read  on public.villas for select to authenticated using (public.is_member(society_id));
create policy villa_write on public.villas for all    to authenticated using (public.is_admin(society_id)) with check (public.is_admin(society_id));

-- members: you see yourself; admins see and manage everyone
drop policy if exists mem_read   on public.members;
drop policy if exists mem_insert on public.members;
drop policy if exists mem_update on public.members;
drop policy if exists mem_delete on public.members;
create policy mem_read   on public.members for select to authenticated using (user_id = auth.uid() or public.is_admin(society_id));
create policy mem_insert on public.members for insert to authenticated
  with check (public.is_admin(society_id) and user_id is null and status = 'invited' and email <> '');
create policy mem_update on public.members for update to authenticated using (public.is_admin(society_id)) with check (public.is_admin(society_id));
create policy mem_delete on public.members for delete to authenticated using (public.is_admin(society_id));

-- dues: residents see only their villa; admins manage all
drop policy if exists dues_read  on public.dues;
drop policy if exists dues_write on public.dues;
create policy dues_read  on public.dues for select to authenticated
  using (public.is_admin(society_id) or (public.is_member(society_id) and villa_id = public.my_villa(society_id)));
create policy dues_write on public.dues for all to authenticated
  using (public.is_admin(society_id)) with check (public.is_admin(society_id));

-- notices: members read, admins write
drop policy if exists notice_read  on public.notices;
drop policy if exists notice_write on public.notices;
create policy notice_read  on public.notices for select to authenticated using (public.is_member(society_id));
create policy notice_write on public.notices for all    to authenticated using (public.is_admin(society_id)) with check (public.is_admin(society_id));

-- tickets: residents raise and see their own; admins see and update all
drop policy if exists ticket_read   on public.tickets;
drop policy if exists ticket_insert on public.tickets;
drop policy if exists ticket_update on public.tickets;
drop policy if exists ticket_delete on public.tickets;
create policy ticket_read on public.tickets for select to authenticated
  using (public.is_admin(society_id) or (public.is_member(society_id) and villa_id = public.my_villa(society_id)));
create policy ticket_insert on public.tickets for insert to authenticated
  with check (public.is_member(society_id) and villa_id = public.my_villa(society_id)
              and status = 'open' and note = '' and created_by = auth.uid());
create policy ticket_update on public.tickets for update to authenticated
  using (public.is_admin(society_id)) with check (public.is_admin(society_id));
create policy ticket_delete on public.tickets for delete to authenticated using (public.is_admin(society_id));

-- bookings: everyone in the society sees them (to avoid clashes); you book for your villa
drop policy if exists book_read   on public.bookings;
drop policy if exists book_insert on public.bookings;
drop policy if exists book_delete on public.bookings;
create policy book_read on public.bookings for select to authenticated using (public.is_member(society_id));
create policy book_insert on public.bookings for insert to authenticated
  with check (public.is_member(society_id) and villa_id = public.my_villa(society_id)
              and day >= current_date and created_by = auth.uid());
create policy book_delete on public.bookings for delete to authenticated
  using (public.is_admin(society_id) or (public.is_member(society_id) and villa_id = public.my_villa(society_id)));

-- expenses: open books — members read, admins write
drop policy if exists exp_read  on public.expenses;
drop policy if exists exp_write on public.expenses;
create policy exp_read  on public.expenses for select to authenticated using (public.is_member(society_id));
create policy exp_write on public.expenses for all    to authenticated using (public.is_admin(society_id)) with check (public.is_admin(society_id));

-- ---------- actions (RPC functions the app calls) --------------------

drop function if exists public.create_society(text,text,text,text);
drop function if exists public.join_society(text,text,text,text);

-- Create a new society (app owner only) with its first admin.
-- If the admin email is the caller's own, they become admin straight away;
-- otherwise the admin is invited and gets access when they first sign in.
create or replace function public.create_society(p_name text, p_admin_name text, p_admin_email text,
                                                 p_phone text default '', p_villa_number text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; vid uuid; em text := lower(trim(coalesce(p_admin_email,''))); me text := lower(coalesce(auth.jwt() ->> 'email',''));
begin
  if not public.is_platform_admin() then raise exception 'Only the app owner can create a society.'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email for the society admin.'; end if;
  insert into societies (name, created_by) values (trim(p_name), auth.uid()) returning id into sid;
  insert into society_secrets (society_id) values (sid);
  if coalesce(trim(p_villa_number),'') <> '' then
    insert into villas (society_id, number, owner_name) values (sid, upper(trim(p_villa_number)), trim(p_admin_name)) returning id into vid;
  end if;
  insert into members (society_id, user_id, villa_id, name, phone, email, role, status, title)
  values (sid, case when em = me then auth.uid() end, vid, trim(p_admin_name), trim(coalesce(p_phone,'')), em,
          'admin', case when em = me then 'active' else 'invited' end, 'Admin');
  return sid;
end $$;

-- Called by the app after every sign-in: links the person to every society that added their email.
create or replace function public.claim_invites()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer; em text := lower(coalesce(auth.jwt() ->> 'email',''));
begin
  if auth.uid() is null or em = '' then return 0; end if;
  update members m set user_id = auth.uid(), status = 'active'
  where m.user_id is null and m.email = em and m.status = 'invited'
    and not exists (select 1 from members x where x.society_id = m.society_id and x.user_id = auth.uid());
  get diagnostics n = row_count;
  return n;
end $$;

-- Supabase Auth hook "Before User Created": only emails a committee has added (or the app owner)
-- can create a login. Strangers get an error and NO email is sent, so nobody can burn the email quota.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare em text := lower(coalesce(event -> 'user' ->> 'email', ''));
begin
  if em <> '' and (exists (select 1 from members where email = em) or exists (select 1 from platform_admins where email = em)) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403,
    'message', 'This email is not registered with any society. Please ask your committee to add you.'));
end $$;

-- Resident says "I have paid by UPI" with the UTR number. Treasurer then confirms.
create or replace function public.submit_payment(p_due_id bigint, p_utr text)
returns void language plpgsql security definer set search_path = public as $$
declare d dues;
begin
  select * into d from dues where id = p_due_id;
  if d.id is null or not public.is_member(d.society_id) or d.villa_id is distinct from public.my_villa(d.society_id) then
    raise exception 'Bill not found.';
  end if;
  if d.status <> 'due' then raise exception 'This bill is already paid or being verified.'; end if;
  if length(regexp_replace(coalesce(p_utr,''), '\s', '', 'g')) < 6 then
    raise exception 'Please enter the full UTR / reference number from your UPI app.';
  end if;
  update dues set status = 'pending', utr = regexp_replace(p_utr, '\s', '', 'g'), mode = 'UPI', submitted_by = auth.uid()
  where id = p_due_id;
end $$;

-- Admin raises maintenance bills for every villa for one month. Safe to run twice.
create or replace function public.generate_dues(p_society uuid, p_month date, p_amount integer default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer; amt integer;
begin
  if not public.is_admin(p_society) then raise exception 'Only admins can raise bills.'; end if;
  select coalesce(p_amount, maintenance_amount) into amt from societies where id = p_society;
  if amt is null or amt <= 0 then raise exception 'Set the maintenance amount in Settings first.'; end if;
  insert into dues (society_id, villa_id, month, amount)
  select p_society, v.id, date_trunc('month', p_month)::date, amt from villas v where v.society_id = p_society
  on conflict (villa_id, month) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Open accounts: totals every resident may see (no names of who has not paid).
create or replace function public.society_summary(p_society uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member(p_society) then raise exception 'Not a member of this society.'; end if;
  return json_build_object(
    'villas',    (select count(*) from villas where society_id = p_society),
    'collected', (select coalesce(sum(amount),0) from dues where society_id = p_society and status = 'paid'),
    'spent',     (select coalesce(sum(amount),0) from expenses where society_id = p_society),
    'opening',   (select opening_balance from societies where id = p_society),
    'months',    coalesce((select json_agg(m order by m.month desc) from (
                    select d.month,
                           sum(d.amount) as billed,
                           coalesce(sum(d.amount) filter (where d.status = 'paid'),0) as collected,
                           count(*) as bills,
                           count(*) filter (where d.status = 'paid') as paid,
                           (select coalesce(sum(e.amount),0) from expenses e
                             where e.society_id = p_society and date_trunc('month', e.spent_on) = d.month) as spent
                    from dues d where d.society_id = p_society
                    group by d.month order by d.month desc limit 12) m), '[]'::json)
  );
end $$;

-- Directory: villa list with resident names. Phones only for committee (or for admins).
create or replace function public.directory(p_society uuid)
returns table (villa_id uuid, number text, owner_name text, villa_type text, residents text, committee text, phone text)
language plpgsql stable security definer set search_path = public as $$
declare adm boolean := public.is_admin(p_society);
begin
  if not public.is_member(p_society) then raise exception 'Not a member of this society.'; end if;
  return query
  select v.id, v.number, v.owner_name, v.villa_type,
         coalesce(string_agg(m.name, ', ' order by m.created_at) filter (where m.status = 'active'), ''),
         coalesce(string_agg(nullif(m.title,''), ', ') filter (where m.status = 'active' and m.title <> '' ), ''),
         coalesce((array_agg(m.phone order by (m.title = '') , m.created_at)
                   filter (where m.status = 'active' and m.phone <> '' and (adm or m.title <> '')))[1], '')
  from villas v
  left join members m on m.villa_id = v.id
  where v.society_id = p_society
  group by v.id
  order by v.number;
end $$;

-- Nightly Google Sheet backup calls this with the society's secret export key.
create or replace function public.export_society(p_key text)
returns json language plpgsql stable security definer set search_path = public as $$
declare sid uuid;
begin
  select society_id into sid from society_secrets where export_key = p_key and length(p_key) >= 32;
  if sid is null then raise exception 'Invalid export key.'; end if;
  return json_build_object(
    'exported_at', now(),
    'society',  (select row_to_json(s) from (select id, name, address, upi_id, maintenance_amount, due_day, opening_balance from societies where id = sid) s),
    'villas',   coalesce((select json_agg(v order by v.number) from (select number, owner_name, villa_type from villas where society_id = sid) v), '[]'),
    'members',  coalesce((select json_agg(x order by x.villa) from (
                  select v.number as villa, m.name, m.phone, m.email, m.role, m.title, m.status, m.created_at::date as joined
                  from members m left join villas v on v.id = m.villa_id where m.society_id = sid) x), '[]'),
    'dues',     coalesce((select json_agg(x order by x.month desc, x.villa) from (
                  select to_char(d.month,'YYYY-MM') as month, v.number as villa, d.amount, d.status, d.mode, d.utr, d.paid_on
                  from dues d join villas v on v.id = d.villa_id where d.society_id = sid) x), '[]'),
    'expenses', coalesce((select json_agg(x order by x.spent_on desc) from (
                  select spent_on, head, amount, note from expenses where society_id = sid) x), '[]'),
    'notices',  coalesce((select json_agg(x order by x.created_at desc) from (
                  select created_at::date as created_at, tag, title, body, pinned from notices where society_id = sid) x), '[]'),
    'tickets',  coalesce((select json_agg(x order by x.id desc) from (
                  select t.id, t.created_at::date as raised, v.number as villa, t.category, t.title, t.details, t.status, t.note
                  from tickets t left join villas v on v.id = t.villa_id where t.society_id = sid) x), '[]'),
    'bookings', coalesce((select json_agg(x order by x.day desc) from (
                  select b.day, b.amenity, b.slot, v.number as villa, b.purpose
                  from bookings b join villas v on v.id = b.villa_id where b.society_id = sid) x), '[]')
  );
end $$;

-- Who may call what
revoke all on function public.export_society(text) from public;
grant execute on function public.export_society(text) to anon, authenticated;
revoke all on function public.create_society(text,text,text,text,text), public.claim_invites(), public.is_platform_admin(),
                       public.submit_payment(bigint,text), public.generate_dues(uuid,date,integer),
                       public.society_summary(uuid), public.directory(uuid) from public, anon;
grant execute on function public.create_society(text,text,text,text,text), public.claim_invites(), public.is_platform_admin(),
                          public.submit_payment(bigint,text), public.generate_dues(uuid,date,integer),
                          public.society_summary(uuid), public.directory(uuid) to authenticated;

-- Table access for signed-in users (RLS above decides which rows)
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- The auth hook may only be called by Supabase Auth.
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
    grant usage on schema public to supabase_auth_admin;
  end if;
end $$;
