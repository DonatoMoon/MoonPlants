import sys
sys.path.insert(0, "D:/Web/MoonPlants/moonplants_ml/src")
import pandas as pd
import numpy as np

readings = pd.read_csv("D:/Web/MoonPlants/moonplants_ml/data/readings_10min_jan2026.csv", parse_dates=["timestamp_utc"])
events   = pd.read_csv("D:/Web/MoonPlants/moonplants_ml/data/watering_events.csv", parse_dates=["timestamp_utc"])
plants   = pd.read_csv("D:/Web/MoonPlants/moonplants_ml/data/plant_instances.csv")
species  = pd.read_csv("D:/Web/MoonPlants/moonplants_ml/data/species.csv")
feat     = pd.read_parquet("D:/Web/MoonPlants/moonplants_ml/artifacts/features_cache.parquet")

print("=== DATASET STATS ===")
print("Readings:", len(readings), "rows,", readings.plant_instance_id.nunique(), "plants")
ts_min = readings.timestamp_utc.min()
ts_max = readings.timestamp_utc.max()
days = (pd.to_datetime(ts_max) - pd.to_datetime(ts_min)).days
print("Date span:", ts_min, "->", ts_max)
print("Days covered:", days)
print("Expected readings/plant:", days*24*6, "| Actual:", len(readings)//readings.plant_instance_id.nunique())

print("\n=== WATERING EVENTS PER PLANT ===")
ev_counts = events.groupby("plant_instance_id").agg(
    n_events=("amount_ml","count"),
    mean_amount=("amount_ml","mean"),
    std_amount=("amount_ml","std"),
    mean_moisture_before=("moisture_before","mean"),
    mean_moisture_after=("moisture_after","mean"),
).round(2)
print(ev_counts.to_string())

print("\n=== INTER-EVENT INTERVALS (hours) ===")
for pid, grp in events.groupby("plant_instance_id"):
    ts = grp.timestamp_utc.sort_values()
    if len(ts) > 1:
        diffs = ts.diff().dropna().dt.total_seconds()/3600
        print("  Plant", pid, "| events:", len(ts),
              "| mean:", round(diffs.mean(),1),
              "| std:", round(diffs.std(),1),
              "| min:", round(diffs.min(),1),
              "| max:", round(diffs.max(),1), "h")

print("\n=== MOISTURE STATS PER PLANT ===")
for pid, grp in readings.groupby("plant_instance_id"):
    sm = grp.soil_moisture
    print("  Plant", pid, "| mean:", round(sm.mean(),3),
          "| std:", round(sm.std(),3),
          "| min:", round(sm.min(),3),
          "| max:", round(sm.max(),3))

print("\n=== TTE DISTRIBUTION ===")
tte = feat["hours_to_next_watering"].dropna()
print("TTE valid rows:", len(tte), "/", len(feat), "(", round(100*len(tte)/len(feat),1), "%)")
print("TTE mean:", round(tte.mean(),1), "h | median:", round(tte.median(),1),
      "h | std:", round(tte.std(),1), "h")
print("TTE min:", round(tte.min(),1), "| max:", round(tte.max(),1), "h")
pct = np.percentile(tte, [10,25,50,75,90])
print("Percentiles 10/25/50/75/90:", [round(p,1) for p in pct])

print("\n=== TRAJECTORY TARGET DISTRIBUTION ===")
traj = feat["moisture_at_horizon"].dropna()
print("Trajectory valid rows:", len(traj), "/", len(feat))
print("moisture@horizon mean:", round(traj.mean(),3),
      "| std:", round(traj.std(),3),
      "| min:", round(traj.min(),3),
      "| max:", round(traj.max(),3))

print("\n=== TRAIN/VAL/TEST SPLIT SIZES ===")
feat_sorted = feat.sort_values("timestamp_utc")
n = len(feat_sorted)
n_train = int(n * 0.70)
n_val   = int(n * 0.15)
train = feat_sorted.iloc[:n_train]
val   = feat_sorted.iloc[n_train:n_train+n_val]
test  = feat_sorted.iloc[n_train+n_val:]
print("Train:", len(train), "| Val:", len(val), "| Test:", len(test))
print("Train period:", str(train.timestamp_utc.min())[:16], "->", str(train.timestamp_utc.max())[:16])
print("Val   period:", str(val.timestamp_utc.min())[:16],   "->", str(val.timestamp_utc.max())[:16])
print("Test  period:", str(test.timestamp_utc.min())[:16],  "->", str(test.timestamp_utc.max())[:16])

# TTE in test set
test_tte = test["hours_to_next_watering"].dropna()
print("\nTTE in TEST set:", len(test_tte), "rows")
print("TTE test mean:", round(test_tte.mean(),1), "h | std:", round(test_tte.std(),1), "h")

# Amount events in test period
test_events = events[events.timestamp_utc >= val.timestamp_utc.max()]
print("\nWatering events in TEST period:", len(test_events))
print("Amount test mean:", round(test_events.amount_ml.mean(),1) if len(test_events) else "N/A", "ml")

print("\n=== FEATURE IMPORTANCE PROXY (correlation with TTE) ===")
numeric_feat = feat.select_dtypes(include=[np.number])
tte_corr = numeric_feat.corrwith(feat["hours_to_next_watering"]).dropna()
tte_corr_abs = tte_corr.abs().sort_values(ascending=False)
print("Top 15 features correlated with TTE:")
print(tte_corr_abs.head(15).to_string())

