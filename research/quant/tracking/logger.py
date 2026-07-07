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
        
    def end_run(self):
        mlflow.end_run()
