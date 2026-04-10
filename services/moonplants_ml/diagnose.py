"""Diagnose the core TTE leakage/collapse issue."""
import sys
sys.path.insert(0, "D:/Web/MoonPlants/moonplants_ml/src")
import pandas as pd
import numpy as np

events = pd.read_csv("D:/Web/MoonPlants/moonplants_ml/data/watering_events.csv", parse_dates=["timestamp_utc"])
feat   = pd.read_parquet("D:/Web/MoonPlants/moonplants_ml/artifacts/features_cache.parquet")

print("=== PROBLEM DIAGNOSIS ===\n")

# 1. True TTE range
print("1. TRUE TTE range across ALL plants:")
for pid, grp in events.groupby("plant_instance_id"):
    ts = grp.timestamp_utc.sort_values()
    if len(ts) > 1:
        diffs_h = ts.diff().dropna().dt.total_seconds()/3600
        print(f"   Plant {pid}: real watering interval = {round(diffs_h.mean(),1)}h "
              f"(~{round(diffs_h.mean()/24,1)} days)")

print()
print("2. TTE TARGET in feature cache (what model actually learned):")
tte = feat["hours_to_next_watering"].dropna()
print(f"   ALL values are between {round(tte.min(),3)} and {round(tte.max(),3)} hours")
print(f"   mean={round(tte.mean(),3)}h  std={round(tte.std(),3)}h")
print(f"   => CRITICAL: max TTE = {round(tte.max(),3)}h !!!")
print()

# 2. Understand why TTE is so small
print("3. WHY IS TTE ~0? Checking event_times vs reading timestamps...")
# The events in the CSV span Jan 2-30. Readings also span Jan 1-31.
# BUT: readings has is_watering_event column too!
readings = pd.read_csv("D:/Web/MoonPlants/moonplants_ml/data/readings_10min_jan2026.csv", parse_dates=["timestamp_utc"])
n_watering_readings = readings["is_watering_event"].sum()
print(f"   Readings with is_watering_event=1: {n_watering_readings}")
print(f"   Watering events in watering_events.csv: {len(events)}")

# Check if readings timestamps exactly match event timestamps
pid1_events = events[events.plant_instance_id==1].timestamp_utc.sort_values().values
pid1_readings = readings[readings.plant_instance_id==1]
print()
print("4. Plant 1 events timestamps:")
for t in pid1_events:
    print(f"   {t}")

print()
print("5. Checking TTE values for plant 1 (first 20 non-NaN):")
p1_feat = feat[feat.plant_instance_id==1][["timestamp_utc","soil_moisture","hours_to_next_watering"]].dropna()
print(p1_feat.head(20).to_string())

print()
print("6. SPLIT timing vs events:")
feat_sorted = feat.sort_values("timestamp_utc")
n = len(feat_sorted)
train_end = feat_sorted.iloc[int(n*0.70)].timestamp_utc
val_end   = feat_sorted.iloc[int(n*0.85)].timestamp_utc
print(f"   Train ends: {str(train_end)[:19]}")
print(f"   Val ends:   {str(val_end)[:19]}")
print(f"   Test starts:{str(val_end)[:19]}")
print()
print("   Events per split window:")
for pid, grp in events.groupby("plant_instance_id"):
    e_test = grp[grp.timestamp_utc > pd.Timestamp(val_end)]
    e_val  = grp[(grp.timestamp_utc > pd.Timestamp(train_end)) & (grp.timestamp_utc <= pd.Timestamp(val_end))]
    e_train= grp[grp.timestamp_utc <= pd.Timestamp(train_end)]
    print(f"   Plant {pid}: train={len(e_train)}, val={len(e_val)}, test={len(e_test)} events")

print()
print("7. TEST SET TTE analysis:")
test_feat = feat_sorted.iloc[int(n*0.85):]
test_tte  = test_feat["hours_to_next_watering"].dropna()
print(f"   Test TTE rows: {len(test_tte)}")
print(f"   Test TTE distribution: {test_tte.describe().round(4).to_dict()}")
if len(test_tte) > 0:
    print(f"   ALL test TTE values (unique): {sorted(test_tte.unique())[:20]}")

