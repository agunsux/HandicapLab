# Dribble360 Capability Audit

**Discovery Date:** 2026-09-30T09:50:43.963Z
**Total API Calls Used:** 35/200
**Provider Status:** TRIAL_VALIDATION

---

## G1 — Odds Capability

**Status: NOT AVAILABLE**

Dribble360 does not appear to provide odds data through any discovered endpoint.
Evaluate as a **data/statistics/xG provider only**.

---

## Endpoint Capability Matrix

| Capability | Exists | Endpoint | Parameters | Cost | Useful For | Evidence |
|---|---|---|---|---|---|---|
| Matches (current season) | ✅ | `/matches` | {"season":"2025/2026"} | 1 call | Fixtures, results, scores, status | HTTP 200, 1000 records, 2607ms, fields: id, coverage_level, date, description, week, status, length_ |
| Matches (2024/2025) | ✅ | `/matches` | {"season":"2024/2025"} | 1 call | Historical match data coverage | HTTP 200, 1000 records, 2071ms, fields: id, coverage_level, date, description, week, status, length_ |
| Matches (2023/2024) | ✅ | `/matches` | {"season":"2023/2024"} | 1 call | Historical match data coverage | HTTP 200, 1000 records, 936ms, fields: id, coverage_level, date, description, week, status, length_m |
| Matches (2022/2023) | ✅ | `/matches` | {"season":"2022/2023"} | 1 call | Historical match data coverage | HTTP 200, 1000 records, 929ms, fields: id, coverage_level, date, description, week, status, length_m |
| Matches (2021/2022) | ✅ | `/matches` | {"season":"2021/2022"} | 1 call | Historical match data coverage | HTTP 200, 1000 records, 702ms, fields: id, coverage_level, date, description, week, status, length_m |
| Matches (2020/2021) | ✅ | `/matches` | {"season":"2020/2021"} | 1 call | Historical match data coverage | HTTP 200, 1000 records, 1447ms, fields: id, coverage_level, date, description, week, status, length_ |
| Matches (2019/2020) | ✅ | `/matches` | {"season":"2019/2020"} | 1 call | Historical match data coverage | HTTP 200, 1000 records, 1540ms, fields: id, coverage_level, date, description, week, status, length_ |
| Teams | ✅ | `/teams` | {} | 1 call | Team identity, metadata | HTTP 200, 1000 records, 5704ms, fields: id, name, short_name, official_name, code, country_id, last_ |
| Team Matches | ✅ | `/team_matches` | {"season":"2025/2026"} | 1 call | Team-level match stats, xG | HTTP 200, 1000 records, 2474ms, fields: match_id, team_id, side, formation, last_updated, red_cards, |
| Player Matches | ✅ | `/player_matches` | {"season":"2025/2026"} | 1 call | Player-level match stats | HTTP 200, 1000 records, 2403ms, fields: match_id, team_id, player_id, shirt_number, position, positi |
| Players | ✅ | `/players` | {} | 1 call | Player metadata | HTTP 200, 1000 records, 2014ms, fields: id, first_name, last_name, name, short_first_name, short_las |
| Leagues/Competitions | ❌ | `/leagues` | {} | 1 call | Competition IDs, names | HTTP 404: true |
| Seasons | ❌ | `/seasons` | {} | 1 call | Available seasons | HTTP 404: true |
| Standings | ❌ | `/standings` | {"season":"2025/2026"} | 1 call | League tables | HTTP 404: true |
| Managers | ✅ | `/managers` | {} | 1 call | Manager metadata | HTTP 200, 1000 records, 2590ms, fields: match_id, team_id, manager_id, type, last_updated, match_slu |
| Referees | ✅ | `/referees` | {} | 1 call | Referee metadata | HTTP 200, 1000 records, 1746ms, fields: match_id, referee_id, type, red_cards, yellow_cards, second_ |
| Transfers | ✅ | `/transfers` | {} | 1 call | Transfer data | HTTP 200, 1000 records, 2096ms, fields: player_id, start_date, end_date, from_team_id, to_team_id, t |
| Injuries | ❌ | `/injuries` | {"season":"2025/2026"} | 1 call | Injury reports | HTTP 404: true |
| Lineups | ❌ | `/lineups` | {"season":"2025/2026"} | 1 call | Match lineups | HTTP 404: true |
| Events | ❌ | `/events` | {"season":"2025/2026"} | 1 call | Match events | HTTP 404: true |
| Statistics | ❌ | `/statistics` | {"season":"2025/2026"} | 1 call | Match/team statistics | HTTP 404: true |
| Venues | ❌ | `/venues` | {} | 1 call | Stadium/venue data | HTTP 404: true |
| H2H | ❌ | `/h2h` | {} | 1 call | Head-to-head data | HTTP 404: true |
| Form | ❌ | `/form` | {} | 1 call | Team form | HTTP 404: true |
| Odds: Odds (dedicated) | ❌ | `/odds` | {} | 1 call | AH/OU/BTTS odds | HTTP 404: true |
| Odds: Fixture Odds | ❌ | `/fixtures/odds` | {} | 1 call | AH/OU/BTTS odds | HTTP 404: true |
| Odds: Bookmakers | ❌ | `/bookmakers` | {} | 1 call | AH/OU/BTTS odds | HTTP 404: true |
| Odds: Markets | ❌ | `/markets` | {} | 1 call | AH/OU/BTTS odds | HTTP 404: true |
| Odds: Closing Odds | ❌ | `/closing-odds` | {} | 1 call | AH/OU/BTTS odds | HTTP 404: true |
| Odds: Odds by Match | ❌ | `/odds` | {"season":"2025/2026"} | 1 call | AH/OU/BTTS odds | HTTP 404: true |
| Odds: Prematch Odds | ❌ | `/prematch-odds` | {} | 1 call | AH/OU/BTTS odds | HTTP 404: true |
| Odds: Match Odds | ❌ | `/match_odds` | {} | 1 call | AH/OU/BTTS odds | HTTP 404: true |
| Matches (page 2) | ✅ | `/matches` | {"season":"2025/2026","page":2} | 1 call | Pagination test | HTTP 200, 1000 records, 3052ms, fields: id, coverage_level, date, description, week, status, length_ |
| Matches (limit 50) | ✅ | `/matches` | {"season":"2025/2026","limit":50} | 1 call | Limit parameter test | HTTP 200, 50 records, 2291ms, fields: id, coverage_level, date, description, week, status, length_mi |
| Matches (offset) | ✅ | `/matches` | {"season":"2025/2026","offset":100} | 1 call | Offset parameter test | HTTP 200, 1000 records, 759ms, fields: id, coverage_level, date, description, week, status, length_m |

