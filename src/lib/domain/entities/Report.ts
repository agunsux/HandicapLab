/**
 * HandicapLab Domain-Driven Design — Report Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'onDemand';
export interface ReportSection { title: string; content: Record<string, unknown>; order: number; }

export interface ReportDTO {
  id: string;
  type: ReportType;
  period: string;
  generatedAt: string;
  metricsSummary: Record<string, number>;
  sections: ReportSection[];
  format: string;
}

export class Report {
  readonly id: string;
  readonly _type: ReportType;
  readonly _period: string;
  readonly _generatedAt: string;
  readonly _metricsSummary: Record<string, number>;
  readonly _sections: ReportSection[];
  readonly _format: string;

  private constructor(
    id: string,
    type: ReportType,
    period: string,
    generatedAt: string,
    metricsSummary: Record<string, number>,
    sections: ReportSection[],
    format: string
  ) {
    this.id = id;
    this._type = type;
    this._period = period;
    this._generatedAt = generatedAt;
    this._metricsSummary = metricsSummary;
    this._sections = sections;
    this._format = format;
    Object.freeze(this);
  }

  static create(
    type: ReportType,
    period: string,
    generatedAt: string,
    metricsSummary: Record<string, number>,
    sections: ReportSection[],
    format: string
  ): Report {
    const id = generateId(ID_PREFIX.REPORT);
    return new Report(id, type, period, generatedAt, metricsSummary, sections, format);
  }

  static fromDTO(dto: ReportDTO): Report {
    return new Report(dto.id, dto.type, dto.period, dto.generatedAt, dto.metricsSummary, dto.sections, dto.format);
  }

  toDTO(): ReportDTO {
    return {
      id: this.id,
      type: this._type,
      period: this._period,
      generatedAt: this._generatedAt,
      metricsSummary: this._metricsSummary,
      sections: this._sections,
      format: this._format
    };
  }

  get type(): ReportType { return this._type; }
  get period(): string { return this._period; }
  get generatedAt(): string { return this._generatedAt; }
  get metricsSummary(): Record<string, number> { return this._metricsSummary; }
  get sections(): ReportSection[] { return this._sections; }
  get format(): string { return this._format; }

  equals(other: Report): boolean {
    return this.id === other.id &&
      this._type === other._type &&
      this._period === other._period &&
      this._generatedAt === other._generatedAt &&
      this._metricsSummary === other._metricsSummary &&
      this._sections === other._sections &&
      this._format === other._format;
  }

}
