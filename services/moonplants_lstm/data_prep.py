import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import joblib
import os

def prepare_data(readings_path, events_path, seq_length=72, save_dir='scaler'):
    """
    Завантажує дані, розраховує цільові змінні (час до поливу та об'єм),
    нормалізує їх та створює 3D-тензори для LSTM.
    seq_length=72 означає 72 кроки по 10 хвилин (12 годин історії).
    """
    print("Loading data...")
    readings = pd.read_csv(readings_path)
    events = pd.read_csv(events_path)
    
    readings['timestamp_utc'] = pd.to_datetime(readings['timestamp_utc'], utc=True)
    events['timestamp_utc'] = pd.to_datetime(events['timestamp_utc'], utc=True)
    
    readings = readings.sort_values(['plant_instance_id', 'timestamp_utc']).reset_index(drop=True)
    events = events.sort_values(['plant_instance_id', 'timestamp_utc']).reset_index(drop=True)
    
    print("Calculating targets...")
    # Для кожної рослини шукаємо наступний івент поливу
    targets_hours = []
    targets_amount = []
    
    for pid, grp in readings.groupby('plant_instance_id'):
        plant_events = events[events['plant_instance_id'] == pid]
        if plant_events.empty:
            targets_hours.extend([np.nan] * len(grp))
            targets_amount.extend([np.nan] * len(grp))
            continue
            
        event_times = plant_events['timestamp_utc'].values
        event_amounts = plant_events['amount_ml'].values
        
        ts_array = grp['timestamp_utc'].values
        
        # Знаходимо індекс першого івенту ПІСЛЯ поточного вимірювання
        idx = np.searchsorted(event_times, ts_array, side='right')
        
        valid_mask = idx < len(event_times)
        safe_idx = np.minimum(idx, len(event_times) - 1)
        
        # Різниця в секундах
        delta_s = (event_times[safe_idx].astype("datetime64[s]") - ts_array.astype("datetime64[s]")).astype(np.int64)
        hours = delta_s / 3600.0
        
        # Застосовуємо маску
        hours = np.where(valid_mask, hours, np.nan)
        amounts = np.where(valid_mask, event_amounts[safe_idx], np.nan)
        
        targets_hours.extend(hours)
        targets_amount.extend(amounts)
        
    readings['target_hours'] = targets_hours
    readings['target_amount'] = targets_amount
    
    # Видаляємо рядки, після яких більше немає поливів
    readings = readings.dropna(subset=['target_hours', 'target_amount'])
    
    # Ознаки для моделі
    features = ['soil_moisture', 'soil_temperature_c', 'air_temperature_c', 'air_humidity_pct', 'light_lux']
    
    print("Scaling features...")
    scaler_X = StandardScaler()
    readings[features] = scaler_X.fit_transform(readings[features])
    
    scaler_y = StandardScaler()
    targets = readings[['target_hours', 'target_amount']].values
    readings[['target_hours_scaled', 'target_amount_scaled']] = scaler_y.fit_transform(targets)
    
    os.makedirs(save_dir, exist_ok=True)
    joblib.dump(scaler_X, os.path.join(save_dir, 'scaler_X.pkl'))
    joblib.dump(scaler_y, os.path.join(save_dir, 'scaler_y.pkl'))
    
    print("Creating sequences (sliding windows)...")
    X, y = [], []
    
    for pid, grp in readings.groupby('plant_instance_id'):
        vals = grp[features].values
        targs = grp[['target_hours_scaled', 'target_amount_scaled']].values
        
        # Створюємо вікна розміром seq_length
        for i in range(len(vals) - seq_length):
            X.append(vals[i:i+seq_length])
            # Цільова змінна береться для останнього кроку у вікні
            y.append(targs[i+seq_length-1])
            
    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)
    print(f"Prepared data shape: X={X.shape}, y={y.shape}")
    
    return X, y
