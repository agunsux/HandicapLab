/**
 * HandicapLab Base Metadata
 * =================================
 * Standard metadata interface and contract for all registry entities.
 * 
 * Every entity in the registry system should conform to BaseMetadata,
 * ensuring uniform versioning, ownership, status tracking, and provenance.
 */
 
export interface BaseMetadata {
  id: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  status: string;
  description: string;
  tags: string[];
  source: string;
}
 
/**
 * Create a fully populated BaseMetadata object.
 * All optional fields default to sensible values, making it easy to
 * conform to the contract without boilerplate.
 */
export function createBaseMetadata(
  overrides: Partial<BaseMetadata> & { id: string; owner: string }
): BaseMetadata {
  const now = new Date().toISOString();
  return {
    id: overrides.id,
    version: overrides.version || '1.0.0',
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    owner: overrides.owner,
    status: overrides.status || 'active',
    description: overrides.description || '',
    tags: overrides.tags || [],
    source: overrides.source || 'system',
  };
}
