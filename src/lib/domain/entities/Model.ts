/**
 * HandicapLab Domain-Driven Design — Model Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type ModelType = 'poisson' | 'dixonColes' | 'elo' | 'gradientBoosting' | 'neuralNet' | 'ensemble';
export type ModelStatus = 'training' | 'ready' | 'deprecated' | 'retired' | 'failed';

export interface ModelDTO {
  id: string;
  name: string;
  version: string;
  modelType: ModelType;
  algorithm: string;
  hyperparameters: Record<string, unknown>;
  features: string[];
  trainingDatasetId: string;
  metrics: Record<string, number>;
  status: ModelStatus;
  deployedAt?: string;
}

export class Model {
  readonly id: string;
  readonly _name: string;
  readonly _version: string;
  readonly _modelType: ModelType;
  readonly _algorithm: string;
  readonly _hyperparameters: Record<string, unknown>;
  readonly _features: string[];
  readonly _trainingDatasetId: string;
  readonly _metrics: Record<string, number>;
  readonly _status: ModelStatus;
  readonly _deployedAt?: string;

  private constructor(
    id: string,
    name: string,
    version: string,
    modelType: ModelType,
    algorithm: string,
    hyperparameters: Record<string, unknown>,
    features: string[],
    trainingDatasetId: string,
    metrics: Record<string, number>,
    status: ModelStatus,
    deployedAt?: string
  ) {
    this.id = id;
    this._name = name;
    this._version = version;
    this._modelType = modelType;
    this._algorithm = algorithm;
    this._hyperparameters = hyperparameters;
    this._features = features;
    this._trainingDatasetId = trainingDatasetId;
    this._metrics = metrics;
    this._status = status;
    this._deployedAt = deployedAt;
    Object.freeze(this);
  }

  static create(
    name: string,
    version: string,
    modelType: ModelType,
    algorithm: string,
    hyperparameters: Record<string, unknown>,
    features: string[],
    trainingDatasetId: string,
    metrics: Record<string, number>,
    status: ModelStatus,
    deployedAt?: string
  ): Model {
    const id = generateId(ID_PREFIX.MODEL);
    return new Model(id, name, version, modelType, algorithm, hyperparameters, features, trainingDatasetId, metrics, status, deployedAt);
  }

  static fromDTO(dto: ModelDTO): Model {
    return new Model(dto.id, dto.name, dto.version, dto.modelType, dto.algorithm, dto.hyperparameters, dto.features, dto.trainingDatasetId, dto.metrics, dto.status, dto.deployedAt);
  }

  toDTO(): ModelDTO {
    return {
      id: this.id,
      name: this._name,
      version: this._version,
      modelType: this._modelType,
      algorithm: this._algorithm,
      hyperparameters: this._hyperparameters,
      features: this._features,
      trainingDatasetId: this._trainingDatasetId,
      metrics: this._metrics,
      status: this._status,
      deployedAt: this._deployedAt
    };
  }

  get name(): string { return this._name; }
  get version(): string { return this._version; }
  get modelType(): ModelType { return this._modelType; }
  get algorithm(): string { return this._algorithm; }
  get hyperparameters(): Record<string, unknown> { return this._hyperparameters; }
  get features(): string[] { return this._features; }
  get trainingDatasetId(): string { return this._trainingDatasetId; }
  get metrics(): Record<string, number> { return this._metrics; }
  get status(): ModelStatus { return this._status; }
  get deployedAt(): string | undefined { return this._deployedAt; }

  equals(other: Model): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._version === other._version &&
      this._modelType === other._modelType &&
      this._algorithm === other._algorithm &&
      this._hyperparameters === other._hyperparameters &&
      this._features === other._features &&
      this._trainingDatasetId === other._trainingDatasetId &&
      this._metrics === other._metrics &&
      this._status === other._status &&
      this._deployedAt === other._deployedAt;
  }

}
