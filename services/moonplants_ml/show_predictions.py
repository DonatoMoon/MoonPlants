"""
Show concrete model predictions across all 9 plants at multiple timestamps.
Displays: current state, what each model predicts, when to water, how much.
"""
import sys, json, subprocess
sys.path.insert(0, "D:/Web/MoonPlants/moonplants_ml/src")

import pandas as pd
import numpy as np

# Load raw data to show actual moisture at predicted watering time
readings = pd.read_csv(
    "D:/Web/MoonPlants/moonplants_ml/data/readings_10min.csv",
    parse_dates=["timestamp_utc"]
)
readings["timestamp_utc"] = pd.to_datetime(readings["timestamp_utc"], utc=True)
events = pd.read_csv(
    "D:/Web/MoonPlants/moonplants_ml/data/watering_events.csv",
    parse_dates=["timestamp_utc"]
)
events["timestamp_utc"] = pd.to_datetime(events["timestamp_utc"], utc=True)

SPECIES = {728: "Aloe", 2961: "Ficus", 1220: "Begonia"}
PLANTS = {
    1: (728,  "small",  "aloe_01"),
    2: (728,  "medium", "aloe_02"),
    3: (728,  "large",  "aloe_03"),
    4: (2961, "small",  "ficus_01"),
    5: (2961, "medium", "ficus_02"),
    6: (2961, "large",  "ficus_03"),
    7: (1220, "small",  "begonia_01"),
    8: (1220, "medium", "begonia_02"),
    9: (1220, "large",  "begonia_03"),
}

# Pick 3 timestamps per plant: just after watering, mid-drying, near threshold
def get_test_timestamps(pid):
    """Return 3 interesting timestamps for this plant in test period (Jul 4-31)."""
    plant_events = events[
        (events["plant_instance_id"] == pid) &
        (events["timestamp_utc"] >= pd.Timestamp("2026-07-04", tz="UTC"))
    ].sort_values("timestamp_utc")

    plant_reads = readings[
        (readings["plant_instance_id"] == pid) &
        (readings["timestamp_utc"] >= pd.Timestamp("2026-07-05", tz="UTC")) &
        (readings["timestamp_utc"] <= pd.Timestamp("2026-07-29", tz="UTC"))
    ].sort_values("timestamp_utc")

    if plant_reads.empty:
        return []

    ts_list = []

    # 1. Just after a watering — moisture should be HIGH
    if not plant_events.empty:
        ev_ts = plant_events.iloc[0]["timestamp_utc"]
        # 2h after watering
        after_ts = ev_ts + pd.Timedelta(hours=2)
        mask = plant_reads["timestamp_utc"] >= after_ts
        if mask.any():
            ts_list.append(plant_reads[mask].iloc[0]["timestamp_utc"])

    # 2. Midpoint between two events — moisture MEDIUM, drying
    if len(plant_events) >= 2:
        t1 = plant_events.iloc[0]["timestamp_utc"]
        t2 = plant_events.iloc[1]["timestamp_utc"]
        mid = t1 + (t2 - t1) / 2
        mask = (plant_reads["timestamp_utc"] >= mid - pd.Timedelta(hours=1)) & \
               (plant_reads["timestamp_utc"] <= mid + pd.Timedelta(hours=1))
        if mask.any():
            ts_list.append(plant_reads[mask].iloc[0]["timestamp_utc"])
    elif len(ts_list) > 0:
        # fallback: 30% into series
        idx = len(plant_reads) // 3
        ts_list.append(plant_reads.iloc[idx]["timestamp_utc"])

    # 3. Just BEFORE a watering — moisture LOW (near threshold)
    if not plant_events.empty:
        ev_ts = plant_events.iloc[-1]["timestamp_utc"] if len(plant_events) > 1 \
                else plant_events.iloc[0]["timestamp_utc"]
        before_ts = ev_ts - pd.Timedelta(hours=3)
        mask = (plant_reads["timestamp_utc"] >= before_ts - pd.Timedelta(hours=1)) & \
               (plant_reads["timestamp_utc"] <= before_ts)
        if mask.any():
            row = plant_reads[mask].iloc[-1]
            ts_list.append(row["timestamp_utc"])

    # deduplicate
    seen = set()
    out = []
    for ts in ts_list:
        key = str(ts)[:16]
        if key not in seen:
            seen.add(key)
            out.append(ts)
    return out[:3]


def run_predict(pid, ts):
    ts_str = ts.strftime("%Y-%m-%dT%H:%M:%S+00:00")
    r = subprocess.run(
        [sys.executable, "-m", "pipelines.predict",
         "--plant_instance_id", str(pid), "--now", ts_str],
        cwd="D:/Web/MoonPlants/moonplants_ml/src",
        capture_output=True, text=True
    )
    try:
        return json.loads(r.stdout.strip())
    except:
        return None