---

## Schema Summary

### `/matches`

- **Records:** 1000
- **Fields:** id, coverage_level, date, description, week, status, length_min, length_sec, second_half_start_min, home_score, away_score, winner, attendance, venue_id, season_id, last_updated, slug, match_phase, home_et_score, away_et_score, home_penalties, away_penalties

```json
{
  "id": "string",
  "coverage_level": "number",
  "date": "string",
  "description": "string",
  "week": "number",
  "status": "string",
  "length_min": "null",
  "length_sec": "null",
  "second_half_start_min": "number",
  "home_score": "number",
  "away_score": "number",
  "winner": "null",
  "attendance": "null",
  "venue_id": "null",
  "season_id": "string",
  "last_updated": "string",
  "slug": "string",
  "match_phase": "null",
  "home_et_score": "null",
  "away_et_score": "null",
  "home_penalties": "null",
  "away_penalties": "null"
}
```

### `/teams`

- **Records:** 1000
- **Fields:** id, name, short_name, official_name, code, country_id, last_updated, slug, short_slug, official_slug, api_football_id

```json
{
  "id": "string",
  "name": "string",
  "short_name": "string",
  "official_name": "null",
  "code": "null",
  "country_id": "null",
  "last_updated": "string",
  "slug": "string",
  "short_slug": "string",
  "official_slug": "null",
  "api_football_id": "null"
}
```

### `/team_matches`

- **Records:** 1000
- **Fields:** match_id, team_id, side, formation, last_updated, red_cards, yellow_cards, second_yellow_cards, penalties, accurate_pass, blocked_scoring_att, clean_sheet, corner_taken, fk_foul_won, fk_foul_lost, goal_assist, goal_kicks, goals, goals_conceded, lost_corners, midfielder_goals, own_goals, pen_goals_conceded, penalty_conceded, penalty_save, penalty_won, possession_percentage, saves, second_yellow, shot_off_target, subs_made, total_clearance, total_offside, total_pass, total_scoring_att, total_sub_on, total_tackle, total_throws, total_yellow_card, total_red_card, won_corners, won_tackle, penalty_faced, rescinded_red_card, accurate_back_zone_pass, accurate_corners_intobox, accurate_cross, accurate_cross_nocorner, accurate_fwd_zone_pass, accurate_goal_kicks, accurate_keeper_throws, accurate_launches, accurate_layoffs, accurate_long_balls, accurate_through_ball, accurate_throws, aerial_lost, aerial_won, att_bx_centre, att_bx_left, att_bx_right, att_cmiss_high, att_cmiss_high_left, att_cmiss_high_right, att_cmiss_left, att_cmiss_right, att_obx_centre, att_obx_left, att_obx_right, att_obxd_left, att_obxd_right, att_corner, att_fastbreak, att_freekick_goal, att_freekick_miss, att_freekick_post, att_freekick_target, att_freekick_total, att_goal_high_centre, att_goal_high_left, att_goal_high_right, att_goal_low_centre, att_goal_low_left, att_goal_low_right, att_hd_goal, att_hd_miss, att_hd_post, att_hd_target, att_hd_total, att_ibox_blocked, att_ibox_goal, att_ibox_miss, att_ibox_post, att_ibox_target, att_ibox_own_goal, att_obox_own_goal, att_lf_goal, att_lf_target, att_lf_total, att_lg_centre, att_lg_left, att_lg_right, att_miss_high, att_miss_high_left, att_miss_high_right, att_miss_left, att_miss_right, att_obox_blocked, att_obox_goal, att_obox_miss, att_obox_post, att_obox_target, att_obp_goal, att_one_on_one, att_openplay, att_pen_goal, att_pen_miss, att_pen_post, att_pen_target, att_post_high, att_post_left, att_post_right, att_rf_goal, att_rf_target, att_rf_total, att_setpiece, att_sv_high_centre, att_sv_high_left, att_sv_high_right, att_sv_low_centre, att_sv_low_left, att_sv_low_right, attempts_ibox, attempts_obox, attempts_conceded_ibox, attempts_conceded_obox, back_pass, ball_recovery, challenge_lost, clearance_off_line, contentious_decision, cross_not_claimed, crosses_18yard, crosses_18yardplus, dangerous_play, defender_goals, dispossessed, dive_catch, dive_save, duel_lost, duel_won, effective_clearance, effective_head_clearance, error_lead_to_goal, error_lead_to_shot, final_third_entries, first_half_goals, formation_used, forward_goals, fouled_final_third, goal_assist_intentional, goals_conceded_ibox, goals_conceded_obox, good_high_claim, goals_openplay, hand_ball, head_clearance, interception, interceptions_in_box, keeper_throws, last_man_tackle, long_pass_own_to_opp, long_pass_own_to_opp_success, offside_provoked, offtarget_att_assist, ontarget_att_assist, ontarget_scoring_att, outfielder_block, own_goal_accrued, passes_left, passes_right, post_scoring_att, punches, pts_dropped_winning_pos, pts_gained_losing_pos, saved_ibox, saved_obox, six_second_violation, six_yard_block, stand_catch, stand_save, total_att_assist, total_back_zone_pass, total_contest, total_corners_intobox, total_cross, total_cross_nocorner, total_fastbreak, total_fwd_zone_pass, total_high_claim, total_launches, total_layoffs, total_long_balls, total_through_ball, touches, touches_in_opp_box, turnover, won_contest, total_flick_on, accurate_flick_on, total_chipped_pass, accurate_chipped_pass, blocked_cross, shield_ball_oop, foul_throw_in, effective_blocked_cross, total_pull_back, accurate_pull_back, total_keeper_sweeper, accurate_keeper_sweeper, goal_assist_openplay, goal_assist_setplay, att_assist_openplay, att_assist_setplay, overrun, interception_won, big_chance_created, big_chance_missed, big_chance_scored, unsuccessful_touch, fwd_pass, backward_pass, leftside_pass, rightside_pass, successful_final_third_passes, total_final_third_passes, diving_save, poss_won_def_3rd, poss_won_mid_3rd, poss_won_att_3rd, poss_lost_all, poss_lost_ctrl, goal_fastbreak, shot_fastbreak, pen_area_entries, hit_woodwork, goal_assist_deadball, freekick_cross, accurate_freekick_cross, open_play_pass, successful_open_play_pass, attempted_tackle_foul, blocked_pass, assist_pass_lost, assist_blocked_shot, assist_attempt_saved, assist_post, assist_free_kick_won, assist_handball_won, assist_own_goal, assist_penalty_won, shots_conc_onfield, subs_goals, keeper_goals, opposition_passes, defensive_actions, ppda, big_chance_saves, direct_corner_goals, direct_setpiece_goals, expected_goals, expected_goals_hd, expected_goals_nonpenalty, expected_goals_openplay, expected_goals_setplay, expected_goals_lf, expected_goals_rf, expected_goals_freekick, expected_goals_conceded, expected_goals_nonpenalty_conceded, expected_goals_ontarget, expected_goals_ontarget_nonpenalty, expected_goals_ontarget_freekick, expected_goals_ontarget_conceded, expected_goals_ontarget_nonpenalty_conceded, expected_assists, expected_assists_setplay, expected_assists_openplay, match_slug, sca, gca, sca_pass_live, sca_pass_dead, sca_take_on, sca_shot, sca_fouled, sca_def, gca_pass_live, gca_pass_dead, gca_take_on, gca_shot, gca_fouled, gca_def

