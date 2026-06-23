import { apiFootballClient } from '../lib/api/apiFootball';
import { generatePrediction, MatchInput } from '../services/probability.engine';
import { calculatePreMatchFeatures, TransformedMatch } from '../lib/data/dataTransformer';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=========================================');
  console.log('      Generating Test Predictions        ');
  console.log('=========================================\n');

  const leagueId = 39; // Premier League
  const season = 2024;
  const sampleFile = path.join(process.cwd(), 'cache', 'api-football', 'quick_sample.json');
  const outputFile = path.join(process.cwd(), 'test_predictions.json');

  let history: TransformedMatch[] = [];
  if (fs.existsSync(sampleFile)) {
    try {
      history = JSON.parse(fs.readFileSync(sampleFile, 'utf-8'));
      console.log(`Loaded ${history.length} historical matches for feature engineering.`);
    } catch (e) {
      console.warn('Failed to parse quick_sample.json history. Using empty array.', e);
    }
  } else {
    console.log('No quick_sample.json history found. Using empty array.');
  }

  console.log(`Fetching fixtures for League ${leagueId}, Season ${season}...`);
  const fixtures = await apiFootballClient.getFixtures(leagueId, season);
  console.log(`Retrieved ${fixtures.length} fixtures total.`);

  // Select 10 matches to predict (prefer scheduled, otherwise fallback to recent ones)
  let targetFixtures = fixtures.filter(f => f.fixture.status.short !== 'FT');
  if (targetFixtures.length === 0) {
    console.log('No scheduled matches found. Falling back to predicting completed matches (pre-match simulation).');
    targetFixtures = fixtures.filter(f => f.fixture.status.short === 'FT');
  }

  // Slice down to 10
  const selectedFixtures = targetFixtures.slice(0, 10);
  console.log(`Selected ${selectedFixtures.length} matches for generating predictions.\n`);

  const results: any[] = [];

  for (let i = 0; i < selectedFixtures.length; i++) {
    const f = selectedFixtures[i];
    const homeName = f.teams.home.name;
    const awayName = f.teams.away.name;
    const dateStr = f.fixture.date;

    // Calculate pre-match features based on historical matches before this match date
    const preMatchFeatures = calculatePreMatchFeatures(homeName, awayName, dateStr, history);

    // Prepare match input
    const input: MatchInput = {
      odds_home: 2.0,
      odds_draw: 3.2,
      odds_away: 3.5,
      ah_line: 0,
      ou_line: 2.5,
      btts_odds: 1.8,
      xg_home: 1.5,
      xg_away: 1.2,
      shots_home: 10,
      shots_away: 8,
      shots_on_target_home: 5,
      shots_on_target_away: 4,
      form_home: Math.round(preMatchFeatures.homeForm),
      form_away: Math.round(preMatchFeatures.awayForm),
      preMatchFeatures
    };

    const prediction = generatePrediction(input);

    // Map confidence value to dot indicator
    let dot = '🔴 Avoid';
    if (prediction.final_confidence >= 0.75) {
      dot = '🟢 High';
    } else if (prediction.final_confidence >= 0.55) {
      dot = '🟡 Medium';
    } else if (prediction.final_confidence >= 0.40) {
      dot = '⚪ Low';
    }

    console.log(`[Prediction #${i + 1}] ${homeName} vs ${awayName}`);
    console.log(`- Kickoff: ${new Date(dateStr).toLocaleString()}`);
    console.log(`- Estimated Goals: Home=${prediction.expected_goals_home}, Away=${prediction.expected_goals_away}`);
    console.log(`- 1X2 Probabilities: Home=${(prediction.ml_home_prob * 100).toFixed(1)}%, Draw=${(prediction.ml_draw_prob * 100).toFixed(1)}%, Away=${(prediction.ml_away_prob * 100).toFixed(1)}%`);
    console.log(`- Over 2.5 Prob: ${(prediction.ou_over_prob * 100).toFixed(1)}%`);
    console.log(`- BTTS Yes Prob: ${(prediction.btts_yes_prob * 100).toFixed(1)}%`);
    console.log(`- Confidence Level: ${dot} (${(prediction.final_confidence * 100).toFixed(0)}%)`);
    console.log('---------------------------------------------------\n');

    results.push({
      matchId: f.fixture.id,
      homeTeam: homeName,
      awayTeam: awayName,
      kickoff: dateStr,
      input,
      prediction: {
        expectedGoalsHome: prediction.expected_goals_home,
        expectedGoalsAway: prediction.expected_goals_away,
        mlHomeProb: prediction.ml_home_prob,
        mlDrawProb: prediction.ml_draw_prob,
        mlAwayProb: prediction.ml_away_prob,
        ouOverProb: prediction.ou_over_prob,
        ouUnderProb: prediction.ou_under_prob,
        ahHomeProb: prediction.ah_home_prob,
        ahAwayProb: prediction.ah_away_prob,
        bttsYesProb: prediction.btts_yes_prob,
        bttsNoProb: prediction.btts_no_prob,
        confidence: prediction.final_confidence,
        confidenceIndicator: dot
      }
    });
  }

  // Save to file
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Successfully generated and saved ${results.length} predictions to ${outputFile}`);
}

main().catch(console.error);