def get_actual_moisture(pid, ts):
    """Get the actual soil_moisture at timestamp."""
    mask = (readings["plant_instance_id"] == pid) & \
           (readings["timestamp_utc"] == ts)
    row = readings[mask]
    if row.empty:
        # nearest
        plant_r = readings[readings["plant_instance_id"] == pid]
        idx = (plant_r["timestamp_utc"] - ts).abs().idxmin()
        return float(plant_r.loc[idx, "soil_moisture"])
    return float(row.iloc[0]["soil_moisture"])


def get_next_actual_event(pid, ts):
    """Find next actual watering event after ts."""
    fut = events[
        (events["plant_instance_id"] == pid) &
        (events["timestamp_utc"] > ts)
    ].sort_values("timestamp_utc")
    if fut.empty:
        return None, None
    ev = fut.iloc[0]
    actual_hours = (ev["timestamp_utc"] - ts).total_seconds() / 3600
    return actual_hours, float(ev["amount_ml"])


print("=" * 90)
print("MOONPLANTS ML — CONCRETE PREDICTION EXAMPLES")
print("=" * 90)

for pid in range(1, 10):
    sid, size, name = PLANTS[pid]
    species_name = SPECIES[sid]
    print(f"\n{'─'*90}")
    print(f"PLANT {pid}  |  {species_name} ({size})  |  {name}")
    print(f"{'─'*90}")

    timestamps = get_test_timestamps(pid)
    if not timestamps:
        print("  No test timestamps available")
        continue

    for i, ts in enumerate(timestamps):
        actual_moisture = get_actual_moisture(pid, ts)
        actual_next_hours, actual_amount = get_next_actual_event(pid, ts)

        result = run_predict(pid, ts)
        if result is None:
            print(f"  [{i+1}] {ts} — inference failed")
            continue

        # Determine scenario label
        m = actual_moisture
        threshold = result["low_threshold"]
        if m > 0.60:
            scenario = "ПІСЛЯ ПОЛИВУ (волого)"
        elif m > threshold + 0.10:
            scenario = "ВИСИХАЄ (середньо)"
        else:
            scenario = "БЛИЗЬКО ДО ПОРОГУ (сухо)"

        print(f"\n  [{i+1}] {ts.strftime('%Y-%m-%d %H:%M')} UTC  —  {scenario}")
        print(f"       {'Поточна вологість:':<30} {actual_moisture:.3f}  "
              f"(поріг={result['low_threshold']}, ціль={result['high_target']})")
        print(f"       {'Прогноз вологості @+72h:':<30} {result['trajectory_pred_moisture_at_horizon']:.3f}")
        print()
        print(f"       ── Trajectory model ──")
        if result["trajectory_hours"] is not None:
            print(f"       {'Час до поливу (Traj):':<30} {result['trajectory_hours']:.1f} год")
        else:
            print(f"       {'Час до поливу (Traj):':<30} > 72h (не перетинає поріг у горизонті)")
        print()
        print(f"       ── TTE model ──")
        print(f"       {'Час до поливу (TTE):':<30} {result['tte_pred_hours']:.1f} год")
        print()
        print(f"       ── Ensemble ──")
        print(f"       {'ПРОГНОЗ: час до поливу:':<30} {result['time_to_water_hours']:.1f} год  "
              f"(={result['time_to_water_hours']/24:.1f} дні)")
        print(f"       {'ПРОГНОЗ: рекоменд. мл:':<30} {result['recommended_ml']:.0f} мл")
        print(f"       {'Впевненість:':<30} {result['confidence'].upper()}")
        print()

        # Compare with ground truth
        if actual_next_hours is not None:
            error_h = result["time_to_water_hours"] - actual_next_hours
            print(f"       ── Порівняння з фактом ──")
            print(f"       {'Факт: наступний полив через:':<30} {actual_next_hours:.1f} год  "
                  f"(={actual_next_hours/24:.1f} дні)")
            print(f"       {'Факт: обсяг поливу:':<30} {actual_amount:.0f} мл")
            print(f"       {'Похибка по часу:':<30} {error_h:+.1f} год  "
                  f"({'✓ влучив у ±12h' if abs(error_h) <= 12 else '✗ промах > 12h'})")
            if actual_amount:
                err_ml = result["recommended_ml"] - actual_amount
                print(f"       {'Похибка по обсягу:':<30} {err_ml:+.0f} мл  "
                      f"({abs(err_ml)/actual_amount*100:.1f}%)")
        else:
            print(f"       (немає наступної події у test-period для порівняння)")

print(f"\n{'='*90}")
print("SUMMARY: Test period = Jul 4–31, 2026")
print(f"  TTE model:       MAE = 5.94h,  hit_rate±12h = 85.8%")
print(f"  Trajectory:      MAE = 0.039 moisture units (RMSE = 0.068)")
print(f"  Amount model:    MAE = 103.8 ml, MAPE = 6.8%")
print(f"{'='*90}")

