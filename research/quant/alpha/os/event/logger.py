import json
from datetime import datetime
from pathlib import Path
import uuid

class EventSourcingLogger:
    """
    Immutable Event Sourcing Logger.
    Logs every state transition in the Alpha Discovery OS.
    """
    
    def __init__(self, log_dir: str):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_file = self.log_dir / "alpha_events.jsonl"
        
    def log_event(self, entity_id: str, event_type: str, metadata: dict = None):
        """
        Appends an immutable event to the log.
        """
        event = {
            "event_id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "entity_id": entity_id,
            "event_type": event_type,
            "metadata": metadata or {}
        }
        
        with open(self.log_file, "a") as f:
            f.write(json.dumps(event) + "\n")
            
        return event['event_id']

if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent / "event"
    logger = EventSourcingLogger(str(base_dir))
    
    # Simulate a lifecycle
    logger.log_event("A-041", "ALPHA_CREATED", {"owner": "research_engine"})
    logger.log_event("A-041", "EXPERIMENT_ADDED", {"exp_id": "EXP-221"})
    logger.log_event("A-041", "REPLICATION_PASSED", {"score": 92})
    logger.log_event("A-041", "PROMOTION_REQUESTED", {})
    
    print(f"Events logged to {logger.log_file}")
