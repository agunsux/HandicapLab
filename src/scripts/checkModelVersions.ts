import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase URL or Service Key is missing in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkVersions() {
  console.log('📊 Grouping model versions in predictions table...\n');

  try {
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('model_version, feature_version');

    if (error) {
      throw new Error(`Failed to fetch predictions: ${error.message}`);
    }

    if (!predictions || predictions.length === 0) {
      console.log('📭 No predictions found in the database yet.');
      return;
    }

    // Group in memory
    const counts: Record<string, { model: string; feature: string; count: number }> = {};

    for (const p of predictions) {
      const model = p.model_version || 'unknown';
      const feature = p.feature_version || 'unknown';
      const key = `${model}::${feature}`;

      if (!counts[key]) {
        counts[key] = { model, feature, count: 0 };
      }
      counts[key].count++;
    }

    console.log(String('Model Version').padEnd(25) + ' | ' + String('Feature Version').padEnd(20) + ' | ' + 'Prediction Count');
    console.log('-'.repeat(25) + ' + ' + '-'.repeat(20) + ' + ' + '-'.repeat(16));

    for (const key of Object.keys(counts)) {
      const group = counts[key];
      console.log(
        group.model.padEnd(25) + ' | ' + 
        group.feature.padEnd(20) + ' | ' + 
        String(group.count).padStart(16)
      );
    }

    console.log(`\nTotal predictions tracked: ${predictions.length}`);
  } catch (err: any) {
    console.error('❌ Error checking model versions:', err.message);
    process.exit(1);
  }
}

checkVersions();
