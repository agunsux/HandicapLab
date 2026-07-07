from enum import Enum

class EvidenceLevel(Enum):
    L0 = "L0"  # Concept
    L1 = "L1"  # Simulation
    L2 = "L2"  # Historical
    L3 = "L3"  # Out-of-Sample
    L4 = "L4"  # Walk Forward
    L5 = "L5"  # Live Paper Trading
    L6 = "L6"  # Real Market
    
    @classmethod
    def from_string(cls, level_str: str) -> 'EvidenceLevel':
        for level in cls:
            if level.value == level_str:
                return level
        raise ValueError(f"Unknown Evidence Level: {level_str}")

class LifecycleStage(Enum):
    HYPOTHESIS = "Hypothesis"
    SIMULATION = "Simulation"
    HISTORICAL = "Historical"
    OUT_OF_SAMPLE = "Out-of-Sample"
    WALK_FORWARD = "Walk Forward"
    PAPER_TRADING = "Paper Trading"
    LIVE_VALIDATION = "Live Validation"
    PRODUCTION = "Production"
