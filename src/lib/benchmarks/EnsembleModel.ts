import { IBenchmarkModel, PredictionVector } from './BaseModel';

export class EnsembleModel implements IBenchmarkModel {
  name = 'Ensemble (Poisson + Elo + Expectancy)';

  constructor(private models: IBenchmarkModel[]) {}

  async predict(match: any): Promise<PredictionVector | null> {
    let pHome = 0, pDraw = 0, pAway = 0;
    let validModels = 0;

    for (const model of this.models) {
      const pred = await model.predict(match);
      if (pred) {
        pHome += pred.pHome;
        pDraw += pred.pDraw;
        pAway += pred.pAway;
        validModels++;
      }
    }

    if (validModels === 0) return null;

    return {
      pHome: pHome / validModels,
      pDraw: pDraw / validModels,
      pAway: pAway / validModels
    };
  }
}
