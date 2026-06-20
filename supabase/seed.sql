-- HandicapLab Sample EPL Seed Data

-- Clear existing data (in reverse dependency order)
truncate public.prediction_results cascade;
truncate public.predictions cascade;
truncate public.team_stats cascade;
truncate public.matches cascade;
truncate public.teams cascade;

-- Insert teams (with static UUIDs for linking)
insert into public.teams (id, name, league, country) values
  ('a21b33fa-0b5c-4be2-beab-df0eb03c0b01', 'Arsenal', 'English Premier League', 'England'),
  ('c11b33fa-0b5c-4be2-beab-df0eb03c0b02', 'Chelsea', 'English Premier League', 'England'),
  ('l11b33fa-0b5c-4be2-beab-df0eb03c0b03', 'Liverpool', 'English Premier League', 'England'),
  ('m11b33fa-0b5c-4be2-beab-df0eb03c0b04', 'Manchester City', 'English Premier League', 'England'),
  ('m21b33fa-0b5c-4be2-beab-df0eb03c0b05', 'Manchester United', 'English Premier League', 'England'),
  ('t11b33fa-0b5c-4be2-beab-df0eb03c0b06', 'Tottenham Hotspur', 'English Premier League', 'England'),
  ('a11b33fa-0b5c-4be2-beab-df0eb03c0b07', 'Aston Villa', 'English Premier League', 'England'),
  ('n11b33fa-0b5c-4be2-beab-df0eb03c0b08', 'Newcastle United', 'English Premier League', 'England');

-- Insert team stats
insert into public.team_stats (team_id, home_goals_for, home_goals_against, away_goals_for, away_goals_against, last_10_form) values
  ('a21b33fa-0b5c-4be2-beab-df0eb03c0b01', 2.30, 0.70, 1.95, 0.90, array['W', 'W', 'D', 'W', 'L', 'W', 'W', 'W', 'D', 'W']),
  ('c11b33fa-0b5c-4be2-beab-df0eb03c0b02', 1.80, 1.20, 1.45, 1.55, array['W', 'L', 'D', 'W', 'D', 'L', 'W', 'W', 'D', 'W']),
  ('l11b33fa-0b5c-4be2-beab-df0eb03c0b03', 2.45, 0.85, 2.10, 1.05, array['W', 'W', 'W', 'D', 'W', 'W', 'L', 'W', 'W', 'W']),
  ('m11b33fa-0b5c-4be2-beab-df0eb03c0b04', 2.75, 0.90, 2.20, 1.10, array['W', 'W', 'D', 'W', 'W', 'W', 'W', 'D', 'L', 'W']),
  ('m21b33fa-0b5c-4be2-beab-df0eb03c0b05', 1.65, 1.15, 1.30, 1.40, array['L', 'W', 'D', 'L', 'W', 'L', 'W', 'D', 'W', 'L']),
  ('t11b33fa-0b5c-4be2-beab-df0eb03c0b06', 2.10, 1.40, 1.70, 1.65, array['W', 'L', 'W', 'W', 'L', 'D', 'W', 'L', 'W', 'D']),
  ('a11b33fa-0b5c-4be2-beab-df0eb03c0b07', 1.95, 1.10, 1.50, 1.45, array['W', 'D', 'W', 'L', 'D', 'W', 'W', 'L', 'W', 'L']),
  ('n11b33fa-0b5c-4be2-beab-df0eb03c0b08', 2.25, 1.00, 1.35, 1.60, array['L', 'W', 'W', 'D', 'L', 'W', 'L', 'W', 'W', 'D']);

