export type ContractColumnType = 'BigInt' | 'String' | 'Integer' | 'DateTime' | 'Float' | 'Boolean' | 'JSONB';

export interface ContractColumn {
  type: ContractColumnType;
  required: boolean;
  nullable: boolean;
}

export interface DataContractDefinition {
  datasetId: string;
  version: string;
  columns: Record<string, ContractColumn>;
  primaryKey: string[];
  foreignKeys?: Record<string, { targetTable: string; targetColumn: string }>;
  compatibilityVersion: string;
}

export class DataContractValidator {
  private readonly contract: DataContractDefinition;

  constructor(contract: DataContractDefinition) {
    this.contract = contract;
  }

  public validateRow(row: Record<string, any>): string[] {
    const errors: string[] = [];

    // Verify columns against schema contract
    for (const [colName, rule] of Object.entries(this.contract.columns)) {
      const value = row[colName];

      if (value === undefined || value === null) {
        if (rule.required && !rule.nullable) {
          errors.push(`Column "${colName}" is required but was missing or null.`);
        }
        continue;
      }

      // Type verification
      const typeValid = this.checkType(value, rule.type);
      if (!typeValid) {
        errors.push(`Column "${colName}" type mismatch. Expected ${rule.type}, received ${typeof value}.`);
      }
    }

    return errors;
  }

  private checkType(value: any, expectedType: ContractColumnType): boolean {
    switch (expectedType) {
      case 'BigInt':
      case 'Integer':
        return typeof value === 'number' && Number.isInteger(value);
      case 'String':
        return typeof value === 'string';
      case 'Float':
        return typeof value === 'number';
      case 'Boolean':
        return typeof value === 'boolean';
      case 'DateTime':
        // String ISO 8601 or Date object
        if (value instanceof Date) return true;
        if (typeof value !== 'string') return false;
        return !isNaN(Date.parse(value));
      case 'JSONB':
        return typeof value === 'object' && value !== null;
      default:
        return false;
    }
  }
}
