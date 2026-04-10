"""Check feature importance from trained LightGBM models."""
import sys
sys.path.insert(0, "D:/Web/MoonPlants/moonplants_ml/src")
import pickle
import numpy as np
import pandas as pd

def load_pkl(path):
    with open(path, "rb") as f:
        return pickle.load(f)

traj  = load_pkl("D:/Web/MoonPlants/moonplants_ml/artifacts/models/trajectory_model.pkl")
tte   = load_pkl("D:/Web/MoonPlants/moonplants_ml/artifacts/models/tte_model.pkl")
amt   = load_pkl("D:/Web/MoonPlants/moonplants_ml/artifacts/models/amount_model.pkl")

try:
    import lightgbm as lgb

    print("=== TRAJECTORY MODEL feature importance (gain) ===")
    imp = traj._model.feature_importance(importance_type="gain")
    names = traj.feature_cols
    fi = sorted(zip(names, imp), key=lambda x: -x[1])
    for name, val in fi[:20]:
        bar = "#" * int(val / max(imp) * 40)
        print(f"  {name:45s} {val:10.1f}  {bar}")

    print()
    print("=== TTE MODEL feature importance (gain) ===")
    imp2 = tte._model.feature_importance(importance_type="gain")
    names2 = tte.feature_cols
    fi2 = sorted(zip(names2, imp2), key=lambda x: -x[1])
    for name, val in fi2[:20]:
        bar = "#" * int(val / max(imp2) * 40)
        print(f"  {name:45s} {val:10.1f}  {bar}")

    print()
    print("=== AMOUNT MODEL feature importance (gain) ===")
    imp3 = amt._model.feature_importance(importance_type="gain")
    names3 = amt.feature_cols
    fi3 = sorted(zip(names3, imp3), key=lambda x: -x[1])
    for name, val in fi3[:20]:
        bar = "#" * int(val / max(imp3) * 40)
        print(f"  {name:45s} {val:10.1f}  {bar}")

except Exception as e:
    print("LightGBM not available:", e)

print()
print("=== MODEL METADATA ===")
print(f"TrajectoryModel features: {len(traj.feature_cols)}")
print(f"  best_iteration: {traj._model.best_iteration}")
print(f"  per_plant_biases: { {k: round(v,4) for k,v in traj._per_plant_bias.items()} }")
print()
print(f"TimeToEventModel features: {len(tte.feature_cols)}")
print(f"  best_iteration: {tte._model.best_iteration}")
print(f"  per_plant_biases: { {k: round(v,2) for k,v in tte._per_plant_bias.items()} }")
print()
print(f"AmountModel features: {len(amt.feature_cols)}")
print(f"  best_iteration: {amt._model.best_iteration}")
print(f"  per_plant_biases: { {k: round(v,1) for k,v in amt._per_plant_bias.items()} }")