```json
{
  "match_id": "string",
  "team_id": "string",
  "side": "string",
  "formation": "string",
  "last_updated": "string",
  "red_cards": "null",
  "yellow_cards": "null",
  "second_yellow_cards": "null",
  "penalties": "null",
  "accurate_pass": "number",
  "blocked_scoring_att": "number",
  "clean_sheet": "null",
  "corner_taken": "number",
  "fk_foul_won": "null",
  "fk_foul_lost": "null",
  "goal_assist": "number",
  "goal_kicks": "number",
  "goals": "number",
  "goals_conceded": "number",
  "lost_corners": "number",
  "midfielder_goals": "null",
  "own_goals": "null",
  "pen_goals_conceded": "number",
  "penalty_conceded": "number",
  "penalty_save": "null",
  "penalty_won": "null",
  "possession_percentage": "null",
  "saves": "number",
  "second_yellow": "number",
  "shot_off_target": "number",
  "subs_made": "number",
  "total_clearance": "number",
  "total_offside": "number",
  "total_pass": "number",
  "total_scoring_att": "number",
  "total_sub_on": "number",
  "total_tackle": "number",
  "total_throws": "number",
  "total_yellow_card": "number",
  "total_red_card": "number",
  "won_corners": "number",
  "won_tackle": "number",
  "penalty_faced": "number",
  "rescinded_red_card": "null",
  "accurate_back_zone_pass": "number",
  "accurate_corners_intobox": "null",
  "accurate_cross": "number",
  "accurate_cross_nocorner": "number",
  "accurate_fwd_zone_pass": "number",
  "accurate_goal_kicks": "number",
  "accurate_keeper_throws": "number",
  "accurate_launches": "number",
  "accurate_layoffs": "number",
  "accurate_long_balls": "number",
  "accurate_through_ball": "number",
  "accurate_throws": "number",
  "aerial_lost": "number",
  "aerial_won": "number",
  "att_bx_centre": "number",
  "att_bx_left": "number",
  "att_bx_right": "number",
  "att_cmiss_high": "null",
  "att_cmiss_high_left": "number",
  "att_cmiss_high_right": "null",
  "att_cmiss_left": "number",
  "att_cmiss_right": "null",
  "att_obx_centre": "number",
  "att_obx_left": "null",
  "att_obx_right": "null",
  "att_obxd_left": "null",
  "att_obxd_right": "null",
  "att_corner": "number",
  "att_fastbreak": "number",
  "att_freekick_goal": "null",
  "att_freekick_miss": "null",
  "att_freekick_post": "null",
  "att_freekick_target": "null",
  "att_freekick_total": "null",
  "att_goal_high_centre": "null",
  "att_goal_high_left": "null",
  "att_goal_high_right": "number",
  "att_goal_low_centre": "null",
  "att_goal_low_left": "null",
  "att_goal_low_right": "null",
  "att_hd_goal": "null",
  "att_hd_miss": "number",
  "att_hd_post": "null",
  "att_hd_target": "number",
  "att_hd_total": "number",
  "att_ibox_blocked": "number",
  "att_ibox_goal": "number",
  "att_ibox_miss": "number",
  "att_ibox_post": "null",
  "att_ibox_target": "number",
  "att_ibox_own_goal": "null",
  "att_obox_own_goal": "null",
  "att_lf_goal": "null",
  "att_lf_target": "number",
  "att_lf_total": "number",
  "att_lg_centre": "null",
  "att_lg_left": "null",
  "att_lg_right": "null",
  "att_miss_high": "number",
  "att_miss_high_left": "number",
  "att_miss_high_right": "null",
  "att_miss_left": "number",
  "att_miss_right": "null",
  "att_obox_blocked": "number",
  "att_obox_goal": "null",
  "att_obox_miss": "number",
  "att_obox_post": "null",
  "att_obox_target": "number",
  "att_obp_goal": "null",
  "att_one_on_one": "null",
  "att_openplay": "number",
  "att_pen_goal": "null",
  "att_pen_miss": "null",
  "att_pen_post": "null",
  "att_pen_target": "null",
  "att_post_high": "null",
  "att_post_left": "null",
  "att_post_right": "null",
  "att_rf_goal": "number",
  "att_rf_target": "number",
  "att_rf_total": "number",
  "att_setpiece": "number",
  "att_sv_high_centre": "number",
  "att_sv_high_left": "number",
  "att_sv_high_right": "null",
  "att_sv_low_centre": "number",
  "att_sv_low_left": "null",
  "att_sv_low_right": "null",
  "attempts_ibox": "number",
  "attempts_obox": "number",
  "attempts_conceded_ibox": "number",
  "attempts_conceded_obox": "number",
  "back_pass": "null",
  "ball_recovery": "number",
  "challenge_lost": "number",
  "clearance_off_line": "null",
  "contentious_decision": "null",
  "cross_not_claimed": "null",
  "crosses_18yard": "null",
  "crosses_18yardplus": "null",
  "dangerous_play": "null",
  "defender_goals": "null",
  "dispossessed": "number",
  "dive_catch": "null",
  "dive_save": "null",
  "duel_lost": "number",
  "duel_won": "number",
  "effective_clearance": "number",
  "effective_head_clearance": "number",
  "error_lead_to_goal": "null",
  "error_lead_to_shot": "null",
  "final_third_entries": "number",
  "first_half_goals": "null",
  "formation_used": "null",
  "forward_goals": "null",
  "fouled_final_third": "number",
  "goal_assist_intentional": "number",
  "goals_conceded_ibox": "number",
  "goals_conceded_obox": "null",
  "good_high_claim": "number",
  "goals_openplay": "number",
  "hand_ball": "number",
  "head_clearance": "number",
  "interception": "number",
  "interceptions_in_box": "number",
  "keeper_throws": "number",
  "last_man_tackle": "null",
  "long_pass_own_to_opp": "number",
  "long_pass_own_to_opp_success": "number",
  "offside_provoked": "number",
  "offtarget_att_assist": "number",
  "ontarget_att_assist": "number",
  "ontarget_scoring_att": "number",
  "outfielder_block": "number",
  "own_goal_accrued": "null",
  "passes_left": "number",
  "passes_right": "number",
  "post_scoring_att": "null",
  "punches": "number",
  "pts_dropped_winning_pos": "null",
  "pts_gained_losing_pos": "null",
  "saved_ibox": "number",
  "saved_obox": "number",
  "six_second_violation": "null",
  "six_yard_block": "null",
  "stand_catch": "null",
  "stand_save": "null",
  "total_att_assist": "number",
  "total_back_zone_pass": "number",
  "total_contest": "number",
  "total_corners_intobox": "number",
  "total_cross": "number",
  "total_cross_nocorner": "number",
  "total_fastbreak": "number",
  "total_fwd_zone_pass": "number",
  "total_high_claim": "number",
  "total_launches": "number",
  "total_layoffs": "number",
  "total_long_balls": "number",
  "total_through_ball": "number",
  "touches": "number",
  "touches_in_opp_box": "number",
  "turnover": "number",
  "won_contest": "number",
  "total_flick_on": "number",
  "accurate_flick_on": "number",
  "total_chipped_pass": "number",
  "accurate_chipped_pass": "number",
  "blocked_cross": "number",
  "shield_ball_oop": "number",
  "foul_throw_in": "null",
  "effective_blocked_cross": "number",
  "total_pull_back": "null",
  "accurate_pull_back": "null",
  "total_keeper_sweeper": "null",
  "accurate_keeper_sweeper": "null",
  "goal_assist_openplay": "number",
  "goal_assist_setplay": "null",
  "att_assist_openplay": "number",
  "att_assist_setplay": "number",
  "overrun": "null",
  "interception_won": "number",
  "big_chance_created": "number",
  "big_chance_missed": "null",
  "big_chance_scored": "number",
  "unsuccessful_touch": "number",
  "fwd_pass": "number",
  "backward_pass": "number",
  "leftside_pass": "number",
  "rightside_pass": "number",
  "successful_final_third_passes": "number",
  "total_final_third_passes": "number",
  "diving_save": "number",
  "poss_won_def_3rd": "null",
  "poss_won_mid_3rd": "null",
  "poss_won_att_3rd": "null",
  "poss_lost_all": "number",
  "poss_lost_ctrl": "number",
  "goal_fastbreak": "null",
  "shot_fastbreak": "number",
  "pen_area_entries": "number",
  "hit_woodwork": "null",
  "goal_assist_deadball": "null",
  "freekick_cross": "number",
  "accurate_freekick_cross": "number",
  "open_play_pass": "number",
  "successful_open_play_pass": "number",
  "attempted_tackle_foul": "number",
  "blocked_pass": "number",
  "assist_pass_lost": "null",
  "assist_blocked_shot": "null",
  "assist_attempt_saved": "null",
  "assist_post": "null",
  "assist_free_kick_won": "null",
  "assist_handball_won": "null",
  "assist_own_goal": "null",
  "assist_penalty_won": "null",
  "shots_conc_onfield": "null",
  "subs_goals": "number",
  "keeper_goals": "null",
  "opposition_passes": "null",
  "defensive_actions": "null",
  "ppda": "null",
  "big_chance_saves": "number",
  "direct_corner_goals": "null",
  "direct_setpiece_goals": "null",
  "expected_goals": "number",
  "expected_goals_hd": "number",
  "expected_goals_nonpenalty": "number",
  "expected_goals_openplay": "number",
  "expected_goals_setplay": "number",
  "expected_goals_lf": "number",
  "expected_goals_rf": "number",
  "expected_goals_freekick": "null",
  "expected_goals_conceded": "number",
  "expected_goals_nonpenalty_conceded": "number",
  "expected_goals_ontarget": "null",
  "expected_goals_ontarget_nonpenalty": "null",
  "expected_goals_ontarget_freekick": "null",
  "expected_goals_ontarget_conceded": "null",
  "expected_goals_ontarget_nonpenalty_conceded": "null",
  "expected_assists": "number",
  "expected_assists_setplay": "number",
  "expected_assists_openplay": "number",
  "match_slug": "string",
  "sca": "null",
  "gca": "null",
  "sca_pass_live": "null",
  "sca_pass_dead": "null",
  "sca_take_on": "null",
  "sca_shot": "null",
  "sca_fouled": "null",
  "sca_def": "null",
  "gca_pass_live": "null",
  "gca_pass_dead": "null",
  "gca_take_on": "null",
  "gca_shot": "null",
  "gca_fouled": "null",
  "gca_def": "null"
}
```

