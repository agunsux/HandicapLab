export class BookmakerNormalizer {
  private static readonly mappings: Record<string, string> = {
    B365: 'Bet365',
    BW: 'Bet&Win',
    PS: 'Pinnacle',
    VC: 'BetVictor',
    WH: 'William Hill',
    IW: 'Interwetten'
  };

  /**
   * Normalizes provider bookmaker codes to canonical names.
   */
  public static normalize(code: string): string {
    return this.mappings[code] || code;
  }
}
