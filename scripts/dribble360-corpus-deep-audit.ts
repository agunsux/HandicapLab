import fs from 'fs';
import readline from 'readline';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'research', 'dribble360', 'harvest');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'research', 'dribble360', 'corpus_deep_audit.json');

const WHITELIST_LEAGUES = [
    'premier-league', 'championship', 'serie-a', 'bundesliga', 
    'la-liga', 'ligue-1', 'eredivisie', 'j1-league', 'k-league', 'liga-1'
];

function getLeagueFromSlug(slug: string): string {
    if (!slug) return 'unknown';
    const lowerSlug = slug.toLowerCase();
    for (const l of WHITELIST_LEAGUES) {
        if (lowerSlug.includes(l.replace(' ', '-'))) return l;
    }
    return 'other';
}

async function processFile(filePath: string, onLine: (line: string) => void) {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
        console.warn(`File empty: ${filePath}`);
        return;
    }
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.trim()) {
            onLine(line);
        }
    }
}

async function main() {
    console.log('Starting audit...');
    
    const matchCorpus = {
        totalRecords: 0,
        uniqueSeasonIds: new Set<number>(),
        dateRange: { min: '9999-12-31', max: '0000-00-00' },
        statusDistribution: {} as Record<string, number>,
        coverageLevelDistribution: {} as Record<string, number>,
        uniqueMatchIds: new Set<number>()
    };

    const leagueDistribution: Record<string, Record<string, number>> = {};

    const matchFile = path.join(DATA_DIR, 'matches_2020_2021.jsonl');
    await processFile(matchFile, (line) => {
        try {
            const data = JSON.parse(line);
            matchCorpus.totalRecords++;
            if (data.season_id) matchCorpus.uniqueSeasonIds.add(data.season_id);
            
            if (data.date) {
                if (data.date < matchCorpus.dateRange.min) matchCorpus.dateRange.min = data.date;
                if (data.date > matchCorpus.dateRange.max) matchCorpus.dateRange.max = data.date;
            }
            
            if (data.status) {
                matchCorpus.statusDistribution[data.status] = (matchCorpus.statusDistribution[data.status] || 0) + 1;
            }
            
            if (data.coverage_level) {
                matchCorpus.coverageLevelDistribution[data.coverage_level] = (matchCorpus.coverageLevelDistribution[data.coverage_level] || 0) + 1;
            }
            
            if (data.id) {
                matchCorpus.uniqueMatchIds.add(data.id);
            }
            
            const league = getLeagueFromSlug(data.slug);
            const seasonId = data.season_id || 'unknown';
            if (!leagueDistribution[league]) leagueDistribution[league] = {};
            leagueDistribution[league][seasonId] = (leagueDistribution[league][seasonId] || 0) + 1;
            
        } catch (e) {
            // ignore
        }
    });

    console.log(`Processed match file. Records: ${matchCorpus.totalRecords}`);

    const teamMatchCorpus = {
        totalRecords: 0,
        perSeason: {} as Record<string, number>,
        uniqueMatchIds: new Set<number>(),
        matchesInMatchCorpus: 0,
        matchesNotInMatchCorpus: 0
    };

    const fieldCompletenessMatrix: Record<string, any> = {};

    const seasons = ['2019_2020', '2020_2021', '2021_2022', '2022_2023', '2023_2024', '2024_2025', '2025_2026'];
    for (const season of seasons) {
        const filePath = path.join(DATA_DIR, `team_matches_${season}.jsonl`);
        let seasonRecords = 0;
        await processFile(filePath, (line) => {
            try {
                const data = JSON.parse(line);
                seasonRecords++;
                teamMatchCorpus.totalRecords++;
                if (data.match_id) teamMatchCorpus.uniqueMatchIds.add(data.match_id);
                
                for (const [key, value] of Object.entries(data)) {
                    if (!fieldCompletenessMatrix[key]) {
                        fieldCompletenessMatrix[key] = {
                            nonNullCount: 0,
                            sum: 0,
                            min: Infinity,
                            max: -Infinity,
                            numericCount: 0,
                        };
                    }
                                        
                    if (value !== null && value !== undefined && value !== '') {
                        fieldCompletenessMatrix[key].nonNullCount++;
                        
                        if (typeof value === 'number') {
                            fieldCompletenessMatrix[key].sum += value;
                            fieldCompletenessMatrix[key].numericCount++;
                            if (value < fieldCompletenessMatrix[key].min) fieldCompletenessMatrix[key].min = value;
                            if (value > fieldCompletenessMatrix[key].max) fieldCompletenessMatrix[key].max = value;
                        }
                    }
                }
            } catch (e) {
                // ignore
            }
        });
        teamMatchCorpus.perSeason[season] = seasonRecords;
        console.log(`Processed team_matches for ${season}: ${seasonRecords} records`);
    }

    for (const mid of teamMatchCorpus.uniqueMatchIds) {
        if (matchCorpus.uniqueMatchIds.has(mid)) {
            teamMatchCorpus.matchesInMatchCorpus++;
        } else {
            teamMatchCorpus.matchesNotInMatchCorpus++;
        }
    }

    const dataQualityFlags = {
        lowValueFields: [] as string[],
        highValueFields: [] as string[],
        suspiciousValues: [] as string[]
    };

    const finalFieldCompleteness: Record<string, any> = {};
    for (const [key, stats] of Object.entries(fieldCompletenessMatrix)) {
        const nonNullPercent = stats.nonNullCount / teamMatchCorpus.totalRecords;
        
        const res: any = {
            nonNullCount: stats.nonNullCount,
            nonNullPercentage: Number((nonNullPercent * 100).toFixed(2))
        };
        
        if (stats.numericCount > 0) {
            res.mean = stats.sum / stats.numericCount;
            res.min = stats.min;
            res.max = stats.max;
        }
        
        finalFieldCompleteness[key] = res;
        
        if (nonNullPercent < 0.1) dataQualityFlags.lowValueFields.push(key);
        if (nonNullPercent === 1.0) dataQualityFlags.highValueFields.push(key);
    }

    const output = {
        auditTimestamp: new Date().toISOString(),
        matchCorpus: {
            totalRecords: matchCorpus.totalRecords,
            uniqueSeasonIds: matchCorpus.uniqueSeasonIds.size,
            dateRange: matchCorpus.dateRange,
            statusDistribution: matchCorpus.statusDistribution,
            coverageLevelDistribution: matchCorpus.coverageLevelDistribution
        },
        teamMatchCorpus: {
            totalRecords: teamMatchCorpus.totalRecords,
            perSeason: teamMatchCorpus.perSeason,
            uniqueMatchIds: teamMatchCorpus.uniqueMatchIds.size,
            matchesInMatchCorpus: teamMatchCorpus.matchesInMatchCorpus,
            matchesNotInMatchCorpus: teamMatchCorpus.matchesNotInMatchCorpus
        },
        fieldCompletenessMatrix: finalFieldCompleteness,
        leagueDistribution,
        dataQualityFlags
    };

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`Audit written to ${OUTPUT_FILE}`);
}

main().catch(console.error);