### `/player_matches`

- **Records:** 1000
- **Fields:** match_id, team_id, player_id, shirt_number, position, position_side, formation_place, last_updated, red_cards, yellow_cards, second_yellow_cards, penalties, accurate_pass, blocked_scoring_att, clean_sheet, corner_taken, fouls, goal_assist, goal_kicks, goals, goals_conceded, lost_corners, mins_played, own_goals, own_goals_conceded, pen_goals_conceded, penalty_conceded, penalty_save, penalty_won, red_card, saves, second_yellow, shot_off_target, total_clearance, total_offside, total_pass, total_scoring_att, total_sub_off, total_sub_on, total_tackle, total_throws, was_fouled, won_corners, won_tackle, yellow_card, penalty_faced, rescinded_red_card, accurate_back_zone_pass, accurate_corners_intobox, accurate_cross, accurate_cross_nocorner, accurate_fwd_zone_pass, accurate_goal_kicks, accurate_keeper_throws, accurate_launches, accurate_layoffs, accurate_long_balls, accurate_through_ball, accurate_throws, aerial_lost, aerial_won, att_bx_centre, att_bx_left, att_bx_right, att_cmiss_high, att_cmiss_high_left, att_cmiss_high_right, att_cmiss_left, att_cmiss_right, att_obx_centre, att_obx_left, att_obx_right, att_obxd_left, att_obxd_right, att_corner, att_fastbreak, att_freekick_goal, att_freekick_miss, att_freekick_post, att_freekick_target, att_freekick_total, att_goal_high_centre, att_goal_high_left, att_goal_high_right, att_goal_low_centre, att_goal_low_left, att_goal_low_right, att_hd_goal, att_hd_miss, att_hd_post, att_hd_target, att_hd_total, att_ibox_blocked, att_ibox_goal, att_ibox_miss, att_ibox_post, att_ibox_target, att_ibox_own_goal, att_obox_own_goal, att_lf_goal, att_lf_target, att_lf_total, att_lg_centre, att_lg_left, att_lg_right, att_miss_high, att_miss_high_left, att_miss_high_right, att_miss_left, att_miss_right, att_obox_blocked, att_obox_goal, att_obox_miss, att_obox_post, att_obox_target, att_obp_goal, att_one_on_one, att_openplay, att_pen_goal, att_pen_miss, att_pen_post, att_pen_target, att_post_high, att_post_left, att_post_right, att_rf_goal, att_rf_target, att_rf_total, att_setpiece, att_sv_high_centre, att_sv_high_left, att_sv_high_right, att_sv_low_centre, att_sv_low_left, att_sv_low_right, attempts_ibox, attempts_obox, attempts_conceded_ibox, attempts_conceded_obox, back_pass, ball_recovery, challenge_lost, clearance_off_line, contentious_decision, cross_not_claimed, crosses_18yard, crosses_18yardplus, dangerous_play, dispossessed, dive_catch, dive_save, duel_lost, duel_won, effective_clearance, effective_head_clearance, error_lead_to_goal, error_lead_to_shot, final_third_entries, first_half_goals, fouled_final_third, gk_smother, goal_assist_intentional, goals_conceded_ibox, goals_conceded_obox, good_high_claim, goals_openplay, hand_ball, head_clearance, head_pass, interception, interceptions_in_box, keeper_pick_up, keeper_throws, last_man_tackle, long_pass_own_to_opp, long_pass_own_to_opp_success, offtarget_att_assist, ontarget_att_assist, ontarget_scoring_att, outfielder_block, passes_left, passes_right, post_scoring_att, punches, saved_ibox, saved_obox, six_second_violation, six_yard_block, stand_catch, stand_save, total_att_assist, total_back_zone_pass, total_contest, total_corners_intobox, total_cross, total_cross_nocorner, total_fastbreak, total_fwd_zone_pass, total_high_claim, total_launches, total_layoffs, total_long_balls, total_through_ball, touches, touches_in_opp_box, turnover, won_contest, total_flick_on, accurate_flick_on, total_chipped_pass, accurate_chipped_pass, blocked_cross, shield_ball_oop, foul_throw_in, effective_blocked_cross, total_pull_back, accurate_pull_back, total_keeper_sweeper, accurate_keeper_sweeper, goal_assist_openplay, goal_assist_setplay, att_assist_openplay, att_assist_setplay, overrun, interception_won, big_chance_created, big_chance_missed, big_chance_scored, unsuccessful_touch, fwd_pass, backward_pass, leftside_pass, rightside_pass, successful_final_third_passes, total_final_third_passes, diving_save, poss_won_def_3rd, poss_won_mid_3rd, poss_won_att_3rd, poss_lost_all, poss_lost_ctrl, goal_fastbreak, shot_fastbreak, pen_area_entries, hit_woodwork, goal_assist_deadball, freekick_cross, accurate_freekick_cross, open_play_pass, successful_open_play_pass, attempted_tackle_foul, fifty_fifty, successful_fifty_fifty, blocked_pass, assist_pass_lost, assist_blocked_shot, assist_attempt_saved, assist_post, assist_free_kick_won, assist_handball_won, assist_own_goal, assist_penalty_won, shots_conc_onfield, second_goal_assist, winning_goal, times_tackled, big_chance_saves, carries, progressive_carries, direct_corner_goals, direct_setpiece_goals, expected_goals, expected_goals_hd, expected_goals_nonpenalty, expected_goals_openplay, expected_goals_setplay, expected_goals_lf, expected_goals_rf, expected_goals_freekick, expected_goals_conceded, expected_goals_nonpenalty_conceded, expected_goals_ontarget, expected_goals_ontarget_nonpenalty, expected_goals_ontarget_freekick, expected_goals_ontarget_conceded, expected_goals_ontarget_nonpenalty_conceded, expected_assists, expected_assists_setplay, expected_assists_openplay, match_slug, sca, gca, sca_pass_live, sca_pass_dead, sca_take_on, sca_shot, sca_fouled, sca_def, gca_pass_live, gca_pass_dead, gca_take_on, gca_shot, gca_fouled, gca_def, opponent_team_id, side, assists

