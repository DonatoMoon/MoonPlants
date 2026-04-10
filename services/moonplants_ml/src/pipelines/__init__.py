from .train import main as train_main
from .predict import main as predict_main, predict_watering_plan

__all__ = ["train_main", "predict_main", "predict_watering_plan"]

