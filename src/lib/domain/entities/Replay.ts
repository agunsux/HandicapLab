/**
 * HandicapLab Domain-Driven Design — Replay Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type ReplayStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ReplayDTO {
  id: string;
  datasetId: string;
  modelIds: string[];
  fixtureCount: number;
  status: ReplayStatus;
  progress: number;
  resultsSummary: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
}

export class Replay {
  readonly id: string;
  readonly _datasetId: string;
  readonly _modelIds: string[];
  readonly _fixtureCount: number;
  readonly _status: ReplayStatus;
  readonly _progress: number;
  readonly _resultsSummary: Record<string, unknown>;
  readonly _startTime?: string;
  readonly _endTime?: string;

  private constructor(
    id: string,
    datasetId: string,
    modelIds: string[],
    fixtureCount: number,
    status: ReplayStatus,
    progress: number,
    resultsSummary: Record<string, unknown>,
    startTime?: string,
    endTime?: string
  ) {
    this.id = id;
    this._datasetId = datasetId;
    this._modelIds = modelIds;
    this._fixtureCount = fixtureCount;
    this._status = status;
    this._progress = progress;
    this._resultsSummary = resultsSummary;
    this._startTime = startTime;
    this._endTime = endTime;
    Object.freeze(this);
  }

  static create(
    datasetId: string,
    modelIds: string[],
    fixtureCount: number,
    status: ReplayStatus,
    progress: number,
    resultsSummary: Record<string, unknown>,
    startTime?: string,
    endTime?: string
  ): Replay {
    const id = generateId(ID_PREFIX.REPLAY);
    return new Replay(id, datasetId, modelIds, fixtureCount, status, progress, resultsSummary, startTime, endTime);
  }

  static fromDTO(dto: ReplayDTO): Replay {
    return new Replay(dto.id, dto.datasetId, dto.modelIds, dto.fixtureCount, dto.status, dto.progress, dto.resultsSummary, dto.startTime, dto.endTime);
  }

  toDTO(): ReplayDTO {
    return {
      id: this.id,
      datasetId: this._datasetId,
      modelIds: this._modelIds,
      fixtureCount: this._fixtureCount,
      status: this._status,
      progress: this._progress,
      resultsSummary: this._resultsSummary,
      startTime: this._startTime,
      endTime: this._endTime
    };
  }

  get datasetId(): string { return this._datasetId; }
  get modelIds(): string[] { return this._modelIds; }
  get fixtureCount(): number { return this._fixtureCount; }
  get status(): ReplayStatus { return this._status; }
  get progress(): number { return this._progress; }
  get resultsSummary(): Record<string, unknown> { return this._resultsSummary; }
  get startTime(): string | undefined { return this._startTime; }
  get endTime(): string | undefined { return this._endTime; }

  equals(other: Replay): boolean {
    return this.id === other.id &&
      this._datasetId === other._datasetId &&
      this._modelIds === other._modelIds &&
      this._fixtureCount === other._fixtureCount &&
      this._status === other._status &&
      this._progress === other._progress &&
      this._resultsSummary === other._resultsSummary &&
      this._startTime === other._startTime &&
      this._endTime === other._endTime;
  }

}