```json
{
  "match_id": "string",
  "team_id": "string",
  "player_id": "string",
  "shirt_number": "number",
  "position": "string",
  "position_side": "null",
  "formation_place": "null",
  "last_updated": "string",
  "red_cards": "null",
  "yellow_cards": "null",
  "second_yellow_cards": "null",
  "penalties": "null",
  "accurate_pass": "null",
  "blocked_scoring_att": "null",
  "clean_sheet": "null",
  "corner_taken": "null",
  "fouls": "null",
  "goal_assist": "null",
  "goal_kicks": "null",
  "goals": "null",
  "goals_conceded": "null",
  "lost_corners": "null",
  "mins_played": "null",
  "own_goals": "null",
  "own_goals_conceded": "null",
  "pen_goals_conceded": "null",
  "penalty_conceded": "null",
  "penalty_save": "null",
  "penalty_won": "null",
  "red_card": "null",
  "saves": "null",
  "second_yellow": "null",
  "shot_off_target": "null",
  "total_clearance": "null",
  "total_offside": "null",
  "total_pass": "null",
  "total_scoring_att": "null",
  "total_sub_off": "null",
  "total_sub_on": "null",
  "total_tackle": "null",
  "total_throws": "null",
  "was_fouled": "null",
  "won_corners": "null",
  "won_tackle": "null",
  "yellow_card": "null",
  "penalty_faced": "null",
  "rescinded_red_card": "null",
  "accurate_back_zone_pass": "null",
  "accurate_corners_intobox": "null",
  "accurate_cross": "null",
  "accurate_cross_nocorner": "null",
  "accurate_fwd_zone_pass": "null",
  "accurate_goal_kicks": "null",
  "accurate_keeper_throws": "null",
  "accurate_launches": "null",
  "accurate_layoffs": "null",
  "accurate_long_balls": "null",
  "accurate_through_ball": "null",
  "accurate_throws": "null",
  "aerial_lost": "null",
  "aerial_won": "null",
  "att_bx_centre": "null",
  "att_bx_left": "null",
  "att_bx_right": "null",
  "att_cmiss_high": "null",
  "att_cmiss_high_left": "null",
  "att_cmiss_high_right": "null",
  "att_cmiss_left": "null",
  "att_cmiss_right": "null",
  "att_obx_centre": "null",
  "att_obx_left": "null",
  "att_obx_right": "null",
  "att_obxd_left": "null",
  "att_obxd_right": "null",
  "att_corner": "null",
  "att_fastbreak": "null",
  "att_freekick_goal": "null",
  "att_freekick_miss": "null",
  "att_freekick_post": "null",
  "att_freekick_target": "null",
  "att_freekick_total": "null",
  "att_goal_high_centre": "null",
  "att_goal_high_left": "null",
  "att_goal_high_right": "null",
  "att_goal_low_centre": "null",
  "att_goal_low_left": "null",
  "att_goal_low_right": "null",
  "att_hd_goal": "null",
  "att_hd_miss": "null",
  "att_hd_post": "null",
  "att_hd_target": "null",
  "att_hd_total": "null",
  "att_ibox_blocked": "null",
  "att_ibox_goal": "null",
  "att_ibox_miss": "null",
  "att_ibox_post": "null",
  "att_ibox_target": "null",
  "att_ibox_own_goal": "null",
  "att_obox_own_goal": "null",
  "att_lf_goal": "null",
  "att_lf_target": "null",
  "att_lf_total": "null",
  "att_lg_centre": "null",
  "att_lg_left": "null",
  "att_lg_right": "null",
  "att_miss_high": "null",
  "att_miss_high_left": "null",
  "att_miss_high_right": "null",
  "att_miss_left": "null",
  "att_miss_right": "null",
  "att_obox_blocked": "null",
  "att_obox_goal": "null",
  "att_obox_miss": "null",
  "att_obox_post": "null",
  "att_obox_target": "null",
  "att_obp_goal": "null",
  "att_one_on_one": "null",
  "att_openplay": "null",
  "att_pen_goal": "null",
  "att_pen_miss": "null",
  "att_pen_post": "null",
  "att_pen_target": "null",
  "att_post_high": "null",
  "att_post_left": "null",
  "att_post_right": "null",
  "att_rf_goal": "null",
  "att_rf_target": "null",
  "att_rf_total": "null",
  "att_setpiece": "null",
  "att_sv_high_centre": "null",
  "att_sv_high_left": "null",
  "att_sv_high_right": "null",
  "att_sv_low_centre": "null",
  "att_sv_low_left": "null",
  "att_sv_low_right": "null",
  "attempts_ibox": "null",
  "attempts_obox": "null",
  "attempts_conceded_ibox": "null",
  "attempts_conceded_obox": "null",
  "back_pass": "null",
  "ball_recovery": "null",
  "challenge_lost": "null",
  "clearance_off_line": "null",
  "contentious_decision": "null",
  "cross_not_claimed": "null",
  "crosses_18yard": "null",
  "crosses_18yardplus": "null",
  "dangerous_play": "null",
  "dispossessed": "null",
  "dive_catch": "null",
  "dive_save": "null",
  "duel_lost": "null",
  "duel_won": "null",
  "effective_clearance": "null",
  "effective_head_clearance": "null",
  "error_lead_to_goal": "null",
  "error_lead_to_shot": "null",
  "final_third_entries": "null",
  "first_half_goals": "null",
  "fouled_final_third": "null",
  "gk_smother": "null",
  "goal_assist_intentional": "null",
  "goals_conceded_ibox": "null",
  "goals_conceded_obox": "null",
  "good_high_claim": "null",
  "goals_openplay": "null",
  "hand_ball": "null",
  "head_clearance": "null",
  "head_pass": "null",
  "interception": "null",
  "interceptions_in_box": "null",
  "keeper_pick_up": "null",
  "keeper_throws": "null",
  "last_man_tackle": "null",
  "long_pass_own_to_opp": "null",
  "long_pass_own_to_opp_success": "null",
  "offtarget_att_assist": "null",
  "ontarget_att_assist": "null",
  "ontarget_scoring_att": "null",
  "outfielder_block": "null",
  "passes_left": "null",
  "passes_right": "null",
  "post_scoring_att": "null",
  "punches": "null",
  "saved_ibox": "null",
  "saved_obox": "null",
  "six_second_violation": "null",
  "six_yard_block": "null",
  "stand_catch": "null",
  "stand_save": "null",
  "total_att_assist": "null",
  "total_back_zone_pass": "null",
  "total_contest": "null",
  "total_corners_intobox": "null",
  "total_cross": "null",
  "total_cross_nocorner": "null",
  "total_fastbreak": "null",
  "total_fwd_zone_pass": "null",
  "total_high_claim": "null",
  "total_launches": "null",
  "total_layoffs": "null",
  "total_long_balls": "null",
  "total_through_ball": "null",
  "touches": "null",
  "touches_in_opp_box": "null",
  "turnover": "null",
  "won_contest": "null",
  "total_flick_on": "null",
  "accurate_flick_on": "null",
  "total_chipped_pass": "null",
  "accurate_chipped_pass": "null",
  "blocked_cross": "null",
  "shield_ball_oop": "null",
  "foul_throw_in": "null",
  "effective_blocked_cross": "null",
  "total_pull_back": "null",
  "accurate_pull_back": "null",
  "total_keeper_sweeper": "null",
  "accurate_keeper_sweeper": "null",
  "goal_assist_openplay": "null",
  "goal_assist_setplay": "null",
  "att_assist_openplay": "null",
  "att_assist_setplay": "null",
  "overrun": "null",
  "interception_won": "null",
  "big_chance_created": "null",
  "big_chance_missed": "null",
  "big_chance_scored": "null",
  "unsuccessful_touch": "null",
  "fwd_pass": "null",
  "backward_pass": "null",
  "leftside_pass": "null",
  "rightside_pass": "null",
  "successful_final_third_passes": "null",
  "total_final_third_passes": "null",
  "diving_save": "null",
  "poss_won_def_3rd": "null",
  "poss_won_mid_3rd": "null",
  "poss_won_att_3rd": "null",
  "poss_lost_all": "null",
  "poss_lost_ctrl": "null",
  "goal_fastbreak": "null",
  "shot_fastbreak": "null",
  "pen_area_entries": "null",
  "hit_woodwork": "null",
  "goal_assist_deadball": "null",
  "freekick_cross": "null",
  "accurate_freekick_cross": "null",
  "open_play_pass": "null",
  "successful_open_play_pass": "null",
  "attempted_tackle_foul": "null",
  "fifty_fifty": "null",
  "successful_fifty_fifty": "null",
  "blocked_pass": "null",
  "assist_pass_lost": "null",
  "assist_blocked_shot": "null",
  "assist_attempt_saved": "null",
  "assist_post": "null",
  "assist_free_kick_won": "null",
  "assist_handball_won": "null",
  "assist_own_goal": "null",
  "assist_penalty_won": "null",
  "shots_conc_onfield": "null",
  "second_goal_assist": "null",
  "winning_goal": "null",
  "times_tackled": "null",
  "big_chance_saves": "null",
  "carries": "null",
  "progressive_carries": "null",
  "direct_corner_goals": "null",
  "direct_setpiece_goals": "null",
  "expected_goals": "null",
  "expected_goals_hd": "null",
  "expected_goals_nonpenalty": "null",
  "expected_goals_openplay": "null",
  "expected_goals_setplay": "null",
  "expected_goals_lf": "null",
  "expected_goals_rf": "null",
  "expected_goals_freekick": "null",
  "expected_goals_conceded": "null",
  "expected_goals_nonpenalty_conceded": "null",
  "expected_goals_ontarget": "null",
  "expected_goals_ontarget_nonpenalty": "null",
  "expected_goals_ontarget_freekick": "null",
  "expected_goals_ontarget_conceded": "null",
  "expected_goals_ontarget_nonpenalty_conceded": "null",
  "expected_assists": "null",
  "expected_assists_setplay": "null",
  "expected_assists_openplay": "null",
  "match_slug": "string",
  "sca": "null",
  "gca": "null",
  "sca_pass_live": "null",
  "sca_pass_dead": "null",
  "sca_take_on": "null",
  "sca_shot": "null",
  "sca_fouled": "null",
  "sca_def": "null",
  "gca_pass_live": "null",
  "gca_pass_dead": "null",
  "gca_take_on": "null",
  "gca_shot": "null",
  "gca_fouled": "null",
  "gca_def": "null",
  "opponent_team_id": "string",
  "side": "string",
  "assists": "null"
}
```

