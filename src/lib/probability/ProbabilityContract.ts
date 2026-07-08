import { ProbabilityObject, ProbabilityObjectSchema } from './ProbabilityObject';

export class ProbabilityContract {
  /**
   * Validates and returns a ProbabilityObject. Throws if invalid.
   */
  static validate(data: unknown): ProbabilityObject {
    return ProbabilityObjectSchema.parse(data);
  }

  /**
   * Safely parses data into a ProbabilityObject. Returns a result object.
   */
  static safeParse(data: unknown) {
    return ProbabilityObjectSchema.safeParse(data);
  }

  /**
   * Initializes a new v1 ProbabilityObject with the required fields.
   */
  static create(rawProbability: number, riskFlags: string[] = []): ProbabilityObject {
    return ProbabilityContract.validate({
      probability_version: 'v1',
      raw_probability: rawProbability,
      risk_flags: riskFlags
    });
  }

  /**
   * Serializes a ProbabilityObject to JSON.
   */
  static serialize(obj: ProbabilityObject): string {
    return JSON.stringify(ProbabilityContract.validate(obj));
  }

  /**
   * Deserializes a JSON string to a ProbabilityObject. Throws if invalid.
   */
  static deserialize(json: string): ProbabilityObject {
    const parsed = JSON.parse(json);
    return ProbabilityContract.validate(parsed);
  }
}
