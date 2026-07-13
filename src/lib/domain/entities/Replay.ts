/**
 * HandicapLab Domain-Driven Design — Replay Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type ReplayStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ReplayDTO {
  datasetId: string;
  modelIds: string[];
  fixtureCount: number;
  startTime?: string;
  endTime?: string;
  status: ReplayStatus;
  progress: number;
  resultsSummary: Record<string, unknown>
}

export class Replay {
  readonly id: string;
  readonly _datasetId: string;
  readonly _modelIds: string[];
  readonly _fixtureCount: number;
  readonly _startTime: string;
  readonly _endTime: string;
  readonly _status: ReplayStatus;
  readonly _progress: number;
  readonly _resultsSummary: Record<string, unknown>;

  private constructor(
    id: string,
    datasetId: string,
    modelIds: string[],
    fixtureCount: number,
    startTime?: string,
    endTime?: string,
    status: ReplayStatus,
    progress: number,
    resultsSummary: Record<string, unknown>
  ) {
    this.id = id;
    this._datasetId = datasetId;
    this._modelIds = modelIds;
    this._fixtureCount = fixtureCount;
    this._startTime = startTime;
    this._endTime = endTime;
    this._status = status;
    this._progress = progress;
    this._resultsSummary = resultsSummary;
    Object.freeze(this);
  }

  static create(
    datasetId: string,
    modelIds: string[],
    fixtureCount: number,
    startTime?: string,
    endTime?: string,
    status: ReplayStatus,
    progress: number,
    resultsSummary: Record<string, unknown>
  ): Replay {
    const id = generateId(ID_PREFIX.REPLAY);
    return new Replay(id, datasetId, modelIds, fixtureCount, startTime, endTime, status, progress, resultsSummary);
  }

  static fromDTO(dto: ReplayDTO): Replay {
    return new Replay(dto.id, dto.datasetId, dto.modelIds, dto.fixtureCount, dto.startTime, dto.endTime, dto.status, dto.progress, dto.resultsSummary);
  }

  toDTO(): ReplayDTO {
    return {
      id: this.id,
      datasetId: this._datasetId,
      modelIds: this._modelIds,
      fixtureCount: this._fixtureCount,
      startTime: this._startTime,
      endTime: this._endTime,
      status: this._status,
      progress: this._progress,
      resultsSummary: this._resultsSummary
    };
  }

  equals(other: Replay): boolean {
    return this.id === other.id &&
      this._datasetId === other._datasetId &&
      this._modelIds === other._modelIds &&
      this._fixtureCount === other._fixtureCount &&
      this._startTime === other._startTime &&
      this._endTime === other._endTime &&
      this._status === other._status &&
      this._progress === other._progress &&
      this._resultsSummary === other._resultsSummary;
  }

}
