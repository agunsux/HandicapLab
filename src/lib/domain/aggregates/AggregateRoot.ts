import { DomainEvent } from '../events/DomainEvent';

export abstract class AggregateRoot {
  readonly id: string;
  private _version: number = 0;
  private _domainEvents: DomainEvent[] = [];

  protected constructor(id: string) { this.id = id; }

  get version(): number { return this._version; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
    this._version++;
  }

  clearEvents(): void { this._domainEvents = []; }
  abstract validate(): boolean;
}
