# 🤖 Технічна специфікація IoT інтеграції MoonPlants

**Для розробника IoT частини**

---

## 📡 Огляд архітектури

```
┌──────────────────┐
│  ESP32 + Sensors │
│   + Water Pump   │
└────────┬─────────┘
         │ HTTP/HTTPS
         ↓
┌──────────────────────┐
│  Next.js API Routes  │
│  /api/iot/*          │
└────────┬─────────────┘
         │
         ↓
┌──────────────────────┐
│  Supabase PostgreSQL │
│  - measurements      │
│  - watering_commands │
│  - iot_devices       │
└──────────────────────┘
```

---

## 🔌 API Endpoints

### 1. POST `/api/iot/measurements`

**Призначення:** Відправка даних з датчиків на сервер

**Headers:**
```
Content-Type: application/json
X-Device-Key: {ваш_унікальний_ключ}
```

**Request Body:**
```json
{
  "device_id": "ESP_ABC123",
  "plant_id": "550e8400-e29b-41d4-a716-446655440000",
  "measurements": {
    "soil_moisture": 45.2,
    "air_temp": 22.5,
    "air_humidity": 60.0,
    "light": 1200
  },
  "timestamp": "2026-02-17T10:30:00Z"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Measurements saved",
  "measurement_id": "650e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Unauthorized device"
}
```

**HTTP Status Codes:**
- 200: OK
- 401: Unauthorized (невірний device key)
- 400: Bad Request (некоректні дані)
- 500: Server Error

**Частота відправки:** Рекомендовано кожні 5-15 хвилин

---

### 2. GET `/api/iot/commands`

**Призначення:** Отримання команд для виконання (полив)

**Headers:**
```
X-Device-Key: {ваш_унікальний_ключ}
```

**Query Parameters:**
```
?device_id=ESP_ABC123
```

**Response (є команда):**
```json
{
  "has_commands": true,
  "commands": [
    {
      "command_id": "750e8400-e29b-41d4-a716-446655440000",
      "type": "water",
      "plant_id": "550e8400-e29b-41d4-a716-446655440000",
      "params": {
        "water_amount_ml": 200,
        "duration_seconds": 10
      },
      "scheduled_at": "2026-02-17T10:35:00Z"
    }
  ]
}
```

**Response (немає команд):**
```json
{
  "has_commands": false,
  "commands": []
}
```

**Частота перевірки:** Кожні 30-60 секунд (або за потреби)

---

### 3. POST `/api/iot/commands/{command_id}/status`

**Призначення:** Повідомлення про виконання команди

**Headers:**
```
Content-Type: application/json
X-Device-Key: {ваш_унікальний_ключ}
```

**Request Body:**
```json
{
  "status": "completed",
  "executed_at": "2026-02-17T10:35:15Z",
  "actual_amount_ml": 200,
  "notes": "Watering successful"
}
```

**Можливі статуси:**
- `completed` - успішно виконано
- `failed` - не вдалося виконати
- `partial` - виконано частково

**Response:**
```json
{
  "success": true,
  "message": "Status updated"
}
```

---

### 4. POST `/api/iot/devices/register`

**Призначення:** Реєстрація нового ESP пристрою (при першому запуску)

**Headers:**
```
Content-Type: application/json
X-Setup-Token: {тимчасовий_токен_з_QR_коду}
```

**Request Body:**
```json
{
  "device_id": "ESP_ABC123",
  "firmware_version": "1.0.0",
  "mac_address": "AA:BB:CC:DD:EE:FF"
}
```

**Response:**
```json
{
  "success": true,
  "device_key": "sk-dev-xxxxxxxxxxxxxxxxxxxx",
  "plant_id": "550e8400-e29b-41d4-a716-446655440000",
  "config": {
    "measurement_interval_seconds": 300,
    "command_check_interval_seconds": 60
  }
}
```

---

## 🔐 Аутентифікація

### Device Key

Кожен ESP пристрій має унікальний `device_key`, який:
- Генерується при реєстрації пристрою
- Зберігається в EEPROM/Flash ESP
- Відправляється в заголовку `X-Device-Key` при кожному запиті
- Формат: `sk-dev-{32_символа}`

