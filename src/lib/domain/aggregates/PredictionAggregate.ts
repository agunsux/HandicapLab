import { AggregateRoot } from './AggregateRoot';
import { PredictionGeneratedEvent } from '../events/PredictionEvents';

export enum PredictionState { PENDING = 'PENDING', GENERATED = 'GENERATED', SETTLED = 'SETTLED', INVALIDATED = 'INVALIDATED' }

export class PredictionAggregate extends AggregateRoot {
  private _state: PredictionState = PredictionState.PENDING;
  private _fixtureId: string;
  private _modelId: string;
  private _homeProb: number = 0;
  private _awayProb: number = 0;

  constructor(id: string, fixtureId: string, modelId: string) { super(id); this._fixtureId = fixtureId; this._modelId = modelId; }
  get state(): PredictionState { return this._state; }

  generate(homeProb: number, awayProb: number, drawProb: number | null, confidence: number): void {
    if (this._state !== PredictionState.PENDING) throw new Error('Cannot generate from state ' + this._state);
    this._homeProb = homeProb; this._awayProb = awayProb;
    this._state = PredictionState.GENERATED;
    this.addDomainEvent(PredictionGeneratedEvent.create(this._fixtureId, this._modelId, homeProb, awayProb, drawProb, confidence));
  }

  settle(outcome: number): void {
    if (this._state !== PredictionState.GENERATED) throw new Error('Cannot settle from state ' + this._state);
    this._state = PredictionState.SETTLED;
  }

  invalidate(reason: string): void {
    if (this._state === PredictionState.SETTLED) throw new Error('Cannot invalidate settled prediction');
    this._state = PredictionState.INVALIDATED;
  }

  validate(): boolean { if (this._state === PredictionState.GENERATED && (this._homeProb <= 0 || this._awayProb <= 0)) return false; return true; }
}
