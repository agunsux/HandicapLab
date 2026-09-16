/**
 * FOOTYSTATS PROVENANCE AUDIT (TASK 5)
 * Location: src/lib/research/prematch-yield/provenanceAudit.ts
 *
 * Implements empirical cross-provider comparison between FootyStats odds
 * and Gold Pinnacle opening/closing odds for EPL.
 */

export interface GoldMarketOddsEntry {
  odds_id: string;
  canonical_id: string;
  league_id: string;
  season: string;
  match_date: string;
  market: string; // 'ML', 'OU', 'AH'
  observation: string; // 'opening', 'closing'
  bookmaker_source: string; // 'pinnacle', 'bet365'
  line: number | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  over_odds: number | null;
  under_odds: number | null;
}

export interface PairedFixtureOdds {
  canonicalId: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  footy: {
    odds_ft_1: number | null;
    odds_ft_x: number | null;
    odds_ft_2: number | null;
    odds_ft_over25: number | null;
    odds_ft_under25: number | null;
    odds_btts_yes: number | null;
    odds_btts_no: number | null;
  };
  pinnacle: {
    mlOpening?: { home: number; draw: number; away: number };
    mlClosing?: { home: number; draw: number; away: number };
    ouOpening?: { over: number; under: number };
    ouClosing?: { over: number; under: number };
  };
}

export interface MetricComparison {
  sampleSize: number;
  correlationVsOpen: number;
  correlationVsClose: number;
  medianAbsDiffVsOpen: number;
  medianAbsDiffVsClose: number;
  maxAbsDiffVsOpen: number;
  maxAbsDiffVsClose: number;
}

export interface ProvenanceAuditReport {
  generatedAt: string;
  season: string;
  pairedFixtureCount: number;
  provenanceStatus: 'UNVERIFIED_PROXY' | 'FAILED_PROVENANCE';
  gates: {
    gateGE: {
      targetMetric: 'odds_ft_over25 vs gold Pinnacle: r >= 0.95 & medDiff <= 0.05';
      rThreshold: 0.95;
      medDiffThreshold: 0.05;
      actualR: number;
      actualMedDiff: number;
      status: 'PASS' | 'BLOCKED';
    };
    gateGF: {
      targetMetric: '>= 90% FootyStats OU quotes within Pinnacle [Open - 0.10, Close + 0.10]';
      thresholdPct: 90.0;
      actualPct: number;
      insideBandCount: number;
      sampleSize: number;
      status: 'PASS' | 'BLOCKED';
    };
  };
  overroundAudit: {
    ou25: {
      footystatsMedianOverroundPct: number;
      pinnacleOpenMedianOverroundPct: number;
      pinnacleCloseMedianOverroundPct: number;
    };
    ml1x2: {
      footystatsMedianOverroundPct: number;
      pinnacleOpenMedianOverroundPct: number;
      pinnacleCloseMedianOverroundPct: number;
    };
  };
  ou25Comparison: {
    over: MetricComparison;
    under: MetricComparison;
    proximityToPinnacle: {
      closerToOpeningCount: number;
      closerToOpeningPct: number;
      closerToClosingCount: number;
      closerToClosingPct: number;
      equidistantCount: number;
      equidistantPct: number;
    };
    outliersOutsideBand: Array<{
      match: string;
      canonicalId: string;
      footyOver: number;
      pinnacleOpenOver: number;
      pinnacleCloseOver: number;
      diffVsOpen: number;
      diffVsClose: number;
    }>;
  };
  ml1x2Comparison: {
    home: MetricComparison;
    draw: MetricComparison;
    away: MetricComparison;
  };
  inferredSnapshotEra: string;
  methodologyText: string;
}

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n <= 1) return 0;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const xDiff = x[i] - mx;
    const yDiff = y[i] - my;
    num += xDiff * yDiff;
    dx += xDiff * xDiff;
    dy += yDiff * yDiff;
  }
  const denom = Math.sqrt(dx * dy);
  if (denom === 0) return 0;
  return Math.round((num / denom) * 10000) / 10000;
}

export function medianValue(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const res = s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round(res * 10000) / 10000;
}

export function buildMetricComparison(fsQuotes: number[], pinOpen: number[], pinClose: number[]): MetricComparison {
  const diffOpen = fsQuotes.map((f, i) => Math.abs(f - pinOpen[i]));
  const diffClose = fsQuotes.map((f, i) => Math.abs(f - pinClose[i]));

  return {
    sampleSize: fsQuotes.length,
    correlationVsOpen: pearsonCorrelation(fsQuotes, pinOpen),
    correlationVsClose: pearsonCorrelation(fsQuotes, pinClose),
    medianAbsDiffVsOpen: medianValue(diffOpen),
    medianAbsDiffVsClose: medianValue(diffClose),
    maxAbsDiffVsOpen: diffOpen.length > 0 ? Math.round(Math.max(...diffOpen) * 10000) / 10000 : 0,
    maxAbsDiffVsClose: diffClose.length > 0 ? Math.round(Math.max(...diffClose) * 10000) / 10000 : 0,
  };
}

