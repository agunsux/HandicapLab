-- HandicapLab Initial Schema Migration

-- Enable UUID generation extension
create extension if not exists "uuid-ossp";

-- Create profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  subscription_type text not null check (subscription_type in ('free', 'premium', 'lifetime')) default 'free',
  credits_remaining integer not null default 10 check (credits_remaining >= 0),
  expires_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile." on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile." on public.profiles
  for update using (auth.uid() = id);

-- Create teams table
create table public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  league text not null,
  country text not null,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS for teams
alter table public.teams enable row level security;

create policy "Teams are viewable by everyone." on public.teams
  for select using (true);

-- Create matches table
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  home_team_id uuid references public.teams(id) on delete cascade not null,
  away_team_id uuid references public.teams(id) on delete cascade not null,
  kickoff_time timestamp with time zone not null,
  league text not null,
  created_at timestamp with time zone default now() not null,
  constraint home_away_different check (home_team_id <> away_team_id)
);

-- Enable RLS for matches
alter table public.matches enable row level security;

create policy "Matches are viewable by everyone." on public.matches
  for select using (true);

-- Create team_stats table
create table public.team_stats (
  team_id uuid references public.teams(id) on delete cascade primary key,
  home_goals_for numeric not null default 0 check (home_goals_for >= 0),
  home_goals_against numeric not null default 0 check (home_goals_against >= 0),
  away_goals_for numeric not null default 0 check (away_goals_for >= 0),
  away_goals_against numeric not null default 0 check (away_goals_against >= 0),
  last_10_form text[] not null default '{}'::text[],
  updated_at timestamp with time zone default now() not null
);

-- Enable RLS for team_stats
alter table public.team_stats enable row level security;

create policy "Team stats are viewable by everyone." on public.team_stats
  for select using (true);

-- Create predictions table
create table public.predictions (
  match_id uuid references public.matches(id) on delete cascade primary key,
  
  -- Asian Handicap
  handicap_line numeric not null,
  handicap_probability numeric not null check (handicap_probability >= 0 and handicap_probability <= 1),
  handicap_fair_odds numeric not null check (handicap_fair_odds >= 1.0),
  handicap_market_odds numeric not null check (handicap_market_odds >= 1.0),
  handicap_edge_percent numeric not null,
  confidence_score integer not null check (confidence_score >= 0 and confidence_score <= 100),
  
  -- Over / Under
  total_line numeric not null,
  over_probability numeric not null check (over_probability >= 0 and over_probability <= 1),
  under_probability numeric not null check (under_probability >= 0 and under_probability <= 1),
  ou_edge_percent numeric not null,
  
  -- Moneyline
  home_probability numeric not null check (home_probability >= 0 and home_probability <= 1),
  draw_probability numeric not null check (draw_probability >= 0 and draw_probability <= 1),
  away_probability numeric not null check (away_probability >= 0 and away_probability <= 1),
  
  updated_at timestamp with time zone default now() not null,
  constraint prob_sums_ml check (home_probability + draw_probability + away_probability >= 0.99 and home_probability + draw_probability + away_probability <= 1.01),
  constraint prob_sums_ou check (over_probability + under_probability >= 0.99 and over_probability + under_probability <= 1.01)
);

-- Enable RLS for predictions
alter table public.predictions enable row level security;

-- Note: RLS can be tuned based on user subscription levels in server actions.
-- For standard database reads, we allow selects, but the API layer controls exposure.
create policy "Predictions are viewable by authenticated users." on public.predictions
  for select using (auth.role() = 'authenticated');

-- Create prediction_results table for backtesting
create table public.prediction_results (
  match_id uuid references public.matches(id) on delete cascade not null,
  model_version text not null,
  prediction_type text not null check (prediction_type in ('asian_handicap', 'over_under', 'moneyline')),
  predicted_value text not null,
  actual_result text,
  correct boolean,
  created_at timestamp with time zone default now() not null,
  primary key (match_id, model_version, prediction_type)
);

-- Enable RLS for prediction_results
alter table public.prediction_results enable row level security;

create policy "Prediction results are viewable by everyone." on public.prediction_results
  for select using (true);

-- Create credit_transactions table
create table public.credit_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  transaction_type text not null check (transaction_type in ('purchase', 'usage', 'bonus', 'refund')),
  amount integer not null,
  description text,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS for credit_transactions
alter table public.credit_transactions enable row level security;

create policy "Users can view their own transactions." on public.credit_transactions
  for select using (auth.uid() = user_id);

-- Create automatic profile creation on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, subscription_type, credits_remaining, expires_at)
  values (new.id, 'free', 10, null);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
