import yaml
import os
from pathlib import Path

class SchemaValidator:
    """
    Validates YAML files from the Knowledge Layer to ensure strict adherence 
    to the Research Governance schema before sinking into DuckDB.
    """
    
    REQUIRED_ALPHA_KEYS = [
        'alpha_id', 'name', 'status', 'owner', 'reviewer',
        'depends_on', 'produces', 'metrics'
    ]
    
    REQUIRED_METRICS_KEYS = [
        'sample_size', 'roi', 'clv', 'brier', 'p_value'
    ]
    
    @staticmethod
    def validate_alpha_yaml(filepath: str) -> bool:
        with open(filepath, 'r') as f:
            try:
                data = yaml.safe_load(f)
            except yaml.YAMLError as e:
                print(f"YAML parsing error in {filepath}: {e}")
                return False
                
        if not data:
            return False
            
        # Check root keys
        for key in SchemaValidator.REQUIRED_ALPHA_KEYS:
            if key not in data:
                print(f"Validation Failed: '{key}' missing in {filepath}")
                return False
                
        # Check metrics
        metrics = data.get('metrics', {})
        for key in SchemaValidator.REQUIRED_METRICS_KEYS:
            if key not in metrics:
                print(f"Validation Failed: metric '{key}' missing in {filepath}")
                return False
                
        return True

if __name__ == "__main__":
    test_path = Path(__file__).parent.parent / "knowledge" / "alpha" / "template_alpha.yaml"
    is_valid = SchemaValidator.validate_alpha_yaml(str(test_path))
    print(f"Template Alpha Valid: {is_valid}")
