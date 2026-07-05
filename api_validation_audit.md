# HandicapLab API Validation Audit

This audit evaluates parameter inputs and Zod schemas applied to prevent malformed requests and ensure strict data types.

---

## 1. Zod Schema Definitions

### Predictions Schema (`predictionsQuerySchema`)
- **Query Params:**
  - `limit`: Integer between 1 and 100 (Default: 60)
  - `page`: Integer between 1 and 1000 (Default: 1)
- **Validation Rules:**
  - Rejects float or non-numeric values.
  - Limits max page size to prevent unlimited resource fetches.

### Signals Schema (`signalsQuerySchema`)
- **Query Params:**
  - `market`: Strict enum (`moneyline`, `asian_handicap`, `over_under`)
  - `minEdge`: Preprocessed decimal float between 0 and 100
  - `limit`: Integer between 1 and 100 (Default: 50)
  - `page`: Integer between 1 and 1000 (Default: 1)

### Fixtures Schema (`fixturesQuerySchema`)
- **Query Params:**
  - `limit`: Integer between 1 and 100 (Default: 50)
  - `page`: Integer between 1 and 1000 (Default: 1)

---

## 2. Reject Strategy
Any malformed parameter triggers a `422 Unprocessable Entity` response containing field-specific validation feedback.
