export class LeagueAliasResolver {
  private static readonly aliases: Record<string, string> = {
    E0: 'Premier League',
    'England Premier League': 'Premier League'
  };

  /**
   * Standardizes league name abbreviations to canonical values.
   */
  public static resolve(name: string): string {
    return this.aliases[name] || name;
  }
}
