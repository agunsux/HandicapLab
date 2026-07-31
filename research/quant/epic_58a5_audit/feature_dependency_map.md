# Feature Dependency Map

```mermaid
graph TD
    %% Raw Inputs
    Date[Date & Time] --> Form[Rolling Form / Rest Days]
    Teams[Home/Away Teams] --> Ratings[Team Strength Ratings]
    Goals[FTHG, FTAG] --> Form
    Stats[Shots, Corners] --> Expected[xG Proxies]
    Odds[Historical Odds / Pinnacle] --> Market[Market Implied Probabilities]

    %% Derived Features
    Form --> ML_Model[Moneyline Model]
    Form --> AH_Model[Asian Handicap Model]
    Form --> OU_Model[Over/Under Model]
    Form --> BTTS_Model[BTTS Model]
    
    Ratings --> ML_Model
    Ratings --> AH_Model
    
    Expected --> OU_Model
    Expected --> BTTS_Model
    
    Market --> ML_Model
    Market --> AH_Model
    Market --> OU_Model
    Market --> BTTS_Model
```

## Supported Markets Dependency
- **Moneyline:** Heavily relies on Team Ratings, recent Form (W/D/L), and closing Pinnacle ML odds.
- **Asian Handicap:** Heavily relies on Goal Difference rolling averages, Home Advantage, and closing Pinnacle AH lines.
- **Over/Under:** Heavily relies on historical match goal averages, Shots on Target (xG proxies), and pace of play.
- **BTTS:** Relies on defensive/offensive consistency, and BTTS historical rates.
