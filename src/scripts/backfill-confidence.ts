import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfill() {
  console.log("Starting backfill for predictions with NULL confidence...");
  
  // Fetch predictions with NULL confidence
  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('*')
    .is('confidence', null);

  if (error) {
    console.error("Error fetching predictions:", error);
    process.exit(1);
  }

  console.log(`Found ${predictions.length} predictions to backfill.`);

  for (const p of predictions) {
    let newConfidence = 0.50; // fractional confidence
    let newSelection = p.selection;

    if (p.prediction) {
      const pred = p.prediction as any;
      const h = pred.home_prob || pred.ml_home_prob || 0;
      const d = pred.draw_prob || pred.ml_draw_prob || 0;
      const a = pred.away_prob || pred.ml_away_prob || 0;

      const maxProb = Math.max(h, d, a);
      if (maxProb > 0) {
        newConfidence = Math.min(0.95, maxProb); // Math.round(maxProb * 100) / 100 ? Just use maxProb up to 0.95
        
        if (!newSelection) {
          if (maxProb === h) newSelection = p.home_team;
          else if (maxProb === a) newSelection = p.away_team;
          else newSelection = 'Draw';
        }
      } else {
         // fallback if it's AH or OU
         const ahProb = pred.ah_prob || pred.ah_home_prob || 0;
         const ouProb = pred.over_prob || pred.ou_over_prob || 0;
         const best = Math.max(ahProb, ouProb, 0.5);
         newConfidence = Math.min(0.95, best);
      }
    }

    const { error: updateError } = await supabase
      .from('predictions')
      .update({
        confidence: Number(newConfidence.toFixed(4)),
        selection: newSelection
      })
      .eq('id', p.id);

    if (updateError) {
      console.error(`Failed to update prediction ${p.id}:`, updateError);
    } else {
      console.log(`Updated ${p.id} -> confidence: ${newConfidence.toFixed(4)}, selection: ${newSelection}`);
    }
  }

  console.log("Backfill complete!");
}

backfill();
