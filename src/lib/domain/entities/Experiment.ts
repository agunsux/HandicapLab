/**
 * HandicapLab Domain-Driven Design — Experiment Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface ExperimentDTO {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  modelId: string;
  datasetId: string;
  status: string;
  metricsSummary: Record<string, number>;
}

export class Experiment {
  readonly id: string;
  readonly _name: string;
  readonly _description: string;
  readonly _hypothesis: string;
  readonly _modelId: string;
  readonly _datasetId: string;
  readonly _status: string;
  readonly _metricsSummary: Record<string, number>;

  private constructor(
    id: string,
    name: string,
    description: string,
    hypothesis: string,
    modelId: string,
    datasetId: string,
    status: string,
    metricsSummary: Record<string, number>
  ) {
    this.id = id;
    this._name = name;
    this._description = description;
    this._hypothesis = hypothesis;
    this._modelId = modelId;
    this._datasetId = datasetId;
    this._status = status;
    this._metricsSummary = metricsSummary;
    Object.freeze(this);
  }

  static create(
    name: string,
    description: string,
    hypothesis: string,
    modelId: string,
    datasetId: string,
    status: string,
    metricsSummary: Record<string, number>
  ): Experiment {
    const id = generateId(ID_PREFIX.EXPERIMENT);
    return new Experiment(id, name, description, hypothesis, modelId, datasetId, status, metricsSummary);
  }

  static fromDTO(dto: ExperimentDTO): Experiment {
    return new Experiment(dto.id, dto.name, dto.description, dto.hypothesis, dto.modelId, dto.datasetId, dto.status, dto.metricsSummary);
  }

  toDTO(): ExperimentDTO {
    return {
      id: this.id,
      name: this._name,
      description: this._description,
      hypothesis: this._hypothesis,
      modelId: this._modelId,
      datasetId: this._datasetId,
      status: this._status,
      metricsSummary: this._metricsSummary
    };
  }

  get name(): string { return this._name; }
  get description(): string { return this._description; }
  get hypothesis(): string { return this._hypothesis; }
  get modelId(): string { return this._modelId; }
  get datasetId(): string { return this._datasetId; }
  get status(): string { return this._status; }
  get metricsSummary(): Record<string, number> { return this._metricsSummary; }

  equals(other: Experiment): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._description === other._description &&
      this._hypothesis === other._hypothesis &&
      this._modelId === other._modelId &&
      this._datasetId === other._datasetId &&
      this._status === other._status &&
      this._metricsSummary === other._metricsSummary;
  }

}
