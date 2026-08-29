-- Bro Sum Up database schema
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- The app uses its own email/password auth (not Supabase Auth), so every table
-- is locked down with RLS and only the server-side service_role key (never sent
-- to the browser) is allowed to read/write. Authorization by user_id / role is
-- enforced in the Next.js server actions.
--
-- Multi-store support: every user can own multiple `stores` (branches). Cost
-- data (`suppliers`) and monthly tax data (`financial_summaries`) now belong
-- to a specific store, not just a user. This file is safe to re-run on a
-- database that already has the pre-multi-store tables — the `alter table`
-- statements below add `store_id` if it's missing. NOTE: if you already have
-- supplier / financial_summaries rows from before this change, they will have
-- a null store_id until you manually backfill them (create a store, then
-- `update public.suppliers set store_id = '<store-id>' where store_id is null`,
-- same for financial_summaries) — otherwise they simply won't show up once a
-- store is selected in the app.

create extension if not exists "pgcrypto";

-- 1. users --------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- 2. stores ---------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists stores_user_id_idx on public.stores(user_id);

-- 3. suppliers ------------------------------------------------------------
-- One row per vendor/shop name (per store), reused across every purchase
-- from that vendor. `purchase_date` here is auto-maintained by the app as
-- "date of the most recent item added for this vendor" — a convenience/
-- legacy field only; the real per-purchase dates live on `supplier_items`.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  supplier_name text not null,
  purchase_date date not null,
  note text not null default '',
  payment_status text not null default 'unpaid' check (payment_status in ('paid', 'unpaid')),
  created_at timestamptz not null default now()
);

-- Backward-compatible migration if this table already existed pre-multi-store.
alter table public.suppliers add column if not exists store_id uuid references public.stores(id) on delete cascade;
-- Backward-compatible migration if this table already existed pre-payment-status.
alter table public.suppliers add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('paid', 'unpaid'));

create index if not exists suppliers_user_id_idx on public.suppliers(user_id);
create index if not exists suppliers_store_id_idx on public.suppliers(store_id);
create index if not exists suppliers_purchase_date_idx on public.suppliers(purchase_date);

-- 4. supplier_items -------------------------------------------------------
-- Purchase date now lives PER ITEM (each row = one purchase line, its own
-- date), not per supplier — a supplier/vendor can be reused across many
-- purchase visits on different dates. `suppliers.purchase_date` is kept as
-- an auto-maintained "most recent purchase" convenience/legacy field (the
-- app updates it to the latest item date whenever items are added), but it
-- is no longer the source of truth for date-range filtering.
create table if not exists public.supplier_items (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  item_name text not null,
  unit_price numeric(12, 2) not null default 0,
  quantity numeric(12, 2) not null default 0,
  total_price numeric(14, 2) generated always as (unit_price * quantity) stored,
  purchase_date date,
  created_at timestamptz not null default now()
);

-- Backward-compatible migration if this table already existed pre-item-date:
-- add the column nullable first, backfill every existing row from its parent
-- supplier's (single, pre-refactor) purchase_date, then enforce not null.
alter table public.supplier_items add column if not exists purchase_date date;
update public.supplier_items si
set purchase_date = s.purchase_date
from public.suppliers s
where si.supplier_id = s.id and si.purchase_date is null;
alter table public.supplier_items alter column purchase_date set not null;

create index if not exists supplier_items_supplier_id_idx on public.supplier_items(supplier_id);
create index if not exists supplier_items_purchase_date_idx on public.supplier_items(purchase_date);

-- 5. financial_summaries ---------------------------------------------------
create table if not exists public.financial_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  period_month date not null, -- always stored as the 1st day of the month, e.g. 2026-08-01
  total_revenue numeric(14, 2) not null default 0,
  total_cost numeric(14, 2) not null default 0,
  gross_profit numeric(14, 2) not null default 0,
  other_expenses numeric(14, 2) not null default 0,
  net_profit_before_tax numeric(14, 2) not null default 0,
  corporate_tax numeric(14, 2) not null default 0,
  net_profit_after_tax numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- Backward-compatible migration if this table already existed pre-multi-store.
alter table public.financial_summaries add column if not exists store_id uuid references public.stores(id) on delete cascade;

-- Financial summaries are now unique per store + period, not per user + period.
alter table public.financial_summaries drop constraint if exists financial_summaries_user_id_period_month_key;
drop index if exists financial_summaries_store_id_period_month_idx;
create unique index if not exists financial_summaries_store_id_period_month_key
  on public.financial_summaries(store_id, period_month);

create index if not exists financial_summaries_user_id_idx on public.financial_summaries(user_id);
create index if not exists financial_summaries_store_id_idx on public.financial_summaries(store_id);

-- 6. capital_contributions -------------------------------------------------
-- Initial capital / partner (investor) contributions per store — tracks how
-- much each partner put into the business so ownership share (%) can be
-- derived as amount / total capital for that store.
create table if not exists public.capital_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  partner_name text not null,
  amount numeric(14, 2) not null default 0,
  contribution_date date not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists capital_contributions_user_id_idx on public.capital_contributions(user_id);
create index if not exists capital_contributions_store_id_idx on public.capital_contributions(store_id);
create index if not exists capital_contributions_contribution_date_idx on public.capital_contributions(contribution_date);

-- 7. shopping_items ---------------------------------------------------------
-- Lightweight personal "things to buy" checklist per user — independent of
-- stores/suppliers. Shown as a reminder popup on login/refresh until each
-- item is checked off (bought, which just deletes the row) or removed.
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  item_name text not null,
  quantity numeric(12, 2) not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists shopping_items_user_id_idx on public.shopping_items(user_id);

-- Lock every table down: only the service_role key (used exclusively on the
-- server) can bypass RLS. anon/authenticated Supabase roles get no policies,
-- i.e. no access at all, since this app never issues Supabase Auth sessions.
alter table public.users enable row level security;
alter table public.stores enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_items enable row level security;
alter table public.financial_summaries enable row level security;
alter table public.capital_contributions enable row level security;
alter table public.shopping_items enable row level security;
