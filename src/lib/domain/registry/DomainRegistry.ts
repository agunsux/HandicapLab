interface EntityConfig { entityClass: string; dtoInterface: string; factory: string; }
interface AggregateConfig { aggregateClass: string; rootEntity: string; invariants: string[]; }

const ALL_DOMAINS = [
  'Competition', 'Season', 'League', 'Fixture', 'Team', 'Player', 'Venue',
  'Odds', 'Market', 'Prediction', 'Probability', 'Calibration', 'Feature',
  'Decision', 'Policy', 'Stake', 'Portfolio', 'Research', 'Replay', 'Evidence',
  'Experiment', 'Model', 'Provider', 'Result', 'Performance', 'Drift', 'Risk', 'Report',
];

const DOMAIN_EVENTS: Record<string, string[]> = {
  Fixture: ['fixture.created', 'fixture.updated'], Odds: ['odds.captured'],
  Prediction: ['prediction.generated'], Calibration: ['calibration.completed'],
  Decision: ['decision.approved'], Stake: ['stake.calculated'],
  Result: ['result.collected'], Replay: ['replay.completed'],
  Research: ['research.finished'], Drift: ['drift.detected'],
  Model: ['champion.validated'], Report: ['report.generated'],
};

const AGGREGATE_MAP: Record<string, AggregateConfig> = {
  Fixture: { aggregateClass: 'FixtureAggregate', rootEntity: 'Fixture', invariants: ['Cannot finish if not started', 'Cannot start if cancelled'] },
  Prediction: { aggregateClass: 'PredictionAggregate', rootEntity: 'Prediction', invariants: ['Cannot settle unscheduled prediction', 'Cannot regenerate settled prediction'] },
  Decision: { aggregateClass: 'DecisionAggregate', rootEntity: 'Decision', invariants: ['Cannot execute rejected decision', 'Cannot approve without evaluation'] },
  Portfolio: { aggregateClass: 'PortfolioAggregate', rootEntity: 'Portfolio', invariants: ['Cannot exceed risk limit', 'Cannot allocate more than balance'] },
};

export class DomainRegistry {
  private static instance: DomainRegistry;
  private entities: Map<string, EntityConfig> = new Map();
  private events: Map<string, string[]> = new Map();
  private aggregates: Map<string, AggregateConfig> = new Map();

  private constructor() { this.initializeDefaults(); }

  static getInstance(): DomainRegistry {
    if (!DomainRegistry.instance) DomainRegistry.instance = new DomainRegistry();
    return DomainRegistry.instance;
  }

  private initializeDefaults(): void {
    for (const domain of ALL_DOMAINS) this.entities.set(domain, { entityClass: domain + '', dtoInterface: domain + 'DTO', factory: domain + '.create()' });
    for (const [domain, eventTypes] of Object.entries(DOMAIN_EVENTS)) this.events.set(domain, eventTypes);
    for (const [domain, config] of Object.entries(AGGREGATE_MAP)) this.aggregates.set(domain, config);
  }

  registerEntity(domain: string, config: EntityConfig): void { this.entities.set(domain, config); }
  registerEvents(domain: string, eventTypes: string[]): void { this.events.set(domain, eventTypes); }
  registerAggregate(domain: string, config: AggregateConfig): void { this.aggregates.set(domain, config); }
  getEntity(domain: string): EntityConfig | undefined { return this.entities.get(domain); }
  getEvents(domain: string): string[] | undefined { return this.events.get(domain); }
  getAggregate(domain: string): AggregateConfig | undefined { return this.aggregates.get(domain); }
  listDomains(): string[] { return [...ALL_DOMAINS]; }
  listEntities(): string[] { return [...this.entities.keys()]; }
  listEvents(): string[] { return [...this.events.keys()]; }
  listAggregates(): string[] { return [...this.aggregates.keys()]; }

  validate(): string[] {
    const issues: string[] = [];
    for (const domain of ALL_DOMAINS) if (!this.entities.has(domain)) issues.push('Missing entity for domain: ' + domain);
    return issues;
  }

  findDomainByEntity(entityName: string): string | null {
    return ALL_DOMAINS.find(d => this.entities.get(d)?.entityClass === entityName) ?? null;
  }

  findDomainByEvent(eventType: string): string | null {
    for (const [domain, events] of this.events) if (events.includes(eventType)) return domain;
    return null;
  }
}