**Приклад:**
```
X-Device-Key: sk-dev-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Безпека

1. **HTTPS обов'язково** - всі запити тільки через HTTPS
2. **Не зберігайте ключі в коді** - тільки в захищеній пам'яті
3. **Перевірка SSL сертифікатів** - увімкніть в ESP

---

## 📊 Формат даних датчиків

### Soil Moisture (Вологість ґрунту)
- **Тип:** float
- **Діапазон:** 0.0 - 100.0
- **Одиниці:** проценти (%)
- **Калібрування:**
  - 0% - повністю сухий ґрунт
  - 100% - повністю насичений водою
  - Оптимальний діапазон для більшості рослин: 40-60%

**Приклад калібрування резистивного датчика:**
```cpp
int sensorValue = analogRead(MOISTURE_PIN);
// Сухий грунт: ~1023 (3.3V)
// Мокрий грунт: ~300 (1V)
float moisture = map(sensorValue, 1023, 300, 0, 100);
moisture = constrain(moisture, 0, 100);
```

### Air Temperature (Температура повітря)
- **Тип:** float
- **Діапазон:** -20.0 - 50.0
- **Одиниці:** градуси Цельсія (°C)
- **Точність:** ±0.5°C

**Приклад для DHT22:**
```cpp
float temp = dht.readTemperature();
if (isnan(temp)) {
  temp = -999; // значення помилки
}
```

### Air Humidity (Вологість повітря)
- **Тип:** float
- **Діапазон:** 0.0 - 100.0
- **Одиниці:** проценти (%)
- **Точність:** ±2%

### Light (Освітлення)
- **Тип:** float
- **Діапазон:** 0.0 - 100000.0
- **Одиниці:** люкси (lx)
- **Референсні значення:**
  - 0-50 lx: темрява
  - 50-500 lx: низьке освітлення
  - 500-10000 lx: денне освітлення в приміщенні
  - 10000-100000 lx: пряме сонячне світло

**Приклад для BH1750:**
```cpp
float lux = lightMeter.readLightLevel();
if (lux < 0) lux = 0;
```

---

## 💧 Керування помпою

### Калібрування помпи

**Необхідно визначити:**
1. Продуктивність помпи: X мл/секунду
2. Мінімальний час роботи: Y секунд
3. Максимальний час роботи: Z секунд (захист від переливу)

**Приклад калібрування:**
```cpp
// 1. Запустити помпу на 10 секунд
// 2. Виміряти скільки мл води вилилось
// 3. Обчислити мл/сек

const float PUMP_ML_PER_SECOND = 20.0; // приклад: 20мл/сек

int calculatePumpDuration(int targetMl) {
  return (int)(targetMl / PUMP_ML_PER_SECOND);
}
```

### Безпека при поливі

```cpp
const int MAX_WATERING_DURATION_MS = 30000; // 30 сек макс
const int MIN_INTERVAL_BETWEEN_WATERING_MS = 3600000; // 1 година

unsigned long lastWateringTime = 0;

bool canWater() {
  return (millis() - lastWateringTime) > MIN_INTERVAL_BETWEEN_WATERING_MS;
}

