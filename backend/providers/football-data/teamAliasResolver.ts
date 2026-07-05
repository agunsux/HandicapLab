export class TeamAliasResolver {
  private static readonly aliases: Record<string, string> = {
    'Man United': 'Manchester United',
    'Man City': 'Manchester City'
  };

  /**
   * Translates provider specific team names to canonical representations.
   */
  public static resolve(name: string): string {
    return this.aliases[name] || name;
  }
}
