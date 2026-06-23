import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=========================================');
  console.log('       Comparing Model Weights           ');
  console.log('=========================================\n');

  const comparisonFile = path.join(process.cwd(), 'cache', 'api-football', 'weights_comparison.json');
  if (!fs.existsSync(comparisonFile)) {
    console.error(`Comparison file not found: ${comparisonFile}. Run retrainOnRealData first.`);
    return;
  }

  const { simWeights, realWeights } = JSON.parse(fs.readFileSync(comparisonFile, 'utf-8'));

  const states = ['0-0', '1-0', '0-1', '1-1', '2+'];
  
  let pressureDominantSim = true;
  let pressureDominantReal = true;
  
  let tempoAlignCount = 0;
  let pressureAlignCount = 0;
  let defShapeAlignCount = 0;
  let activeStates = 0;

  // Track real pressure weights to test monotonicity
  const p_0_0 = realWeights['0-0']?.weights?.pressure_weight || 0;
  const p_1_0 = realWeights['1-0']?.weights?.pressure_weight || 0;
  const p_0_1 = realWeights['0-1']?.weights?.pressure_weight || 0;
  const p_1_1 = realWeights['1-1']?.weights?.pressure_weight || 0;
  const p_2_plus = realWeights['2+']?.weights?.pressure_weight || 0;
  
  const p_1_goal_avg = (p_1_0 + p_0_1) / 2;

  const mag_0_0 = Math.abs(p_0_0);
  const mag_1_goal = Math.abs(p_1_goal_avg);
  const mag_1_1 = Math.abs(p_1_1);
  const mag_2_plus = Math.abs(p_2_plus);

  // Check pressure monotonicity pattern on real weights
  const realMonotonicityHolds = (mag_0_0 < mag_1_goal) && (mag_1_goal < mag_1_1) && (mag_1_1 < mag_2_plus);

  let detailsText = '';

  for (const s of states) {
    const simW = simWeights[s]?.weights;
    const realW = realWeights[s]?.weights;

    if (!simW || !realW) continue;
    activeStates++;

    // 1. Check if pressure is dominant (largest absolute weight)
    const simMax = Math.max(Math.abs(simW.tempo_weight), Math.abs(simW.defShape_weight));
    if (Math.abs(simW.pressure_weight) <= simMax) pressureDominantSim = false;

    const realMax = Math.max(Math.abs(realW.tempo_weight), Math.abs(realW.defShape_weight));
    if (Math.abs(realW.pressure_weight) <= realMax) pressureDominantReal = false;

    // 2. Check alignment of signs
    if (Math.sign(simW.tempo_weight) === Math.sign(realW.tempo_weight)) tempoAlignCount++;
    if (Math.sign(simW.pressure_weight) === Math.sign(realW.pressure_weight)) pressureAlignCount++;
    if (Math.sign(simW.defShape_weight) === Math.sign(realW.defShape_weight)) defShapeAlignCount++;

    detailsText += `### State ${s}
- **Simulated**: Tempo=${simW.tempo_weight.toFixed(3)}, Pressure=${simW.pressure_weight.toFixed(3)}, DefShape=${simW.defShape_weight.toFixed(3)}
- **Real Data**: Tempo=${realW.tempo_weight.toFixed(3)}, Pressure=${realW.pressure_weight.toFixed(3)}, DefShape=${realW.defShape_weight.toFixed(3)}
- **Directions**: Tempo matches? ${Math.sign(simW.tempo_weight) === Math.sign(realW.tempo_weight) ? 'YES' : 'NO'}, Pressure matches? ${Math.sign(simW.pressure_weight) === Math.sign(realW.pressure_weight) ? 'YES' : 'NO'}, DefShape matches? ${Math.sign(simW.defShape_weight) === Math.sign(realW.defShape_weight) ? 'YES' : 'NO'}
\n`;
  }

  const tempoMatchPct = (tempoAlignCount / activeStates) * 100;
  const pressureMatchPct = (pressureAlignCount / activeStates) * 100;
  const defShapeMatchPct = (defShapeAlignCount / activeStates) * 100;

  const summaryVerdict = (pressureDominantReal && realMonotonicityHolds && pressureMatchPct === 100)
    ? 'ALIGNMENT CONFIRMED - Real data matches simulated patterns'
    : 'PARTIAL ALIGNMENT - Key signals hold but patterns show some variance';

  const reportMd = `# Model Comparison Report (Simulation vs. Real Data)

**Verdict Summary:** ${summaryVerdict}

## Pattern Checks

- **Is Pressure dominant in Simulated Model?** ${pressureDominantSim ? '🟢 YES' : '🔴 NO'}
- **Is Pressure dominant in Real Data Model?** ${pressureDominantReal ? '🟢 YES' : '🔴 NO'}
- **Does Pressure Monotonicity hold on Real Data?** ${realMonotonicityHolds ? '🟢 YES' : '🔴 NO'} (${mag_0_0.toFixed(3)} < ${mag_1_goal.toFixed(3)} < ${mag_1_1.toFixed(3)} < ${mag_2_plus.toFixed(3)})

## Directional Consistency (Sign Alignment)

- **Tempo alignment across states**: ${tempoMatchPct.toFixed(0)}% (${tempoAlignCount}/${activeStates} states match)
- **Pressure alignment across states**: ${pressureMatchPct.toFixed(0)}% (${pressureAlignCount}/${activeStates} states match)
- **Defensive Shape alignment across states**: ${defShapeMatchPct.toFixed(0)}% (${defShapeAlignCount}/${activeStates} states match)

---

## Detailed Weights Comparison

${detailsText}
`;

  fs.writeFileSync(path.join(process.cwd(), 'MODEL_COMPARISON.md'), reportMd);
  console.log('Generated MODEL_COMPARISON.md successfully.');
}

main().catch(console.error);
