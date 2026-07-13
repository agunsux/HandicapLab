/**
 * HandicapLab Domain-Driven Design — Feature Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type FeatureCategory = 'derived' | 'raw' | 'computed' | 'external';
export type FeatureDataType = 'numerical' | 'categorical' | 'boolean' | 'vector';

export interface FeatureDTO {
  name: string;
  version: string;
  category: FeatureCategory;
  description: string;
  dataType: FeatureDataType;
  computationType: string;
  dependencies: string[]
}

export class Feature {
  readonly id: string;
  readonly _name: string;
  readonly _version: string;
  readonly _category: FeatureCategory;
  readonly _description: string;
  readonly _dataType: FeatureDataType;
  readonly _computationType: string;
  readonly _dependencies: string[];

  private constructor(
    id: string,
    name: string,
    version: string,
    category: FeatureCategory,
    description: string,
    dataType: FeatureDataType,
    computationType: string,
    dependencies: string[]
  ) {
    this.id = id;
    this._name = name;
    this._version = version;
    this._category = category;
    this._description = description;
    this._dataType = dataType;
    this._computationType = computationType;
    this._dependencies = dependencies;
    Object.freeze(this);
  }

  static create(
    name: string,
    version: string,
    category: FeatureCategory,
    description: string,
    dataType: FeatureDataType,
    computationType: string,
    dependencies: string[]
  ): Feature {
    const id = generateId(ID_PREFIX.FEATURE);
    return new Feature(id, name, version, category, description, dataType, computationType, dependencies);
  }

  static fromDTO(dto: FeatureDTO): Feature {
    return new Feature(dto.id, dto.name, dto.version, dto.category, dto.description, dto.dataType, dto.computationType, dto.dependencies);
  }

  toDTO(): FeatureDTO {
    return {
      id: this.id,
      name: this._name,
      version: this._version,
      category: this._category,
      description: this._description,
      dataType: this._dataType,
      computationType: this._computationType,
      dependencies: this._dependencies
    };
  }

  equals(other: Feature): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._version === other._version &&
      this._category === other._category &&
      this._description === other._description &&
      this._dataType === other._dataType &&
      this._computationType === other._computationType &&
      this._dependencies === other._dependencies;
  }

}
