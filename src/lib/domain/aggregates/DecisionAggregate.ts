import { AggregateRoot } from './AggregateRoot';
import { DecisionApprovedEvent } from '../events/DecisionEvents';

export enum DecisionState { PENDING = 'PENDING', EVALUATED = 'EVALUATED', APPROVED = 'APPROVED', REJECTED = 'REJECTED', EXECUTED = 'EXECUTED' }

export class DecisionAggregate extends AggregateRoot {
  private _state: DecisionState = DecisionState.PENDING;
  private _fixtureId: string;
  private _predictionId: string;
  private _edge: number = 0;
  private _rejectionReason: string = '';

  constructor(id: string, fixtureId: string, predictionId: string) { super(id); this._fixtureId = fixtureId; this._predictionId = predictionId; }
  get state(): DecisionState { return this._state; }

  evaluate(edge: number): void {
    if (this._state !== DecisionState.PENDING) throw new Error('Cannot evaluate from state ' + this._state);
    this._edge = edge; this._state = DecisionState.EVALUATED;
  }

  approve(): void {
    if (this._state !== DecisionState.EVALUATED) throw new Error('Cannot approve from state ' + this._state);
    this._state = DecisionState.APPROVED;
    this.addDomainEvent(DecisionApprovedEvent.create(this._fixtureId, this._predictionId, 'APPROVED', 0, this._edge));
  }

  reject(reason: string): void {
    if (this._state !== DecisionState.EVALUATED) throw new Error('Cannot reject from state ' + this._state);
    this._rejectionReason = reason; this._state = DecisionState.REJECTED;
  }

  execute(): void {
    if (this._state !== DecisionState.APPROVED) throw new Error('Cannot execute from state ' + this._state);
    this._state = DecisionState.EXECUTED;
  }

  validate(): boolean { return this._state !== DecisionState.REJECTED || this._rejectionReason.length > 0; }
}
