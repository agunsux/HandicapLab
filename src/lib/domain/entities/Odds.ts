/**
 * HandicapLab Domain-Driven Design — Odds Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface OddsDTO {
  id: string;
  fixtureId: string;
  providerId: string;
  marketType: string;
  line: number;
  homeOdds: number;
  awayOdds: number;
  capturedAt: string;
  drawOdds?: number | null;
}

export class Odds {
  readonly id: string;
  readonly _fixtureId: string;
  readonly _providerId: string;
  readonly _marketType: string;
  readonly _line: number;
  readonly _homeOdds: number;
  readonly _awayOdds: number;
  readonly _capturedAt: string;
  readonly _drawOdds?: number | null;

  private constructor(
    id: string,
    fixtureId: string,
    providerId: string,
    marketType: string,
    line: number,
    homeOdds: number,
    awayOdds: number,
    capturedAt: string,
    drawOdds?: number | null
  ) {
    this.id = id;
    this._fixtureId = fixtureId;
    this._providerId = providerId;
    this._marketType = marketType;
    this._line = line;
    this._homeOdds = homeOdds;
    this._awayOdds = awayOdds;
    this._capturedAt = capturedAt;
    this._drawOdds = drawOdds;
    Object.freeze(this);
  }

  static create(
    fixtureId: string,
    providerId: string,
    marketType: string,
    line: number,
    homeOdds: number,
    awayOdds: number,
    capturedAt: string,
    drawOdds?: number | null
  ): Odds {
    const id = generateId(ID_PREFIX.ODDS);
    return new Odds(id, fixtureId, providerId, marketType, line, homeOdds, awayOdds, capturedAt, drawOdds);
  }

  static fromDTO(dto: OddsDTO): Odds {
    return new Odds(dto.id, dto.fixtureId, dto.providerId, dto.marketType, dto.line, dto.homeOdds, dto.awayOdds, dto.capturedAt, dto.drawOdds);
  }

  toDTO(): OddsDTO {
    return {
      id: this.id,
      fixtureId: this._fixtureId,
      providerId: this._providerId,
      marketType: this._marketType,
      line: this._line,
      homeOdds: this._homeOdds,
      awayOdds: this._awayOdds,
      capturedAt: this._capturedAt,
      drawOdds: this._drawOdds
    };
  }

  get fixtureId(): string { return this._fixtureId; }
  get providerId(): string { return this._providerId; }
  get marketType(): string { return this._marketType; }
  get line(): number { return this._line; }
  get homeOdds(): number { return this._homeOdds; }
  get awayOdds(): number { return this._awayOdds; }
  get capturedAt(): string { return this._capturedAt; }
  get drawOdds(): number | null | undefined { return this._drawOdds; }

  equals(other: Odds): boolean {
    return this.id === other.id &&
      this._fixtureId === other._fixtureId &&
      this._providerId === other._providerId &&
      this._marketType === other._marketType &&
      this._line === other._line &&
      this._homeOdds === other._homeOdds &&
      this._awayOdds === other._awayOdds &&
      this._capturedAt === other._capturedAt &&
      this._drawOdds === other._drawOdds;
  }

}
