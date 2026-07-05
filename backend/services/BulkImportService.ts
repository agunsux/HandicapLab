import * as fs from 'fs';
import * as path from 'path';
import { FootballDataImporter } from '../providers/football-data/FootballDataImporter';
import { supabase } from '@/lib/supabase.server';

export interface BulkSummary {
  totalLeagues: number;
  totalSeasons: number;
  totalFixtures: number;
  totalOdds: number;
  totalRuntimeMs: number;
}

export class BulkImportService {
  private readonly baseDir: string;
  private readonly importer: FootballDataImporter;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), 'data', 'historical', 'football-data');
    this.importer = new FootballDataImporter();
  }

  /**
   * Scans target directory recursively for CSV files and returns chronologically sorted file info objects.
   */
  public scanAndSort(): { league: string; season: string; filePath: string }[] {
    const filesList: { league: string; season: string; filePath: string }[] = [];
    if (!fs.existsSync(this.baseDir)) return [];

    const leagues = fs.readdirSync(this.baseDir);
    for (const league of leagues) {
      const leaguePath = path.join(this.baseDir, league);
      if (fs.statSync(leaguePath).isDirectory()) {
        const seasons = fs.readdirSync(leaguePath).filter(f => f.endsWith('.csv'));
        
        // Sort chronologically (e.g. 2015-2016.csv comes before 2025-2026.csv)
        const sortedSeasons = seasons.sort((a, b) => {
          const yearA = parseInt(a.split('-')[0]);
          const yearB = parseInt(b.split('-')[0]);
          return yearA - yearB;
        });

        for (const file of sortedSeasons) {
          filesList.push({
            league,
            season: file.replace('.csv', ''),
            filePath: path.join(leaguePath, file)
          });
        }
      }
    }
    return filesList;
  }

  /**
   * Executes the bulk import sequence while respecting checkpoints.
   */
  public async executeBulk(): Promise<BulkSummary> {
    const startTime = Date.now();
    const sortedFiles = this.scanAndSort();
    const uniqueLeagues = new Set(sortedFiles.map(f => f.league));

    let totalFixtures = 0;
    let totalOdds = 0;
    let seasonsCount = 0;

    console.log(`[BulkImportService] Scanning complete. Found ${sortedFiles.length} seasons across ${uniqueLeagues.size} leagues.`);

    for (let i = 0; i < sortedFiles.length; i++) {
      const fileInfo = sortedFiles[i];

      // Resume capability: check if this file was already processed successfully
      const { data: existingJob } = await supabase
        .from('raw_import_jobs')
        .select('id, status')
        .eq('file_name', `${fileInfo.league}/${fileInfo.season}.csv`)
        .eq('status', 'completed')
        .maybeSingle();

      if (existingJob) {
        console.log(`[BulkImportService] Checkpoint hit. Skipping completed job for: ${fileInfo.league}/${fileInfo.season}.csv`);
        continue;
      }

      console.log(`[Progress] Ingesting League ${i + 1}/${sortedFiles.length} | Season ${fileInfo.season}`);

      try {
        const content = fs.readFileSync(fileInfo.filePath, 'utf-8');
        const summary = await this.importer.importCSV(content);

        // Update file_name in raw_import_jobs to save path checkpoints
        await supabase
          .from('raw_import_jobs')
          .update({ file_name: `${fileInfo.league}/${fileInfo.season}.csv` })
          .eq('file_name', 'E0.csv');

        totalFixtures += summary.matchesImported;
        totalOdds += summary.oddsImported;
        seasonsCount++;
      } catch (err: any) {
        console.error(`[BulkImportService] Failed processing ${fileInfo.league}/${fileInfo.season}.csv: ${err.message}`);
        
        // Log to raw_import_errors
        await supabase.from('raw_import_errors').insert({
          file_name: `${fileInfo.league}/${fileInfo.season}.csv`,
          row_number: 0,
          reason: err.message
        });
        // Abort only this season, continue remaining
      }
    }

    return {
      totalLeagues: uniqueLeagues.size,
      totalSeasons: seasonsCount,
      totalFixtures,
      totalOdds,
      totalRuntimeMs: Date.now() - startTime
    };
  }
}