void waterPlant(int amountMl) {
  if (!canWater()) {
    Serial.println("Too soon to water again!");
    return;
  }
  
  int duration = calculatePumpDuration(amountMl);
  duration = min(duration, MAX_WATERING_DURATION_MS);
  
  Serial.printf("Watering: %dml for %dms\n", amountMl, duration);
  
  digitalWrite(PUMP_PIN, HIGH);
  delay(duration);
  digitalWrite(PUMP_PIN, LOW);
  
  lastWateringTime = millis();
}
```

---

## 🔧 Приклад коду для ESP32

### Основний файл (main.cpp)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// API config
const char* apiUrl = "https://yourdomain.com/api/iot";
const char* deviceKey = "sk-dev-xxxxxxxxx";
const char* deviceId = "ESP_ABC123";
const char* plantId = "550e8400-e29b-41d4-a716-446655440000";

// Pins
#define DHT_PIN 4
#define MOISTURE_PIN 34
#define LIGHT_PIN 35
#define PUMP_PIN 5

// Sensors
DHT dht(DHT_PIN, DHT22);

// Timing
unsigned long lastMeasurementTime = 0;
unsigned long lastCommandCheckTime = 0;
const unsigned long MEASUREMENT_INTERVAL = 300000; // 5 хвилин
const unsigned long COMMAND_CHECK_INTERVAL = 60000; // 1 хвилина

void setup() {
  Serial.begin(115200);
  
  // Налаштування пінів
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);
  
  // Підключення до WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  
  // Ініціалізація датчиків
  dht.begin();
}

void loop() {
  unsigned long currentTime = millis();
  
  // Відправка вимірів
  if (currentTime - lastMeasurementTime >= MEASUREMENT_INTERVAL) {
    sendMeasurements();
    lastMeasurementTime = currentTime;
  }
  
  // Перевірка команд
  if (currentTime - lastCommandCheckTime >= COMMAND_CHECK_INTERVAL) {
    checkCommands();
    lastCommandCheckTime = currentTime;
  }
  
  delay(100);
}

// Читання датчиків
float readSoilMoisture() {
  int raw = analogRead(MOISTURE_PIN);
  // Калібрування під ваш датчик
  float moisture = map(raw, 4095, 1000, 0, 100); // для 12-bit ADC
  return constrain(moisture, 0, 100);
}

float readLight() {
  int raw = analogRead(LIGHT_PIN);
  // Простий mapping (краще використовувати BH1750)
  float lux = map(raw, 0, 4095, 0, 10000);
  return lux;
}

// Відправка даних
void sendMeasurements() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected!");
    return;
  }
  
  // Читання датчиків
  float soilMoisture = readSoilMoisture();
  float airTemp = dht.readTemperature();
  float airHumidity = dht.readHumidity();
  float light = readLight();
  
  // Перевірка помилок
  if (isnan(airTemp) || isnan(airHumidity)) {
    Serial.println("DHT sensor error!");
    return;
  }
  
  // Формування JSON
  StaticJsonDocument<512> doc;
  doc["device_id"] = deviceId;
  doc["plant_id"] = plantId;
  
  JsonObject measurements = doc.createNestedObject("measurements");
  measurements["soil_moisture"] = soilMoisture;
  measurements["air_temp"] = airTemp;
  measurements["air_humidity"] = airHumidity;
  measurements["light"] = light;
  
  doc["timestamp"] = ""; // ESP може не мати RTC, сервер поставить свій timestamp
  
  String payload;
  serializeJson(doc, payload);
  
  // HTTP запит
  HTTPClient http;
  String url = String(apiUrl) + "/measurements";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", deviceKey);
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    Serial.println("Measurements sent successfully!");
  } else {
    Serial.printf("Error sending measurements: %d\n", httpCode);
    Serial.println(http.getString());
  }
  
  http.end();
}

// Перевірка команд
void checkCommands() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(apiUrl) + "/commands?device_id=" + deviceId;
  http.begin(url);
  http.addHeader("X-Device-Key", deviceKey);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    
    StaticJsonDocument<1024> doc;
    deserializeJson(doc, response);
    
    bool hasCommands = doc["has_commands"];
    
    if (hasCommands) {
      JsonArray commands = doc["commands"];
      
      for (JsonObject cmd : commands) {
        String commandId = cmd["command_id"];
        String type = cmd["type"];
        
        if (type == "water") {
          int waterAmount = cmd["params"]["water_amount_ml"];
          executeWateringCommand(commandId, waterAmount);
        }
      }
    }
  }
  
  http.end();
}

// Виконання поливу
void executeWateringCommand(String commandId, int amountMl) {
  Serial.printf("Executing watering: %dml\n", amountMl);
  
  // Калібрування: 20мл/сек
  const float ML_PER_SECOND = 20.0;
  int durationMs = (int)((amountMl / ML_PER_SECOND) * 1000);
  
  // Захист від переливу
  durationMs = min(durationMs, 30000); // макс 30 сек
  
  // Включити помпу
  digitalWrite(PUMP_PIN, HIGH);
  delay(durationMs);
  digitalWrite(PUMP_PIN, LOW);
  
  Serial.println("Watering completed!");
  
  // Відправити статус
  reportCommandStatus(commandId, "completed", amountMl);
}

// Звіт про виконання
void reportCommandStatus(String commandId, String status, int actualAmount) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  StaticJsonDocument<256> doc;
  doc["status"] = status;
  doc["executed_at"] = ""; // сервер визначить
  doc["actual_amount_ml"] = actualAmount;
  doc["notes"] = "OK";
  
  String payload;
  serializeJson(doc, payload);
  
  HTTPClient http;
  String url = String(apiUrl) + "/commands/" + commandId + "/status";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", deviceKey);
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    Serial.println("Status reported successfully!");
  }
  
  http.end();
}
```

### Конфігурація WiFi через Access Point

