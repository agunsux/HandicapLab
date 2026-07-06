export interface HoldoutConfig {
  trainLeagues: string[];
  testLeagues: string[];
  trainSeasons: string[];
  testSeasons: string[];
}

export class HoldoutManager {
  /**
   * Partitions the dataset strictly based on domains (League, Season).
   */
  partition(dataset: any[], config: HoldoutConfig): { train: any[], test: any[] } {
    const train = dataset.filter(d => 
      config.trainLeagues.includes(d.league) && 
      config.trainSeasons.includes(d.season)
    );
    
    const test = dataset.filter(d => 
      config.testLeagues.includes(d.league) && 
      config.testSeasons.includes(d.season)
    );
    
    return { train, test };
  }
}
