"""Sample predictions to show realistic inference output."""
import sys
sys.path.insert(0, "D:/Web/MoonPlants/moonplants_ml/src")
import subprocess

cases = [
    ("1", "2026-07-10T08:00:00+00:00"),  # aloe, low moisture
    ("4", "2026-07-15T10:00:00+00:00"),  # ficus, medium
    ("7", "2026-07-20T14:00:00+00:00"),  # begonia, high freq
    ("9", "2026-07-25T09:00:00+00:00"),  # begonia large pot
]
for pid, ts in cases:
    r = subprocess.run(
        [sys.executable, "-m", "pipelines.predict",
         "--plant_instance_id", pid, "--now", ts],
        cwd="D:/Web/MoonPlants/moonplants_ml/src",
        capture_output=True, text=True
    )
    import json
    try:
        # extract JSON from stdout
        out = r.stdout.strip()
        obj = json.loads(out)
        print(f"Plant {pid} @ {ts[:10]}:")
        print(f"  current_moisture     = {obj['current_moisture']:.3f}")
        print(f"  time_to_water_hours  = {obj['time_to_water_hours']} h")
        print(f"  recommended_ml       = {obj['recommended_ml']} ml")
        print(f"  confidence           = {obj['confidence']}")
        print(f"  trajectory_pred      = {obj['trajectory_pred_moisture_at_horizon']:.3f} (moisture @ +72h)")
        print(f"  trajectory_hours     = {obj['trajectory_hours']} h")
        print(f"  tte_pred_hours       = {obj['tte_pred_hours']} h")
        print(f"  low_threshold        = {obj['low_threshold']}")
        print(f"  high_target          = {obj['high_target']}")
        print()
    except Exception as e:
        print(f"Plant {pid}: ERROR — {e}")
        print("STDOUT:", r.stdout[:500])
        print("STDERR:", r.stderr[-500:])
        print()

