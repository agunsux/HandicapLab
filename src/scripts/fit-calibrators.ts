import fs from 'fs';
import path from 'path';
import { BetaCalibrator } from '../lib/ml-platform/calibration/beta';
import { calibrationRouter, CalibrationRouter } from '../lib/ml-platform/calibration/router';

async function run() {
  console.log('Fetching historical matches (Trailing 12 months)...');
  // In a real scenario, this queries the ML Feature Store and Results Database
  // for past raw probabilities and their actual outcomes.
  
  // Synthetic Mock Data for script stability
  const rawProbs = [
    [0.80, 0.15, 0.05],
    [0.85, 0.10, 0.05],
    [0.75, 0.20, 0.05],
    [0.40, 0.30, 0.30],
    [0.20, 0.20, 0.60]
  ];
  
  const actuals = [
    [1, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0, 0, 1]
  ];
  
  // Exponential time-decay weights simulating recent vs old matches
  const sampleWeights = [1.0, 0.95, 0.8, 0.5, 0.4]; 
  
  const leagues = ['39', '140']; // EPL, La Liga
  const markets = ['ML', 'AH'];
  const model = 'Ensemble_v3.4';
  
  for (const league of leagues) {
    for (const market of markets) {
      const routingKey = CalibrationRouter.generateKey(model, league, market);
      console.log(`Fitting Beta Calibrator for ${routingKey}...`);
      
      const calibrator = new BetaCalibrator();
      calibrator.fit(rawProbs, actuals, sampleWeights);
      
      calibrationRouter.register(routingKey, calibrator);
    }
  }
  
  const registryState = calibrationRouter.exportRegistry();
  
  // Saving to artifacts to simulate a remote Model Registry / DB
  const registryDir = path.join(process.cwd(), 'src', 'data', 'calibration');
  fs.mkdirSync(registryDir, { recursive: true });
  const registryPath = path.join(registryDir, 'registry.json');
  
  fs.writeFileSync(registryPath, JSON.stringify(registryState, null, 2));
  
  console.log(`Calibration states saved to ${registryPath}`);
}

run().catch(console.error);
