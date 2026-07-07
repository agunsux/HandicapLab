import mlflow
import subprocess
import yaml

def get_git_commit():
    try:
        return subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode('ascii').strip()
    except Exception:
        return "unknown"

class MLflowLogger:
    def __init__(self, experiment_name):
        self.experiment_name = experiment_name
        mlflow.set_experiment(experiment_name)
        
    def start_run(self, config_path):
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
            
        self.run = mlflow.start_run(run_name=self.config['experiment']['id'])
        
        # Log basic config
        mlflow.log_params({
            "git_commit": get_git_commit(),
            "walk_forward": self.config['validation'].get('walk_forward', False),
            "lolo": self.config['validation'].get('leave_one_league_out', False),
            "seed": self.config.get('seed', 42)
        })
        
        # Save the config file itself as artifact
        mlflow.log_artifact(config_path)
        
    def log_metrics(self, metrics_dict, step=None):
        mlflow.log_metrics(metrics_dict, step=step)
        
    def log_artifact(self, file_path):
        mlflow.log_artifact(file_path)
        
    def log_dataset_metadata(self, metadata: dict):
        self.dataset_metadata = metadata
        mlflow.log_params({
            "dataset_hash": metadata.get("dataset_hash"),
            "row_count": metadata.get("row_count"),
            "league_count": metadata.get("league_count")
        })
        
    def end_run(self, final_metrics=None, status="INVALID"):
        import json
        manifest = {
            "experiment_id": self.config['experiment']['id'],
            "git_commit": get_git_commit(),
            "status": status,
            "dataset_metadata": getattr(self, 'dataset_metadata', {}),
            "metrics": final_metrics or {}
        }
        
        manifest_path = "manifest.json"
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=4)
            
        self.log_artifact(manifest_path)
        mlflow.end_run()
