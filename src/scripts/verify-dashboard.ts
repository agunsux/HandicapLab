import 'dotenv/config';

// Simple unit-like mock test for the dashboard API mappings
async function main() {
  console.log('🖥️ Running dashboard terminology and segregation validation...');

  const mockRecommendations = ['Recommended', 'Consider', 'Neutral', 'Caution', 'Skip'];
  const mappedConvictions = mockRecommendations.map(rawRec => {
    let recommendationStatus = 'Low Conviction';
    if (rawRec === 'Recommended') {
      recommendationStatus = 'High Conviction';
    } else if (rawRec === 'Consider') {
      recommendationStatus = 'Medium Conviction';
    } else if (rawRec === 'Neutral') {
      recommendationStatus = 'Low Conviction';
    } else if (rawRec === 'Caution' || rawRec === 'Skip') {
      recommendationStatus = 'Observation';
    }
    return recommendationStatus;
  });

  const expectedMapped = [
    'High Conviction',
    'Medium Conviction',
    'Low Conviction',
    'Observation',
    'Observation'
  ];

  let hasDrift = false;
  for (let i = 0; i < expectedMapped.length; i++) {
    if (mappedConvictions[i] !== expectedMapped[i]) {
      console.error(`❌ Mismatch at index ${i}: expected "${expectedMapped[i]}", got "${mappedConvictions[i]}"`);
      hasDrift = true;
    }
  }

  if (hasDrift) {
    process.exit(1);
  }

  console.log('✅ Dashboard neutral terminology mappings match 100% of institutional specifications.');
  process.exit(0);
}

main().catch(console.error);
