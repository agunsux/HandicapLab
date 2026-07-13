import { describe, test } from 'vitest';
import { Competition } from '../entities/Competition';
import { Fixture } from '../entities/Fixture';
import { Team } from '../entities/Team';
import { Prediction } from '../entities/Prediction';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); }

test('entities lifecycle and mapping', () => {
  const comp = Competition.create('Premier League', 'England', 'Football', 1, '2026-01-01', '2026-12-31', 'active');
  assert(comp.name === 'Premier League', 'Competition.create');
  assert(comp.id.startsWith('comp_'), 'Competition ID prefix');
  const compDTO = comp.toDTO();
  assert(compDTO.name === 'Premier League', 'Competition.toDTO');

  const team = Team.create('Arsenal FC', 'ARS', 'England', 'arsenal.png', 'Emirates Stadium', 1886);
  assert(team.name === 'Arsenal FC', 'Team.create');
  assert(team.id.startsWith('team_'), 'Team ID prefix');

  const fixture = Fixture.create('lea_000001', 'seas_000001', 'team_000001', 'team_000002', 'ven_000001', '2026-08-15T15:00:00Z', 'SCHEDULED', '1', 1, null, null);
  assert(fixture.id.startsWith('fxt_'), 'Fixture ID prefix');

  const pred = Prediction.create('fxt_000001', 'mdl_000001', 'MATCH_RESULT', 0, 0.52, 0.25, 0.03, 0.72, '2026-08-14T12:00:00Z', 'PENDING', 0.23);
  assert(pred.id.startsWith('pred_'), 'Prediction ID prefix');
});
