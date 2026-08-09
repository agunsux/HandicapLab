-- Historical Gold layer (Phase 1 — validation rebuild)
-- Load target for data/historical/*.jsonl artifacts.
-- Provenance-enforced tables; production queries must filter source_type='HISTORICAL'.

create table if not exists public.historical_matches (
  canonical_id text primary key,
  provider text not null,
  provider_record_id bigint not null,
  league text not null,
  season text not null,
  match_date date not null,
  home_team text not null,
  away_team text not null,
  home_goals int not null,
  away_goals int not null,
  result char(1) not null check (result in ('H','D','A')),
  result_verified boolean not null default true,
  source_file text,
  source_type text not null default 'HISTORICAL' check (source_type in ('REAL','HISTORICAL','TEST','MOCK','SYNTHETIC')),
  ingested_at timestamptz not null default now()
);

create unique index if not exists idx_historical_matches_provider ON public.historical_matches (provider, provider_record_id);
create index if not exists idx_historical_matches_date ON public.historical_matches (match_date);

create table if not exists public.historical_odds (
  id bigserial primary key,
  match_id text not null references public.historical_matches (canonical_id) on delete cascade,
  league text not null,
  season text not null,
  match_date date not null,
  bookmaker text not null,
  odds_type text not null default 'closing_reference' check (odds_type in ('closing_reference','opening','closing')),
  market_1x2 jsonb,
  market_ou25 jsonb,
  source text,
  ingested_at timestamptz not null default now(),
  check (market_1x2 is not null or market_ou25 is not null)
);

create index if not exists idx_historical_odds_match ON public.historical_odds (match_id);

create table if not exists public.historical_feature_snapshots (
  match_id text primary key references public.historical_matches (canonical_id) on delete cascade,
  league text not null,
  season text not null,
  match_date date not null,
  prediction_timestamp timestamptz not null,
  feature_version text not null,
  home jsonb not null,
  away jsonb not null,
  h2h jsonb not null,
  league_avg_goals numeric,
  league_has_history boolean not null default false,
  feature_presence jsonb not null,
  computation jsonb not null,
  source_type text not null default 'HISTORICAL' check (source_type in ('REAL','HISTORICAL','TEST','MOCK','SYNTHETIC')),
  ingested_at timestamptz not null default now()
);

create index if not exists idx_historical_features_date ON public.historical_feature_snapshots (match_date);

-- Security: research data is not public. RLS enabled with no permissive policies;
-- only the service role (RLS bypass) may access until an explicit data-service layer is built.
alter table public.historical_matches enable row level security;
alter table public.historical_odds enable row level security;
alter table public.historical_feature_snapshots enable row level security;

revoke all on public.historical_matches from anon, authenticated;
revoke all on public.historical_odds from anon, authenticated;
revoke all on public.historical_feature_snapshots from anon, authenticated;
revoke all on public.v_historical_leak_free from anon, authenticated;

grant all on public.historical_matches to service_role;
grant all on public.historical_odds to service_role;
grant all on public.historical_feature_snapshots to service_role;

-- Leakage guard view: only snapshots whose feature boundary precedes kickoff
create or replace view public.v_historical_leak_free as
select f.*
from public.historical_feature_snapshots f
join public.historical_matches m on m.canonical_id = f.match_id
where m.match_date::date >= f.prediction_timestamp::date
  and f.source_type = 'HISTORICAL';
