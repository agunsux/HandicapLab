import os
import random
import numpy as np

def seed_everything(seed=42):
    """
    Sets seed for Python random, NumPy, and environment variables 
    to ensure full reproducibility across experiments.
    Also handles scikit-learn random states where globally applicable.
    """
    random.seed(seed)
    np.random.seed(seed)
    os.environ['PYTHONHASHSEED'] = str(seed)
    
    # If we add torch or tf in the future, seed them here:
    # try:
    #     import torch
    #     torch.manual_seed(seed)
    #     torch.cuda.manual_seed_all(seed)
    # except ImportError:
    #     pass
    
    print(f"Global seed set to {seed}")
