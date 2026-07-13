/**
 * HandicapLab Domain-Driven Design — Research Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type ResearchStatus = 'draft' | 'running' | 'completed' | 'failed' | 'published';

export interface ResearchDTO {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  methodology: string;
  datasetId: string;
  modelIds: string[];
  status: ResearchStatus;
  startedAt?: string;
  completedAt?: string;
  conclusion?: string;
}

export class Research {
  readonly id: string;
  readonly _name: string;
  readonly _description: string;
  readonly _hypothesis: string;
  readonly _methodology: string;
  readonly _datasetId: string;
  readonly _modelIds: string[];
  readonly _status: ResearchStatus;
  readonly _startedAt?: string;
  readonly _completedAt?: string;
  readonly _conclusion?: string;

  private constructor(
    id: string,
    name: string,
    description: string,
    hypothesis: string,
    methodology: string,
    datasetId: string,
    modelIds: string[],
    status: ResearchStatus,
    startedAt?: string,
    completedAt?: string,
    conclusion?: string
  ) {
    this.id = id;
    this._name = name;
    this._description = description;
    this._hypothesis = hypothesis;
    this._methodology = methodology;
    this._datasetId = datasetId;
    this._modelIds = modelIds;
    this._status = status;
    this._startedAt = startedAt;
    this._completedAt = completedAt;
    this._conclusion = conclusion;
    Object.freeze(this);
  }

  static create(
    name: string,
    description: string,
    hypothesis: string,
    methodology: string,
    datasetId: string,
    modelIds: string[],
    status: ResearchStatus,
    startedAt?: string,
    completedAt?: string,
    conclusion?: string
  ): Research {
    const id = generateId(ID_PREFIX.RESEARCH);
    return new Research(id, name, description, hypothesis, methodology, datasetId, modelIds, status, startedAt, completedAt, conclusion);
  }

  static fromDTO(dto: ResearchDTO): Research {
    return new Research(dto.id, dto.name, dto.description, dto.hypothesis, dto.methodology, dto.datasetId, dto.modelIds, dto.status, dto.startedAt, dto.completedAt, dto.conclusion);
  }

  toDTO(): ResearchDTO {
    return {
      id: this.id,
      name: this._name,
      description: this._description,
      hypothesis: this._hypothesis,
      methodology: this._methodology,
      datasetId: this._datasetId,
      modelIds: this._modelIds,
      status: this._status,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
      conclusion: this._conclusion
    };
  }

  get name(): string { return this._name; }
  get description(): string { return this._description; }
  get hypothesis(): string { return this._hypothesis; }
  get methodology(): string { return this._methodology; }
  get datasetId(): string { return this._datasetId; }
  get modelIds(): string[] { return this._modelIds; }
  get status(): ResearchStatus { return this._status; }
  get startedAt(): string | undefined { return this._startedAt; }
  get completedAt(): string | undefined { return this._completedAt; }
  get conclusion(): string | undefined { return this._conclusion; }

  equals(other: Research): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._description === other._description &&
      this._hypothesis === other._hypothesis &&
      this._methodology === other._methodology &&
      this._datasetId === other._datasetId &&
      this._modelIds === other._modelIds &&
      this._status === other._status &&
      this._startedAt === other._startedAt &&
      this._completedAt === other._completedAt &&
      this._conclusion === other._conclusion;
  }

}
