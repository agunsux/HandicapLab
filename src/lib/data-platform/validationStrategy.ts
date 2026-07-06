// HandicapLab Data Platform - Validation Strategy & Cross-Validation
export interface TimeWindow {
  startDate: Date;
  endDate: Date;
}

export interface ValidationFold {
  trainWindow: TimeWindow;
  testWindow: TimeWindow;
}

export class ValidationStrategy {
  /**
   * Generates folds for an Expanding Window validation strategy.
   * e.g. Train: 2020-2021, Test: 2022
   *      Train: 2020-2022, Test: 2023
   */
  public static expandingWindow(
    seasons: string[], // e.g. ['2020', '2021', '2022', '2023'] (start years)
    initialTrainSeasons = 2
  ): ValidationFold[] {
    const folds: ValidationFold[] = [];
    if (seasons.length <= initialTrainSeasons) return folds;

    for (let i = initialTrainSeasons; i < seasons.length; i++) {
      const trainStart = new Date(`${seasons[0]}-07-01T00:00:00Z`);
      const trainEnd = new Date(`${seasons[i]}-06-30T23:59:59Z`);
      const testStart = new Date(`${seasons[i]}-07-01T00:00:00Z`);
      const testEnd = new Date(`${Number(seasons[i]) + 1}-06-30T23:59:59Z`);

      folds.push({
        trainWindow: { startDate: trainStart, endDate: trainEnd },
        testWindow: { startDate: testStart, endDate: testEnd }
      });
    }
    return folds;
  }

  /**
   * Generates folds for a Rolling Window validation strategy.
   * e.g. Train: 2020-2021, Test: 2022
   *      Train: 2021-2022, Test: 2023
   */
  public static rollingWindow(
    seasons: string[],
    windowSize = 2
  ): ValidationFold[] {
    const folds: ValidationFold[] = [];
    if (seasons.length <= windowSize) return folds;

    for (let i = windowSize; i < seasons.length; i++) {
      const trainStart = new Date(`${seasons[i - windowSize]}-07-01T00:00:00Z`);
      const trainEnd = new Date(`${seasons[i]}-06-30T23:59:59Z`);
      const testStart = new Date(`${seasons[i]}-07-01T00:00:00Z`);
      const testEnd = new Date(`${Number(seasons[i]) + 1}-06-30T23:59:59Z`);

      folds.push({
        trainWindow: { startDate: trainStart, endDate: trainEnd },
        testWindow: { startDate: testStart, endDate: testEnd }
      });
    }
    return folds;
  }

  /**
   * Time-Series Cross Validation (Blocked)
   * Splits data into chronologically sorted blocks.
   * Train on blocks 1..k, test on block k+1.
   */
  public static timeSeriesCV(startDate: Date, endDate: Date, numFolds: number): ValidationFold[] {
    const totalMs = endDate.getTime() - startDate.getTime();
    const blockMs = totalMs / (numFolds + 1); // If 5 folds, we need 6 blocks

    const folds: ValidationFold[] = [];
    for (let i = 1; i <= numFolds; i++) {
      const trainEndMs = startDate.getTime() + (i * blockMs);
      const testEndMs = startDate.getTime() + ((i + 1) * blockMs);
      
      folds.push({
        trainWindow: { startDate, endDate: new Date(trainEndMs) },
        testWindow: { startDate: new Date(trainEndMs + 1), endDate: new Date(testEndMs) }
      });
    }
    return folds;
  }
}