-- Insert matches
-- We'll schedule matches for Today, Tomorrow, and Next Week
insert into public.matches (id, home_team_id, away_team_id, kickoff_time, league) values
  -- Today's matches
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c01', 'l11b33fa-0b5c-4be2-beab-df0eb03c0b03', 'c11b33fa-0b5c-4be2-beab-df0eb03c0b02', now() + interval '3 hours', 'English Premier League'),
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c02', 'm11b33fa-0b5c-4be2-beab-df0eb03c0b04', 'm21b33fa-0b5c-4be2-beab-df0eb03c0b05', now() + interval '6 hours', 'English Premier League'),
  -- Tomorrow's matches
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c03', 'a21b33fa-0b5c-4be2-beab-df0eb03c0b01', 'a11b33fa-0b5c-4be2-beab-df0eb03c0b07', now() + interval '1 day + 2 hours', 'English Premier League'),
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c04', 't11b33fa-0b5c-4be2-beab-df0eb03c0b06', 'n11b33fa-0b5c-4be2-beab-df0eb03c0b08', now() + interval '1 day + 5 hours', 'English Premier League'),
  -- Upcoming matches
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c05', 'c11b33fa-0b5c-4be2-beab-df0eb03c0b02', 'm11b33fa-0b5c-4be2-beab-df0eb03c0b04', now() + interval '3 days', 'English Premier League'),
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c06', 'm21b33fa-0b5c-4be2-beab-df0eb03c0b05', 'l11b33fa-0b5c-4be2-beab-df0eb03c0b03', now() + interval '4 days', 'English Premier League'),
  -- Past completed match (for backtesting/results check)
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c07', 'a21b33fa-0b5c-4be2-beab-df0eb03c0b01', 'c11b33fa-0b5c-4be2-beab-df0eb03c0b02', now() - interval '2 days', 'English Premier League');

-- Insert predictions
insert into public.predictions (
  match_id,
  handicap_line, handicap_probability, handicap_fair_odds, handicap_market_odds, handicap_edge_percent, confidence_score,
  total_line, over_probability, under_probability, ou_edge_percent,
  home_probability, draw_probability, away_probability
) values
  -- Liverpool vs Chelsea (AH Liverpool -0.25, ML Liverpool, Over 2.5)
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c01', 
   -0.25, 0.58, 1.72, 1.95, 13.3, 82, 
   2.5, 0.67, 0.33, 6.4, 
   0.55, 0.25, 0.20),
   
  -- Manchester City vs Manchester United (AH Man City -1.25, Over 3.0)
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c02', 
   -1.25, 0.61, 1.64, 1.85, 12.8, 88, 
   3.0, 0.62, 0.38, 4.2, 
   0.68, 0.18, 0.14),
   
  -- Arsenal vs Aston Villa (AH Arsenal -0.75, Over 2.5)
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c03', 
   -0.75, 0.54, 1.85, 1.91, 3.2, 75, 
   2.5, 0.59, 0.41, 1.8, 
   0.52, 0.26, 0.22),
   
  -- Tottenham vs Newcastle (AH Tottenham -0.25, Over 3.0)
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c04', 
   -0.25, 0.51, 1.96, 2.10, 7.1, 78, 
   3.0, 0.69, 0.31, 8.5, 
   0.45, 0.24, 0.31),
   
  -- Chelsea vs Manchester City (AH Man City -0.5, Under 2.5)
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c05', 
   -0.50, 0.57, 1.75, 1.90, 8.6, 81, 
   2.5, 0.46, 0.54, 5.1, 
   0.28, 0.27, 0.45),
   
  -- Manchester United vs Liverpool (AH Liverpool -0.5, Over 2.5)
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c06', 
   -0.50, 0.59, 1.69, 1.87, 10.7, 84, 
   2.5, 0.64, 0.36, 5.8, 
   0.24, 0.25, 0.51),

  -- Past Match: Arsenal vs Chelsea (For backtesting metrics)
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c07', 
   -0.50, 0.55, 1.82, 1.75, -3.8, 70, 
   2.5, 0.58, 0.42, 2.5, 
   0.48, 0.28, 0.24);

-- Insert prediction results for the past match
-- Suppose Arsenal won 2-1
insert into public.prediction_results (match_id, model_version, prediction_type, predicted_value, actual_result, correct) values
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c07', 'poisson_v1.0', 'moneyline', 'home_win', 'home_win', true),
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c07', 'poisson_v1.0', 'asian_handicap', 'home_-0.50', 'home_-0.50', true),
  ('e11b33fa-0b5c-4be2-beab-df0eb03c0c07', 'poisson_v1.0', 'over_under', 'over_2.5', 'over_2.5', true);
