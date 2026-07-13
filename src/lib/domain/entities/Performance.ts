/**
 * HandicapLab Domain-Driven Design — Performance Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type PerformancePeriod = 'daily' | 'weekly' | 'monthly' | 'all';
export type PerformanceWindow = 30 | 60 | 90 | 180 | 365;

export interface PerformanceDTO {
  id: string;
  modelId: string;
  period: PerformancePeriod;
  window: PerformanceWindow;
  roi: number;
  clv: number;
  brierScore: number;
  ece: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  accuracy: number;
  sampleSize: number;
}

export class Performance {
  readonly id: string;
  readonly _modelId: string;
  readonly _period: PerformancePeriod;
  readonly _window: PerformanceWindow;
  readonly _roi: number;
  readonly _clv: number;
  readonly _brierScore: number;
  readonly _ece: number;
  readonly _sharpe: number;
  readonly _sortino: number;
  readonly _maxDrawdown: number;
  readonly _accuracy: number;
  readonly _sampleSize: number;

  private constructor(
    id: string,
    modelId: string,
    period: PerformancePeriod,
    window: PerformanceWindow,
    roi: number,
    clv: number,
    brierScore: number,
    ece: number,
    sharpe: number,
    sortino: number,
    maxDrawdown: number,
    accuracy: number,
    sampleSize: number
  ) {
    this.id = id;
    this._modelId = modelId;
    this._period = period;
    this._window = window;
    this._roi = roi;
    this._clv = clv;
    this._brierScore = brierScore;
    this._ece = ece;
    this._sharpe = sharpe;
    this._sortino = sortino;
    this._maxDrawdown = maxDrawdown;
    this._accuracy = accuracy;
    this._sampleSize = sampleSize;
    Object.freeze(this);
  }

  static create(
    modelId: string,
    period: PerformancePeriod,
    window: PerformanceWindow,
    roi: number,
    clv: number,
    brierScore: number,
    ece: number,
    sharpe: number,
    sortino: number,
    maxDrawdown: number,
    accuracy: number,
    sampleSize: number
  ): Performance {
    const id = generateId(ID_PREFIX.PERFORMANCE);
    return new Performance(id, modelId, period, window, roi, clv, brierScore, ece, sharpe, sortino, maxDrawdown, accuracy, sampleSize);
  }

  static fromDTO(dto: PerformanceDTO): Performance {
    return new Performance(dto.id, dto.modelId, dto.period, dto.window, dto.roi, dto.clv, dto.brierScore, dto.ece, dto.sharpe, dto.sortino, dto.maxDrawdown, dto.accuracy, dto.sampleSize);
  }

  toDTO(): PerformanceDTO {
    return {
      id: this.id,
      modelId: this._modelId,
      period: this._period,
      window: this._window,
      roi: this._roi,
      clv: this._clv,
      brierScore: this._brierScore,
      ece: this._ece,
      sharpe: this._sharpe,
      sortino: this._sortino,
      maxDrawdown: this._maxDrawdown,
      accuracy: this._accuracy,
      sampleSize: this._sampleSize
    };
  }

  get modelId(): string { return this._modelId; }
  get period(): PerformancePeriod { return this._period; }
  get window(): PerformanceWindow { return this._window; }
  get roi(): number { return this._roi; }
  get clv(): number { return this._clv; }
  get brierScore(): number { return this._brierScore; }
  get ece(): number { return this._ece; }
  get sharpe(): number { return this._sharpe; }
  get sortino(): number { return this._sortino; }
  get maxDrawdown(): number { return this._maxDrawdown; }
  get accuracy(): number { return this._accuracy; }
  get sampleSize(): number { return this._sampleSize; }

  equals(other: Performance): boolean {
    return this.id === other.id &&
      this._modelId === other._modelId &&
      this._period === other._period &&
      this._window === other._window &&
      this._roi === other._roi &&
      this._clv === other._clv &&
      this._brierScore === other._brierScore &&
      this._ece === other._ece &&
      this._sharpe === other._sharpe &&
      this._sortino === other._sortino &&
      this._maxDrawdown === other._maxDrawdown &&
      this._accuracy === other._accuracy &&
      this._sampleSize === other._sampleSize;
  }

}