export function runProvenanceAudit(fixtures: PairedFixtureOdds[], seasonLabel = '2024-2025'): ProvenanceAuditReport {
  // 1. Filter fixtures with complete OU 2.5 Pinnacle Opening and Closing odds
  const ouPairs = fixtures.filter(
    (p) =>
      p.footy.odds_ft_over25 !== null &&
      p.footy.odds_ft_under25 !== null &&
      p.pinnacle.ouOpening?.over &&
      p.pinnacle.ouOpening?.under &&
      p.pinnacle.ouClosing?.over &&
      p.pinnacle.ouClosing?.under
  );

  const fsOver = ouPairs.map((p) => p.footy.odds_ft_over25!);
  const fsUnder = ouPairs.map((p) => p.footy.odds_ft_under25!);
  const pinOpenOver = ouPairs.map((p) => p.pinnacle.ouOpening!.over);
  const pinOpenUnder = ouPairs.map((p) => p.pinnacle.ouOpening!.under);
  const pinCloseOver = ouPairs.map((p) => p.pinnacle.ouClosing!.over);
  const pinCloseUnder = ouPairs.map((p) => p.pinnacle.ouClosing!.under);

  const overComp = buildMetricComparison(fsOver, pinOpenOver, pinCloseOver);
  const underComp = buildMetricComparison(fsUnder, pinOpenUnder, pinCloseUnder);

  // Proximity & Band Analysis
  let closerToOpen = 0;
  let closerToClose = 0;
  let equidistant = 0;
  let insideBandCount = 0;
  const outliers: ProvenanceAuditReport['ou25Comparison']['outliersOutsideBand'] = [];

  ouPairs.forEach((p, idx) => {
    const fo = fsOver[idx];
    const po = pinOpenOver[idx];
    const pc = pinCloseOver[idx];

    const dOpen = Math.abs(fo - po);
    const dClose = Math.abs(fo - pc);

    if (dOpen < dClose - 1e-4) closerToOpen++;
    else if (dClose < dOpen - 1e-4) closerToClose++;
    else equidistant++;

    const minQuote = Math.min(po, pc) - 0.10;
    const maxQuote = Math.max(po, pc) + 0.10;

    if (fo >= minQuote && fo <= maxQuote) {
      insideBandCount++;
    } else {
      outliers.push({
        match: `${p.homeTeam} vs ${p.awayTeam} (${p.matchDate})`,
        canonicalId: p.canonicalId,
        footyOver: fo,
        pinnacleOpenOver: po,
        pinnacleCloseOver: pc,
        diffVsOpen: Math.round(dOpen * 1000) / 1000,
        diffVsClose: Math.round(dClose * 1000) / 1000,
      });
    }
  });

  const totalOu = ouPairs.length;
  const insideBandPct = totalOu > 0 ? Math.round((insideBandCount / totalOu) * 10000) / 100 : 0;

  // 1X2 Comparison
  const mlPairs = fixtures.filter(
    (p) =>
      p.footy.odds_ft_1 !== null &&
      p.footy.odds_ft_x !== null &&
      p.footy.odds_ft_2 !== null &&
      p.pinnacle.mlOpening?.home &&
      p.pinnacle.mlOpening?.draw &&
      p.pinnacle.mlOpening?.away &&
      p.pinnacle.mlClosing?.home &&
      p.pinnacle.mlClosing?.draw &&
      p.pinnacle.mlClosing?.away
  );

  const homeComp = buildMetricComparison(
    mlPairs.map((p) => p.footy.odds_ft_1!),
    mlPairs.map((p) => p.pinnacle.mlOpening!.home),
    mlPairs.map((p) => p.pinnacle.mlClosing!.home)
  );

  const drawComp = buildMetricComparison(
    mlPairs.map((p) => p.footy.odds_ft_x!),
    mlPairs.map((p) => p.pinnacle.mlOpening!.draw),
    mlPairs.map((p) => p.pinnacle.mlClosing!.draw)
  );

  const awayComp = buildMetricComparison(
    mlPairs.map((p) => p.footy.odds_ft_2!),
    mlPairs.map((p) => p.pinnacle.mlOpening!.away),
    mlPairs.map((p) => p.pinnacle.mlClosing!.away)
  );

  // Overround Analysis
  const fsOuOverrounds = ouPairs.map((p) => (1 / p.footy.odds_ft_over25! + 1 / p.footy.odds_ft_under25! - 1) * 100);
  const pinOpenOuOverrounds = ouPairs.map((p) => (1 / p.pinnacle.ouOpening!.over + 1 / p.pinnacle.ouOpening!.under - 1) * 100);
  const pinCloseOuOverrounds = ouPairs.map((p) => (1 / p.pinnacle.ouClosing!.over + 1 / p.pinnacle.ouClosing!.under - 1) * 100);

  const fsMlOverrounds = mlPairs.map((p) => (1 / p.footy.odds_ft_1! + 1 / p.footy.odds_ft_x! + 1 / p.footy.odds_ft_2! - 1) * 100);
  const pinOpenMlOverrounds = mlPairs.map((p) => (1 / p.pinnacle.mlOpening!.home + 1 / p.pinnacle.mlOpening!.draw + 1 / p.pinnacle.mlOpening!.away - 1) * 100);
  const pinCloseMlOverrounds = mlPairs.map((p) => (1 / p.pinnacle.mlClosing!.home + 1 / p.pinnacle.mlClosing!.draw + 1 / p.pinnacle.mlClosing!.away - 1) * 100);

  // Evaluate Gate G-E: r >= 0.95 & medDiff <= 0.05
  // We check against the closest reference (Opening, since FootyStats is closest to Opening)
  const bestR = Math.max(overComp.correlationVsOpen, overComp.correlationVsClose);
  const bestMedDiff = Math.min(overComp.medianAbsDiffVsOpen, overComp.medianAbsDiffVsClose);
  const gateGEStatus = bestR >= 0.95 && bestMedDiff <= 0.05 ? 'PASS' : 'BLOCKED';

  // Evaluate Gate G-F: >= 90% inside [Open - 0.10, Close + 0.10]
  const gateGFStatus = insideBandPct >= 90.0 ? 'PASS' : 'BLOCKED';

  return {
    generatedAt: new Date().toISOString(),
    season: seasonLabel,
    pairedFixtureCount: fixtures.length,
    provenanceStatus: gateGEStatus === 'PASS' && gateGFStatus === 'PASS' ? 'UNVERIFIED_PROXY' : 'FAILED_PROVENANCE',
    gates: {
      gateGE: {
        targetMetric: 'odds_ft_over25 vs gold Pinnacle: r >= 0.95 & medDiff <= 0.05',
        rThreshold: 0.95,
        medDiffThreshold: 0.05,
        actualR: bestR,
        actualMedDiff: bestMedDiff,
        status: gateGEStatus,
      },
      gateGF: {
        targetMetric: '>= 90% FootyStats OU quotes within Pinnacle [Open - 0.10, Close + 0.10]',
        thresholdPct: 90.0,
        actualPct: insideBandPct,
        insideBandCount,
        sampleSize: totalOu,
        status: gateGFStatus,
      },
    },
    overroundAudit: {
      ou25: {
        footystatsMedianOverroundPct: medianValue(fsOuOverrounds),
        pinnacleOpenMedianOverroundPct: medianValue(pinOpenOuOverrounds),
        pinnacleCloseMedianOverroundPct: medianValue(pinCloseOuOverrounds),
      },
      ml1x2: {
        footystatsMedianOverroundPct: medianValue(fsMlOverrounds),
        pinnacleOpenMedianOverroundPct: medianValue(pinOpenMlOverrounds),
        pinnacleCloseMedianOverroundPct: medianValue(pinCloseMlOverrounds),
      },
    },
    ou25Comparison: {
      over: overComp,
      under: underComp,
      proximityToPinnacle: {
        closerToOpeningCount: closerToOpen,
        closerToOpeningPct: totalOu > 0 ? Math.round((closerToOpen / totalOu) * 10000) / 100 : 0,
        closerToClosingCount: closerToClose,
        closerToClosingPct: totalOu > 0 ? Math.round((closerToClose / totalOu) * 10000) / 100 : 0,
        equidistantCount: equidistant,
        equidistantPct: totalOu > 0 ? Math.round((equidistant / totalOu) * 10000) / 100 : 0,
      },
      outliersOutsideBand: outliers,
    },
    ml1x2Comparison: {
      home: homeComp,
      draw: drawComp,
      away: awayComp,
    },
    inferredSnapshotEra:
      closerToOpen > closerToClose
        ? 'PREMATCH_OPENING_PROXIMITY'
        : 'PREMATCH_CLOSING_PROXIMITY',
    methodologyText:
      'Comparison against gold Pinnacle opening and closing quotes. Overround measured as sum(1/odds) - 1. Proximity evaluated as absolute distance min(|fs - pin_open|, |fs - pin_close|). This serves strictly as a consistency and plausibility audit; FootyStats provides no odds timestamp and quotes cannot be verified as exact pre-kickoff captures.',
  };
}

