import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { determineUserAccess } from '@/lib/signals/visibility';
import { NotificationService } from '@/lib/alerts/notification';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch signals generated in last 24 hours
    const { data: signals, error: sigErr } = await supabase
      .from('signals')
      .select('*')
      .gt('created_at', oneDayAgo);

    if (sigErr) {
      return NextResponse.json({ success: false, error: sigErr.message }, { status: 500 });
    }

    // Mock profiles / users to send digests to
    // In production, you would fetch from public.profiles or user registrations
    const mockUsers = [
      { id: 'user_free_1', email: 'free@handicaplab.com', tier: 'FREE' },
      { id: 'user_premium_1', email: 'premium@handicaplab.com', tier: 'PREMIUM' }
    ];

    let digestsSent = 0;

    for (const u of mockUsers) {
      // Confirm the user's actual access status
      const { isPremium } = await determineUserAccess(u.id);
      const activeTier = isPremium || u.tier === 'PREMIUM' ? 'PREMIUM' : 'FREE';

      let htmlContent = '';
      if (activeTier === 'PREMIUM') {
        htmlContent = `
          <h1>HandicapLab Daily Premium Digest</h1>
          <p>Here are your detailed positive EV predictions for today:</p>
          <ul>
            ${(signals || []).map(s => `
              <li>
                <strong>${s.home_team} vs ${s.away_team}</strong> (${s.league})<br/>
                Market: ${s.market}<br/>
                Selection: ${s.selection} | Odds: ${s.odds}<br/>
                Probability: ${s.probability ? (Number(s.probability) * 100).toFixed(1) + '%' : 'N/A'}<br/>
                Confidence: ${s.confidence ? (Number(s.confidence) * 100).toFixed(1) + '%' : 'N/A'}
              </li>
            `).join('')}
          </ul>
        `;
      } else {
        htmlContent = `
          <h1>HandicapLab Daily Digest Summary</h1>
          <p>HandicapLab quantitative models identified <strong>${signals?.length || 0}</strong> positive EV market edges today.</p>
          <p>Upgrade to Pro to view exact picks, Pinnacle odds, and recommended Kelly stakes.</p>
        `;
      }

      await NotificationService.sendDigest(u.id, {
        tier: activeTier,
        signalsCount: signals?.length || 0,
        htmlContent
      });

      digestsSent++;
    }

    return NextResponse.json({
      success: true,
      digestsSent,
      signalsCount: signals?.length || 0
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
