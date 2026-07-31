# Target Leakage Audit

The following fields contain POST MATCH data and MUST NEVER be used as direct inputs for predicting the match they belong to. They can ONLY be used to calculate trailing/rolling historical statistics for FUTURE matches.

### POST MATCH ONLY Features:
- **FTHG, FTAG, FTR**: Full time goals and results. (Direct target variables).
- **HTHG, HTAG, HTR**: Half time goals and results. (In-play leakage).
- **HS, AS, HST, AST**: Shots and shots on target. (Post match stats).
- **HF, AF, HC, AC**: Fouls and corners.
- **HY, AY, HR, AR**: Yellow and red cards.

### Rule of thumb for EPIC 58B Feature Engineering:
1. Filter out all these columns before passing the dataframe to any prediction model.
2. Only use these columns inside window functions (e.g., `df.groupby('HomeTeam')['FTHG'].rolling(5).mean()`).
3. Ensure window functions are shifted by 1 (`shift(1)`) to avoid current-match leakage.