### `/players`

- **Records:** 1000
- **Fields:** id, first_name, last_name, name, short_first_name, short_last_name, match_name, last_updated, slug, known_name, known_slug, short_slug, match_slug, api_football_id, nationality, nationality_id

```json
{
  "id": "string",
  "first_name": "null",
  "last_name": "string",
  "name": "string",
  "short_first_name": "null",
  "short_last_name": "null",
  "match_name": "string",
  "last_updated": "string",
  "slug": "string",
  "known_name": "null",
  "known_slug": "string",
  "short_slug": "null",
  "match_slug": "string",
  "api_football_id": "null",
  "nationality": "null",
  "nationality_id": "null"
}
```

### `/managers`

- **Records:** 1000
- **Fields:** match_id, team_id, manager_id, type, last_updated, match_slug

```json
{
  "match_id": "string",
  "team_id": "string",
  "manager_id": "string",
  "type": "string",
  "last_updated": "string",
  "match_slug": "string"
}
```

### `/referees`

- **Records:** 1000
- **Fields:** match_id, referee_id, type, red_cards, yellow_cards, second_yellow_cards, fouls, penalties, red_cards_overturned, fouls_overturned, penalties_overturned, var_reviews, var_overturns, var_upholds, last_updated, match_slug

```json
{
  "match_id": "string",
  "referee_id": "string",
  "type": "string",
  "red_cards": "number",
  "yellow_cards": "number",
  "second_yellow_cards": "number",
  "fouls": "number",
  "penalties": "number",
  "red_cards_overturned": "number",
  "fouls_overturned": "number",
  "penalties_overturned": "number",
  "var_reviews": "null",
  "var_overturns": "null",
  "var_upholds": "null",
  "last_updated": "string",
  "match_slug": "string"
}
```

