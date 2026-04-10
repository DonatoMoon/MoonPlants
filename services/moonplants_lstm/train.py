import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from sklearn.model_selection import train_test_split
import os

from data_prep import prepare_data
from model import WateringLSTM

def train():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Гіперпараметри
    seq_length = 72 # 12 годин історії (з кроком 10 хв)
    batch_size = 64
    epochs = 20
    learning_rate = 0.001
    
    # Шляхи до даних
    data_dir = '../moonplants_ml/data'
    readings_path = os.path.join(data_dir, 'readings_10min.csv')
    events_path = os.path.join(data_dir, 'watering_events.csv')
    
    # Перевірка наявності даних
    if not os.path.exists(readings_path) or not os.path.exists(events_path):
        print("Data files not found. Please ensure they exist in ../moonplants_ml/data/")
        return
        
    # Підготовка даних
    X, y = prepare_data(readings_path, events_path, seq_length=seq_length)
    
    # Розбиття на train/val
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    
    train_dataset = TensorDataset(torch.tensor(X_train), torch.tensor(y_train))
    val_dataset = TensorDataset(torch.tensor(X_val), torch.tensor(y_val))
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    # Ініціалізація моделі
    input_dim = X.shape[2]
    hidden_dim = 64
    num_layers = 2
    output_dim = 2 # [hours_to_next_watering, amount_ml]
    
    model = WateringLSTM(input_dim, hidden_dim, num_layers, output_dim).to(device)
    
    # Функція втрат та оптимізатор
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    
    best_val_loss = float('inf')
    os.makedirs('checkpoints', exist_ok=True)
    
    print("Starting training loop...")
    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        
        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * batch_X.size(0)
            
        train_loss /= len(train_loader.dataset)
        
        # Validation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for batch_X, batch_y in val_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y)
                val_loss += loss.item() * batch_X.size(0)
                
        val_loss /= len(val_loader.dataset)
        
        print(f"Epoch {epoch+1:02d}/{epochs} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}")
        
        # Збереження найкращої моделі
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), 'checkpoints/best_model.pth')
            print("  --> Saved new best model")

if __name__ == '__main__':
    train()
