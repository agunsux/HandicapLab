/**
 * HandicapLab Domain-Driven Design — Provider Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type ProviderType = 'api' | 'csv' | 'webhook' | 'manual';
export type ProviderStatus = 'active' | 'inactive' | 'error' | 'rateLimited';
export type ProviderHealth = 'healthy' | 'degraded' | 'down';

export interface ProviderDTO {
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  apiVersion: string;
  supportedDataTypes: string[];
  status: ProviderStatus;
  priority: number;
  health: ProviderHealth;
  lastCheckedAt: string
}

export class Provider {
  readonly id: string;
  readonly _name: string;
  readonly _providerType: ProviderType;
  readonly _baseUrl: string;
  readonly _apiVersion: string;
  readonly _supportedDataTypes: string[];
  readonly _status: ProviderStatus;
  readonly _priority: number;
  readonly _health: ProviderHealth;
  readonly _lastCheckedAt: string;

  private constructor(
    id: string,
    name: string,
    providerType: ProviderType,
    baseUrl: string,
    apiVersion: string,
    supportedDataTypes: string[],
    status: ProviderStatus,
    priority: number,
    health: ProviderHealth,
    lastCheckedAt: string
  ) {
    this.id = id;
    this._name = name;
    this._providerType = providerType;
    this._baseUrl = baseUrl;
    this._apiVersion = apiVersion;
    this._supportedDataTypes = supportedDataTypes;
    this._status = status;
    this._priority = priority;
    this._health = health;
    this._lastCheckedAt = lastCheckedAt;
    Object.freeze(this);
  }

  static create(
    name: string,
    providerType: ProviderType,
    baseUrl: string,
    apiVersion: string,
    supportedDataTypes: string[],
    status: ProviderStatus,
    priority: number,
    health: ProviderHealth,
    lastCheckedAt: string
  ): Provider {
    const id = generateId(ID_PREFIX.PROVIDER);
    return new Provider(id, name, providerType, baseUrl, apiVersion, supportedDataTypes, status, priority, health, lastCheckedAt);
  }

  static fromDTO(dto: ProviderDTO): Provider {
    return new Provider(dto.id, dto.name, dto.providerType, dto.baseUrl, dto.apiVersion, dto.supportedDataTypes, dto.status, dto.priority, dto.health, dto.lastCheckedAt);
  }

  toDTO(): ProviderDTO {
    return {
      id: this.id,
      name: this._name,
      providerType: this._providerType,
      baseUrl: this._baseUrl,
      apiVersion: this._apiVersion,
      supportedDataTypes: this._supportedDataTypes,
      status: this._status,
      priority: this._priority,
      health: this._health,
      lastCheckedAt: this._lastCheckedAt
    };
  }

  equals(other: Provider): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._providerType === other._providerType &&
      this._baseUrl === other._baseUrl &&
      this._apiVersion === other._apiVersion &&
      this._supportedDataTypes === other._supportedDataTypes &&
      this._status === other._status &&
      this._priority === other._priority &&
      this._health === other._health &&
      this._lastCheckedAt === other._lastCheckedAt;
  }

}