### `/transfers`

- **Records:** 1000
- **Fields:** player_id, start_date, end_date, from_team_id, to_team_id, transfer_currency, transfer_value

```json
{
  "player_id": "string",
  "start_date": "string",
  "end_date": "null",
  "from_team_id": "null",
  "to_team_id": "string",
  "transfer_currency": "null",
  "transfer_value": "null"
}
```

---

## Latency Profile

- **p50:** 1182ms
- **p95:** 5704ms
- **max:** 12964ms

---

## Rate Limit Headers

| Endpoint | Limit | Remaining | Reset |
|---|---|---|---|
| /matches | 5000 | 4999 |  |
| /matches | 5000 | 4998 |  |
| /matches | 5000 | 4997 |  |
| /matches | 5000 | 4996 |  |
| /matches | 5000 | 4995 |  |
| /matches | 5000 | 4994 |  |
| /matches | 5000 | 4993 |  |
| /teams | 5000 | 4992 |  |
| /team_matches | 5000 | 4991 |  |
| /player_matches | 5000 | 4990 |  |

---

## xG & Advanced Metrics Assessment

### team_matches xG/stats fields: goal_assist, goal_kicks, goals, goals_conceded, midfielder_goals, own_goals, pen_goals_conceded, possession_percentage, accurate_goal_kicks, att_freekick_goal, att_goal_high_centre, att_goal_high_left, att_goal_high_right, att_goal_low_centre, att_goal_low_left, att_goal_low_right, att_hd_goal, att_ibox_goal, att_ibox_own_goal, att_obox_own_goal, att_lf_goal, att_obox_goal, att_obp_goal, att_pen_goal, att_rf_goal, defender_goals, error_lead_to_goal, first_half_goals, forward_goals, goal_assist_intentional, goals_conceded_ibox, goals_conceded_obox, goals_openplay, offtarget_att_assist, ontarget_att_assist, own_goal_accrued, total_att_assist, goal_assist_openplay, goal_assist_setplay, att_assist_openplay, att_assist_setplay, goal_fastbreak, goal_assist_deadball, assist_pass_lost, assist_blocked_shot, assist_attempt_saved, assist_post, assist_free_kick_won, assist_handball_won, assist_own_goal, assist_penalty_won, shots_conc_onfield, subs_goals, keeper_goals, ppda, direct_corner_goals, direct_setpiece_goals, expected_goals, expected_goals_hd, expected_goals_nonpenalty, expected_goals_openplay, expected_goals_setplay, expected_goals_lf, expected_goals_rf, expected_goals_freekick, expected_goals_conceded, expected_goals_nonpenalty_conceded, expected_goals_ontarget, expected_goals_ontarget_nonpenalty, expected_goals_ontarget_freekick, expected_goals_ontarget_conceded, expected_goals_ontarget_nonpenalty_conceded, expected_assists, expected_assists_setplay, expected_assists_openplay
### matches xG/stats fields: NONE

---

*This report was automatically generated by the HandicapLab Dribble360 capability discovery pipeline.*
*Provider Status: TRIAL_VALIDATION — DO NOT expose to public or paying users.*