```cpp
#include <WiFiManager.h>

void setupWiFi() {
  WiFiManager wm;
  
  // Додати кастомні параметри
  WiFiManagerParameter custom_device_key("device_key", "Device Key", "", 50);
  WiFiManagerParameter custom_plant_id("plant_id", "Plant ID", "", 50);
  
  wm.addParameter(&custom_device_key);
  wm.addParameter(&custom_plant_id);
  
  // Запуск AP режиму якщо не може підключитись
  if (!wm.autoConnect("MoonPlants-Setup")) {
    Serial.println("Failed to connect");
    ESP.restart();
  }
  
  // Зберегти параметри в EEPROM
  strcpy(deviceKey, custom_device_key.getValue());
  strcpy(plantId, custom_plant_id.getValue());
  saveConfig();
}
```

---

## 🧪 Тестування

### Локальне тестування

1. **Mock server для розробки:**

```javascript
// test-server.js (Node.js)
const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/iot/measurements', (req, res) => {
  console.log('Received measurements:', req.body);
  res.json({ success: true });
});

app.get('/api/iot/commands', (req, res) => {
  // Симулювати команду поливу
  const shouldWater = Math.random() > 0.8;
  
  if (shouldWater) {
    res.json({
      has_commands: true,
      commands: [{
        command_id: 'test-123',
        type: 'water',
        params: { water_amount_ml: 100 }
      }]
    });
  } else {
    res.json({ has_commands: false, commands: [] });
  }
});

app.listen(3001, () => console.log('Test server on :3001'));
```

2. **Тестування без ESP:**

```bash
curl -X POST http://localhost:3000/api/iot/measurements \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: test-key" \
  -d '{
    "device_id": "TEST_ESP",
    "plant_id": "test-plant-id",
    "measurements": {
      "soil_moisture": 45,
      "air_temp": 22,
      "air_humidity": 60,
      "light": 800
    }
  }'
```

---

## 📚 Бібліотеки для ESP32

### Необхідні бібліотеки (Arduino IDE)

```cpp
// platformio.ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino

lib_deps = 
    adafruit/DHT sensor library@^1.4.4
    bblanchon/ArduinoJson@^6.21.3
    claws/BH1750@^1.3.0
    tzapu/WiFiManager@^2.0.16-rc.2
```

### Arduino IDE Library Manager:
1. DHT sensor library
2. ArduinoJson
3. BH1750 (якщо використовуєте цей датчик світла)
4. WiFiManager

---

## 🚨 Обробка помилок

### Типові помилки та рішення

| Помилка | Причина | Рішення |
|---------|---------|---------|
| WiFi disconnected | Слабкий сигнал | Додати reconnect логіку |
| HTTP timeout | Сервер не відповідає | Збільшити timeout, retry |
| Sensor read error | Датчик не підключений | Перевірити підключення, повернути -999 |
| Pump not responding | Проблема з реле | Перевірити проводку, додати feedback |

### Код для відновлення WiFi:

```cpp
void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost, reconnecting...");
    WiFi.disconnect();
    WiFi.begin(ssid, password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nReconnected!");
    } else {
      Serial.println("\nReconnect failed, restarting...");
      ESP.restart();
    }
  }
}
```

---

## 📝 Checklist для запуску

### Перед розгортанням:

- [ ] WiFi credentials налаштовані
- [ ] Device Key отриманий з сервера
- [ ] Plant ID прив'язаний до пристрою
- [ ] Всі датчики підключені та протестовані
- [ ] Помпа калібрована (мл/сек)
- [ ] Захист від переливу активований
- [ ] HTTPS сертифікат перевірений
- [ ] Fallback поведінка при відсутності з'єднання
- [ ] Логування налаштоване (Serial)
- [ ] Over-the-Air (OTA) update готовий (опціонально)

---

## 🔄 Діаграма послідовності

```
ESP32                   API Server              Database
  |                          |                      |
  |--POST /measurements----->|                      |
  |                          |--INSERT measurements>|
  |<-----200 OK--------------|                      |
  |                          |                      |
  |--GET /commands---------->|                      |
  |                          |--SELECT commands---->|
  |<-----{water: 200ml}------|                      |
  |                          |                      |
  [Execute watering]         |                      |
  |                          |                      |
  |--POST /commands/123----->|                      |
  |  /status {completed}     |                      |
  |                          |--UPDATE command----->|
  |<-----200 OK--------------|                      |
```

---

## 📞 Контакти для підтримки

Якщо виникають питання:
1. Перевірте логи ESP через Serial Monitor
2. Перевірте логи сервера (Vercel logs)
3. Використайте Postman для тестування API
4. GitHub Issues для багів

---

**Дата створення:** 17.02.2026  
**Версія:** 1.0  
**Статус:** Draft - готово до імплементації

