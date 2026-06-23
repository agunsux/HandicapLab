# Model Comparison Report (Simulation vs. Real Data)

**Verdict Summary:** PARTIAL ALIGNMENT - Key signals hold but patterns show some variance

## Pattern Checks

- **Is Pressure dominant in Simulated Model?** 🟢 YES
- **Is Pressure dominant in Real Data Model?** 🔴 NO
- **Does Pressure Monotonicity hold on Real Data?** 🔴 NO (0.359 < 0.109 < 0.000 < 0.000)

## Directional Consistency (Sign Alignment)

- **Tempo alignment across states**: 67% (2/3 states match)
- **Pressure alignment across states**: 67% (2/3 states match)
- **Defensive Shape alignment across states**: 0% (0/3 states match)

---

## Detailed Weights Comparison

### State 0-0
- **Simulated**: Tempo=0.058, Pressure=-0.468, DefShape=0.137
- **Real Data**: Tempo=0.133, Pressure=-0.359, DefShape=-1.415
- **Directions**: Tempo matches? YES, Pressure matches? YES, DefShape matches? NO

### State 1-0
- **Simulated**: Tempo=0.065, Pressure=-0.507, DefShape=0.085
- **Real Data**: Tempo=0.061, Pressure=0.298, DefShape=-1.194
- **Directions**: Tempo matches? YES, Pressure matches? NO, DefShape matches? NO

### State 0-1
- **Simulated**: Tempo=-0.003, Pressure=-0.508, DefShape=0.092
- **Real Data**: Tempo=0.473, Pressure=-0.516, DefShape=-1.223
- **Directions**: Tempo matches? NO, Pressure matches? YES, DefShape matches? NO


