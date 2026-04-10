import torch
import joblib
import numpy as np
import pandas as pd
from model import WateringLSTM
import os

def predict_next_watering(recent_readings_df, model_path='checkpoints/best_model.pth', scaler_dir='scaler'):
    """
    Здійснює прогноз на основі останніх показань сенсорів.
    recent_readings_df: DataFrame (мінімум 72 останні записи, тобто 12 годин)
    """
    features = ['soil_moisture', 'soil_temperature_c', 'air_temperature_c', 'air_humidity_pct', 'light_lux']
    
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}. Train the model first.")
        
    scaler_X = joblib.load(f'{scaler_dir}/scaler_X.pkl')
    scaler_y = joblib.load(f'{scaler_dir}/scaler_y.pkl')
    
    # Використовуємо лише останні 72 записи (seq_length)
    df_window = recent_readings_df.tail(72)
    
    if len(df_window) < 72:
        raise ValueError(f"Need at least 72 readings, got {len(df_window)}")
        
    X_scaled = scaler_X.transform(df_window[features])
    X_tensor = torch.tensor(X_scaled, dtype=torch.float32).unsqueeze(0) # додаємо batch dimension
    
    input_dim = len(features)
    model = WateringLSTM(input_dim=input_dim, hidden_dim=64, num_layers=2, output_dim=2)
    model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu'), weights_only=True))
    model.eval()
    
    with torch.no_grad():
        pred_scaled = model(X_tensor).numpy()
        
    pred = scaler_y.inverse_transform(pred_scaled)[0]
    
    hours_to_next = pred[0]
    amount_ml = pred[1]
    
    # Значення не можуть бути від'ємними
    return max(0, hours_to_next), max(0, amount_ml)

if __name__ == '__main__':
    # Демонстрація роботи
    print("Testing prediction with dummy data (simulate 12 hours of drying)...")
    
    dummy_data = pd.DataFrame({
        'soil_moisture': np.linspace(0.6, 0.4, 72),      # вологість падає
        'soil_temperature_c': np.random.normal(22, 1, 72),
        'air_temperature_c': np.random.normal(24, 1, 72),
        'air_humidity_pct': np.random.normal(45, 5, 72),
        'light_lux': np.random.normal(500, 100, 72)
    })
    
    try:
        hrs, amt = predict_next_watering(dummy_data)
        print(f"\n[Prediction]")
        print(f"Time to next watering: {hrs:.1f} hours")
        print(f"Water amount needed:   {amt:.1f} ml")
    except Exception as e:
        print(f"Prediction failed: {e}")
