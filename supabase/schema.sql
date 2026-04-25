-- ============================================================
-- SmartExpense Tracker — Supabase Database Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  full_name   text,
  avatar_url  text,
  currency    text not null default 'INR',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 2. CATEGORIES
-- ────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  name        text not null,
  icon        text not null default '📦',
  color       text not null default '#6366f1',
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 3. EXPENSES
-- ────────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  category_id uuid references public.categories on delete set null,
  amount      numeric(12,2) not null check (amount > 0),
  description text not null,
  date        date not null,
  source      text not null default 'manual'
                check (source in ('manual','investment','subscription')),
  source_id   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 4. INCOME
-- ────────────────────────────────────────────────────────────
create table if not exists public.income (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  amount      numeric(12,2) not null check (amount > 0),
  source      text not null default 'Salary',
  month       int  not null check (month between 1 and 12),
  year        int  not null,
  notes       text,
  created_at  timestamptz not null default now(),
  constraint  income_user_month_year_source_unique unique (user_id, month, year, source)
);

-- ────────────────────────────────────────────────────────────
-- 5. INVESTMENTS
-- ────────────────────────────────────────────────────────────
create table if not exists public.investments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  name        text not null,
  type        text not null check (type in ('SIP','Stock','MutualFund','Bond','FD','PPF','NPS','Other')),
  amount      numeric(12,2) not null check (amount > 0),
  frequency   text not null check (frequency in ('monthly','quarterly','yearly','one-time')),
  start_date  date not null,
  end_date    date,
  is_active   boolean not null default true,
  notes       text,
  category_id uuid references public.categories on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 6. SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users on delete cascade not null,
  name              text not null,
  amount            numeric(12,2) not null check (amount > 0),
  billing_cycle     text not null check (billing_cycle in ('monthly','quarterly','yearly')),
  start_date        date not null,
  next_billing_date date,
  category_id       uuid references public.categories on delete set null,
  is_active         boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.categories   enable row level security;
alter table public.expenses     enable row level security;
alter table public.income       enable row level security;
alter table public.investments  enable row level security;
alter table public.subscriptions enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Categories
create policy "categories_select" on public.categories for select using (auth.uid() = user_id);
create policy "categories_insert" on public.categories for insert with check (auth.uid() = user_id);
create policy "categories_update" on public.categories for update using (auth.uid() = user_id);
create policy "categories_delete" on public.categories for delete using (auth.uid() = user_id and is_system = false);

-- Expenses
create policy "expenses_select" on public.expenses for select using (auth.uid() = user_id);
create policy "expenses_insert" on public.expenses for insert with check (auth.uid() = user_id);
create policy "expenses_update" on public.expenses for update using (auth.uid() = user_id);
create policy "expenses_delete" on public.expenses for delete using (auth.uid() = user_id);

-- Income
create policy "income_select" on public.income for select using (auth.uid() = user_id);
create policy "income_insert" on public.income for insert with check (auth.uid() = user_id);
create policy "income_update" on public.income for update using (auth.uid() = user_id);
create policy "income_delete" on public.income for delete using (auth.uid() = user_id);

-- Investments
create policy "investments_select" on public.investments for select using (auth.uid() = user_id);
create policy "investments_insert" on public.investments for insert with check (auth.uid() = user_id);
create policy "investments_update" on public.investments for update using (auth.uid() = user_id);
create policy "investments_delete" on public.investments for delete using (auth.uid() = user_id);

-- Subscriptions
create policy "subscriptions_select" on public.subscriptions for select using (auth.uid() = user_id);
create policy "subscriptions_insert" on public.subscriptions for insert with check (auth.uid() = user_id);
create policy "subscriptions_update" on public.subscriptions for update using (auth.uid() = user_id);
create policy "subscriptions_delete" on public.subscriptions for delete using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 8. FUNCTIONS & TRIGGERS
-- ────────────────────────────────────────────────────────────

-- Auto-create profile + seed default categories on new user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Seed system categories
  insert into public.categories (user_id, name, icon, color, is_system) values
    (new.id, 'Food & Dining',    '🍔', '#f97316', true),
    (new.id, 'Groceries',        '🛒', '#22c55e', true),
    (new.id, 'Entertainment',    '🎬', '#a855f7', true),
    (new.id, 'Sports & Fitness', '⚽', '#3b82f6', true),
    (new.id, 'Housing & Rent',   '🏠', '#64748b', true),
    (new.id, 'Transport',        '🚗', '#0ea5e9', true),
    (new.id, 'Healthcare',       '💊', '#ec4899', true),
    (new.id, 'Shopping',         '👗', '#f43f5e', true),
    (new.id, 'Education',        '📚', '#8b5cf6', true),
    (new.id, 'Utilities',        '💡', '#eab308', true),
    (new.id, 'Travel',           '✈️', '#06b6d4', true),
    (new.id, 'Technology',       '📱', '#6366f1', true),
    (new.id, 'Investments',      '📈', '#10b981', true),
    (new.id, 'Subscriptions',    '🔄', '#f59e0b', true),
    (new.id, 'Other',            '📦', '#94a3b8', true);

  return new;
end;
$$;

-- Trigger fires after each new user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger expenses_updated_at     before update on public.expenses    for each row execute procedure public.set_updated_at();
create trigger investments_updated_at  before update on public.investments for each row execute procedure public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute procedure public.set_updated_at();
create trigger profiles_updated_at     before update on public.profiles    for each row execute procedure public.set_updated_at();
