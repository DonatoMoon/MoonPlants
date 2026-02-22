# 📡 Інструкція для розробника IoT частини - MoonPlants

**Для розробника, який збирає та програмує ESP контролер**

---

## 🎯 Що потрібно зробити

Ви будете створювати IoT систему на базі ESP32/ESP8266, яка:
1. **Збирає дані з датчиків** і відправляє на сервер
2. **Отримує команди з сервера** для керування помпами та фітолампою
3. **Підтримує декілька рослин** на одному контролері

---

## 🔧 Апаратна частина

### Необхідні компоненти:

**Контролер:**
- ESP32 або ESP8266 (рекомендую ESP32)

**Датчики (загальні для всіх рослин):**
- DHT22 - температура і вологість повітря
- BH1750 - датчик освітлення (lux)

**Датчики для кожної рослини (можна до 4-8 штук):**
- Резистивні датчики вологості ґрунту

**Виконавчі пристрої:**
- Помпи для води (по одній на кожну рослину)
- Реле для керування помпами (можна використати модуль на 4-8 реле)
- Фітолампа + реле для неї
- Резервуар для води (спільний)

**Додатково:**
- Блок живлення 5V/12V (залежно від помп)
- Проводи, макетна плата

---

## 📡 Як працює система

```
┌─────────────────────────────────────────────────────────┐
│                    ESP32 Контролер                      │
│                                                         │
│  Датчики (загальні):          Датчики (для рослин):    │
│  • DHT22 (temp + humidity)    • Soil sensor 1          │
│  • BH1750 (light)             • Soil sensor 2          │
│                               • Soil sensor 3          │
│  Виконавчі:                   • Soil sensor 4          │
│  • Pump 1 (через реле)                                 │
│  • Pump 2 (через реле)        Виконавчі (для рослин):  │
│  • Pump 3 (через реле)        • Реле для помп          │
│  • Фітолампа (через реле)    • Реле для фітолампи     │
└─────────────────────────────────────────────────────────┘
                        │
                        │ WiFi (HTTP/HTTPS)
                        ↓
┌─────────────────────────────────────────────────────────┐
│              Next.js API Server (я роблю)               │
│  • Приймає дані з датчиків                             │
│  • Зберігає в Supabase базу даних                      │
│  • Розраховує коли поливати (AI алгоритм)              │
│  • Відправляє команди на ESP                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🌐 API Endpoints (як спілкуватись з сервером)

Сервер буде на адресі: `https://yourdomain.com` (я вам дам точну адресу)

### 1️⃣ Відправка даних з датчиків на сервер

**Що:** ESP відправляє виміри кожні 5-15 хвилин

**Куди:** `POST https://yourdomain.com/api/iot/measurements`

**Заголовки (Headers):**
```
Content-Type: application/json
X-Device-Key: sk-dev-xxxxxxxxxxxxxxxx
```
*Примітка: Device Key - це унікальний ключ для вашого ESP, я вам його дам при реєстрації*

**Формат даних (JSON):**
```json
{
  "device_id": "ESP_MAIN_001",
  "measurements": [
    {
      "plant_id": "plant-1",
      "soil_moisture": 45.5,
      "soil_sensor_pin": 34
    },
    {
      "plant_id": "plant-2",
      "soil_moisture": 62.3,
      "soil_sensor_pin": 35
    },
    {
      "plant_id": "plant-3",
      "soil_moisture": 38.1,
      "soil_sensor_pin": 36
    }
  ],
  "environment": {
    "air_temp": 22.5,
    "air_humidity": 60.0,
    "light": 1200
  },
  "timestamp": "2026-02-17T10:30:00Z"
}
```

**Пояснення полів:**
- `device_id` - ID вашого контролера (я вам дам)
- `measurements` - масив вимірів для кожної рослини
  - `plant_id` - ID рослини (його користувач призначить через веб)
  - `soil_moisture` - вологість ґрунту в відсотках (0-100)
  - `soil_sensor_pin` - номер піна ESP до якого підключений датчик
- `environment` - загальні виміри для всіх рослин
  - `air_temp` - температура повітря (°C)
  - `air_humidity` - вологість повітря (%)
  - `light` - освітлення (lux)
- `timestamp` - час виміру (можна порожнє, сервер сам поставить)

**Відповідь від сервера (якщо OK):**
```json
{
  "success": true,
  "message": "Measurements saved"
}
```

**Відповідь від сервера (якщо помилка):**
```json
{
  "success": false,
  "error": "Unauthorized device"
}
```

---

### 2️⃣ Отримання команд з сервера

**Що:** ESP перевіряє чи є команди для виконання (полив, фітолампа)

**Куди:** `GET https://yourdomain.com/api/iot/commands?device_id=ESP_MAIN_001`

**Заголовки (Headers):**
```
X-Device-Key: sk-dev-xxxxxxxxxxxxxxxx
```

**Як часто перевіряти:** Кожні 30-60 секунд

**Відповідь від сервера (є команди):**
```json
{
  "has_commands": true,
  "commands": [
    {
      "command_id": "cmd-123",
      "type": "water",
      "plant_id": "plant-1",
      "params": {
        "pump_pin": 5,
        "water_amount_ml": 200,
        "duration_seconds": 10
      }
    },
    {
      "command_id": "cmd-124",
      "type": "light",
      "params": {
        "light_pin": 18,
        "state": "on",
        "duration_minutes": 120
      }
    }
  ]
}
```

**Відповідь від сервера (немає команд):**
```json
{
  "has_commands": false,
  "commands": []
}
```

**Типи команд:**

**A) Команда поливу (`type: "water"`):**
- `plant_id` - ID рослини
- `pump_pin` - номер піна ESP до якого підключена помпа
- `water_amount_ml` - скільки мл води подати
- `duration_seconds` - скільки секунд працювати помпі

**B) Команда фітолампи (`type: "light"`):**
- `light_pin` - номер піна ESP до якого підключена лампа
- `state` - стан ("on" / "off")
- `duration_minutes` - на скільки хвилин увімкнути (якщо "on")

---

### 3️⃣ Відправка статусу виконання команди

**Що:** Після виконання команди, ESP повідомляє сервер

**Куди:** `POST https://yourdomain.com/api/iot/commands/{command_id}/status`

**Заголовки (Headers):**
```
Content-Type: application/json
X-Device-Key: sk-dev-xxxxxxxxxxxxxxxx
```

**Формат даних:**
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
- `failed` - не вдалося виконати (наприклад, помпа не працює)
- `partial` - виконано частково

**Відповідь від сервера:**
```json
{
  "success": true,
  "message": "Status updated"
}
```

---

### 4️⃣ Реєстрація контролера (перший запуск)

**Що:** При першому запуску ESP реєструється на сервері

**Куди:** `POST https://yourdomain.com/api/iot/devices/register`

**Заголовки (Headers):**
```
Content-Type: application/json
X-Setup-Token: {тимчасовий_токен}
```
*Примітка: Setup Token - це одноразовий токен, який користувач отримає у веб-інтерфейсі при додаванні нового контролера*

**Формат даних:**
```json
{
  "device_id": "ESP_MAIN_001",
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "firmware_version": "1.0.0",
  "capabilities": {
    "max_plants": 4,
    "has_light": true,
    "sensor_pins": [34, 35, 36, 39],
    "pump_pins": [5, 18, 19, 21],
    "light_pin": 22
  }
}
```

**Відповідь від сервера:**
```json
{
  "success": true,
  "device_key": "sk-dev-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "config": {
    "measurement_interval_seconds": 300,
    "command_check_interval_seconds": 60
  }
}
```

**Що робити далі:**
- Зберегти `device_key` в EEPROM/Flash пам'ять ESP
- Використовувати цей ключ для всіх наступних запитів

---

### 5️⃣ Повідомлення про список датчиків

**Що:** ESP повідомляє сервер про доступні датчики вологості ґрунту

**Куди:** `POST https://yourdomain.com/api/iot/devices/{device_id}/sensors`

**Формат даних:**
```json
{
  "sensors": [
    {
      "sensor_id": "soil-1",
      "type": "soil_moisture",
      "pin": 34,
      "is_connected": true,
      "current_value": 45.5
    },
    {
      "sensor_id": "soil-2",
      "type": "soil_moisture",
      "pin": 35,
      "is_connected": true,
      "current_value": 62.3
    },
    {
      "sensor_id": "soil-3",
      "type": "soil_moisture",
      "pin": 36,
      "is_connected": false,
      "current_value": null
    }
  ]
}
```

**Коли відправляти:**
- При старті ESP
- Коли змінюється кількість підключених датчиків

---

## 💻 Приклад коду для ESP32

### Основна структура програми:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <BH1750.h>

// ===== КОНФІГУРАЦІЯ =====
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* apiUrl = "https://yourdomain.com/api/iot";
String deviceKey = "sk-dev-xxxx"; // Отримаєте при реєстрації
String deviceId = "ESP_MAIN_001";

// ===== ПІНИ =====
#define DHT_PIN 4
#define DHT_TYPE DHT22

// Піни датчиків вологості ґрунту (можна до 8 штук)
const int soilPins[] = {34, 35, 36, 39};
const int numSoilSensors = 4;

// Піни помп (по одній на кожну рослину)
const int pumpPins[] = {5, 18, 19, 21};

// Пін фітолампи
const int lightPin = 22;

// ===== ДАТЧИКИ =====
DHT dht(DHT_PIN, DHT_TYPE);
BH1750 lightMeter;

// ===== ІНТЕРВАЛИ =====
unsigned long lastMeasurementTime = 0;
unsigned long lastCommandCheckTime = 0;
const unsigned long MEASUREMENT_INTERVAL = 300000; // 5 хвилин
const unsigned long COMMAND_CHECK_INTERVAL = 60000; // 1 хвилина

// ===== ЗБЕРІГАННЯ plant_id для кожного датчика =====
String plantIds[4] = {"", "", "", ""}; // Користувач призначить через веб

void setup() {
  Serial.begin(115200);
  
  // Налаштування пінів помп
  for (int i = 0; i < 4; i++) {
    pinMode(pumpPins[i], OUTPUT);
    digitalWrite(pumpPins[i], LOW);
  }
  
  // Налаштування фітолампи
  pinMode(lightPin, OUTPUT);
  digitalWrite(lightPin, LOW);
  
  // Підключення до WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  
  // Ініціалізація датчиків
  dht.begin();
  Wire.begin();
  lightMeter.begin();
  
  // Завантажити збережені дані (device_key, plant_ids) з EEPROM
  loadConfig();
  
  // Якщо device_key порожній - запустити режим реєстрації
  if (deviceKey == "") {
    registerDevice();
  }
  
  // Повідомити сервер про доступні датчики
  sendSensorsList();
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

// ===== ФУНКЦІЯ: Відправка вимірів =====
void sendMeasurements() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected!");
    return;
  }
  
  // Читання загальних датчиків
  float airTemp = dht.readTemperature();
  float airHumidity = dht.readHumidity();
  float light = lightMeter.readLightLevel();
  
  // Перевірка на помилки
  if (isnan(airTemp) || isnan(airHumidity)) {
    Serial.println("DHT sensor error!");
    return;
  }
  
  // Формування JSON
  DynamicJsonDocument doc(2048);
  doc["device_id"] = deviceId;
  
  // Масив вимірів для кожної рослини
  JsonArray measurements = doc.createNestedArray("measurements");
  
  for (int i = 0; i < numSoilSensors; i++) {
    // Якщо plant_id призначений
    if (plantIds[i] != "") {
      float soilMoisture = readSoilMoisture(soilPins[i]);
      
      JsonObject measurement = measurements.createNestedObject();
      measurement["plant_id"] = plantIds[i];
      measurement["soil_moisture"] = soilMoisture;
      measurement["soil_sensor_pin"] = soilPins[i];
    }
  }
  
  // Загальні виміри
  JsonObject environment = doc.createNestedObject("environment");
  environment["air_temp"] = airTemp;
  environment["air_humidity"] = airHumidity;
  environment["light"] = light;
  
  doc["timestamp"] = "";
  
  String payload;
  serializeJson(doc, payload);
  
  // HTTP POST запит
  HTTPClient http;
  String url = String(apiUrl) + "/measurements";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", deviceKey);
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    Serial.println("✓ Measurements sent successfully!");
  } else {
    Serial.printf("✗ Error sending measurements: %d\n", httpCode);
    Serial.println(http.getString());
  }
  
  http.end();
}

// ===== ФУНКЦІЯ: Читання датчика вологості ґрунту =====
float readSoilMoisture(int pin) {
  int raw = analogRead(pin);
  
  // Калібрування для вашого датчика
  // Виміряйте значення для сухого і мокрого ґрунту
  const int DRY_VALUE = 4095;   // Повністю сухий
  const int WET_VALUE = 1000;   // Повністю мокрий
  
  float moisture = map(raw, DRY_VALUE, WET_VALUE, 0, 100);
  moisture = constrain(moisture, 0, 100);
  
  return moisture;
}

// ===== ФУНКЦІЯ: Перевірка команд =====
void checkCommands() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(apiUrl) + "/commands?device_id=" + deviceId;
  http.begin(url);
  http.addHeader("X-Device-Key", deviceKey);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    
    DynamicJsonDocument doc(2048);
    deserializeJson(doc, response);
    
    bool hasCommands = doc["has_commands"];
    
    if (hasCommands) {
      JsonArray commands = doc["commands"];
      
      for (JsonObject cmd : commands) {
        String commandId = cmd["command_id"];
        String type = cmd["type"];
        
        if (type == "water") {
          executeWaterCommand(cmd);
          reportCommandStatus(commandId, "completed");
        } 
        else if (type == "light") {
          executeLightCommand(cmd);
          reportCommandStatus(commandId, "completed");
        }
      }
    }
  }
  
  http.end();
}

// ===== ФУНКЦІЯ: Виконання поливу =====
void executeWaterCommand(JsonObject cmd) {
  String plantId = cmd["plant_id"];
  int pumpPin = cmd["params"]["pump_pin"];
  int waterAmount = cmd["params"]["water_amount_ml"];
  int duration = cmd["params"]["duration_seconds"];
  
  Serial.printf("💧 Watering plant %s: %d ml\n", plantId.c_str(), waterAmount);
  
  // Включити помпу
  digitalWrite(pumpPin, HIGH);
  delay(duration * 1000); // Перетворити секунди в мілісекунди
  digitalWrite(pumpPin, LOW);
  
  Serial.println("✓ Watering completed!");
}

// ===== ФУНКЦІЯ: Керування фітолампою =====
void executeLightCommand(JsonObject cmd) {
  int lightPin = cmd["params"]["light_pin"];
  String state = cmd["params"]["state"];
  
  if (state == "on") {
    digitalWrite(lightPin, HIGH);
    Serial.println("💡 Light ON");
  } else {
    digitalWrite(lightPin, LOW);
    Serial.println("💡 Light OFF");
  }
}

// ===== ФУНКЦІЯ: Звіт про виконання команди =====
void reportCommandStatus(String commandId, String status) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  DynamicJsonDocument doc(256);
  doc["status"] = status;
  doc["executed_at"] = "";
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
    Serial.println("✓ Status reported!");
  }
  
  http.end();
}

// ===== ФУНКЦІЯ: Відправка списку датчиків =====
void sendSensorsList() {
  DynamicJsonDocument doc(1024);
  JsonArray sensors = doc.createNestedArray("sensors");
  
  for (int i = 0; i < numSoilSensors; i++) {
    JsonObject sensor = sensors.createNestedObject();
    sensor["sensor_id"] = "soil-" + String(i + 1);
    sensor["type"] = "soil_moisture";
    sensor["pin"] = soilPins[i];
    sensor["is_connected"] = true;
    
    float value = readSoilMoisture(soilPins[i]);
    sensor["current_value"] = value;
  }
  
  String payload;
  serializeJson(doc, payload);
  
  HTTPClient http;
  String url = String(apiUrl) + "/devices/" + deviceId + "/sensors";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", deviceKey);
  
  http.POST(payload);
  http.end();
}

// ===== ФУНКЦІЯ: Реєстрація пристрою (перший запуск) =====
void registerDevice() {
  Serial.println("Registering device...");
  
  // Тут можна зробити веб-портал (WiFiManager) де користувач введе setup token
  // Або показати QR-код на OLED дисплеї
  
  // Для простоти - отримуємо token через Serial
  Serial.println("Enter setup token:");
  // ... код для отримання токена ...
}

// ===== ФУНКЦІЯ: Збереження/завантаження конфігурації =====
void loadConfig() {
  // Завантажити з EEPROM: device_key, plant_ids
  // TODO: реалізувати через Preferences бібліотеку
}

void saveConfig() {
  // Зберегти в EEPROM: device_key, plant_ids
  // TODO: реалізувати через Preferences бібліотеку
}
```

---

## 🔄 Алгоритм роботи

### При запуску ESP:

1. ✅ Підключитись до WiFi
2. ✅ Завантажити збережену конфігурацію (device_key, plant_ids)
3. ✅ Якщо device_key немає - запустити режим реєстрації
4. ✅ Ініціалізувати всі датчики
5. ✅ Відправити список доступних датчиків на сервер
6. ✅ Почати основний цикл

### Основний цикл:

1. ✅ Кожні 5-15 хвилин:
   - Прочитати всі датчики
   - Відправити дані на сервер
   
2. ✅ Кожні 30-60 секунд:
   - Перевірити чи є команди з сервера
   - Виконати команди (полив, фітолампа)
   - Відправити статус виконання

---

## ⚙️ Налаштування через веб-інтерфейс (роблю я)

**Як користувач буде підключати ESP:**

1. Користувач натискає "Додати новий контролер" у веб-інтерфейсі
2. Веб показує QR-код з setup token
3. Користувач сканує QR-код через додаток або вводить токен вручну
4. ESP реєструється і отримує device_key
5. Веб показує список доступних датчиків з ESP
6. Користувач додає рослину і обирає датчик для неї
7. Сервер відправляє на ESP інформацію про прив'язку: `plant_id <-> sensor_pin`

**Структура прив'язки:**

Сервер відправить на ESP:
```
POST /api/iot/devices/{device_id}/mappings
{
  "mappings": [
    {
      "plant_id": "uuid-plant-1",
      "soil_sensor_pin": 34,
      "pump_pin": 5
    },
    {
      "plant_id": "uuid-plant-2",
      "soil_sensor_pin": 35,
      "pump_pin": 18
    }
  ]
}
```

ESP збереже ці прив'язки в пам'ять і буде використовувати при відправці даних.

---

## 🛡️ Безпека

### Обов'язково:
- ✅ Всі запити тільки через HTTPS
- ✅ Device Key зберігати в захищеній пам'яті (EEPROM)
- ✅ Не показувати Device Key в Serial логах
- ✅ Перевіряти SSL сертифікати

### Захист від переливу:
```cpp
const int MAX_WATERING_DURATION_MS = 30000; // Макс 30 секунд
const unsigned long MIN_WATERING_INTERVAL_MS = 3600000; // Мін 1 година між поливами

unsigned long lastWateringTime[4] = {0, 0, 0, 0};

bool canWater(int pumpIndex) {
  return (millis() - lastWateringTime[pumpIndex]) > MIN_WATERING_INTERVAL_MS;
}
```

---

## 📊 Калібрування датчиків

### Датчик вологості ґрунту:

1. **Вимірюємо "сухе" значення:**
   - Тримаємо датчик в повітрі
   - Записуємо значення (наприклад: 4095)

2. **Вимірюємо "мокре" значення:**
   - Опускаємо датчик в воду
   - Записуємо значення (наприклад: 1000)

3. **Використовуємо в коді:**
```cpp
const int DRY_VALUE = 4095;
const int WET_VALUE = 1000;
float moisture = map(analogRead(pin), DRY_VALUE, WET_VALUE, 0, 100);
```

### Помпа:

1. **Вимірюємо продуктивність:**
   - Запускаємо помпу на 10 секунд
   - Вимірюємо скільки мл води налилось
   - Обчислюємо: мл/сек = налито_мл / 10

2. **Використовуємо в коді:**
```cpp
const float PUMP_ML_PER_SECOND = 20.0; // Ваше виміряне значення
int duration = (waterAmount / PUMP_ML_PER_SECOND) * 1000; // в мс
```

---

## 🔌 Підключення датчиків

### Схема (приклад для 4 рослин):

```
ESP32           Датчики                      Виконавчі
GPIO34 -------> Soil Sensor 1
GPIO35 -------> Soil Sensor 2                GPIO5  -------> Реле 1 -> Помпа 1
GPIO36 -------> Soil Sensor 3                GPIO18 -------> Реле 2 -> Помпа 2
GPIO39 -------> Soil Sensor 4                GPIO19 -------> Реле 3 -> Помпа 3
GPIO4  -------> DHT22 (temp + humidity)      GPIO21 -------> Реле 4 -> Помпа 4
SCL    -------> BH1750 (light)               GPIO22 -------> Реле 5 -> Фітолампа
SDA    -------> BH1750 (light)

GND    -------> Загальна земля
3.3V   -------> Живлення датчиків
5V     -------> Живлення реле
```

---

## 📦 Необхідні бібліотеки (Arduino IDE)

```
1. DHT sensor library (Adafruit)
2. ArduinoJson (v6)
3. BH1750 (by Christopher Laws)
4. WiFi (вбудована для ESP32)
5. HTTPClient (вбудована)
6. Preferences (для збереження конфігурації)
```

**Встановлення:**
Arduino IDE -> Tools -> Manage Libraries -> пошук по назві

---

## 🧪 Тестування

### Як перевірити що працює:

1. **Тест датчиків (без сервера):**
```cpp
void testSensors() {
  Serial.println("=== TESTING SENSORS ===");
  
  // Тест вологості ґрунту
  for (int i = 0; i < 4; i++) {
    float moisture = readSoilMoisture(soilPins[i]);
    Serial.printf("Soil %d (pin %d): %.1f%%\n", i+1, soilPins[i], moisture);
  }
  
  // Тест DHT22
  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();
  Serial.printf("Temp: %.1f°C, Humidity: %.1f%%\n", temp, humidity);
  
  // Тест BH1750
  float lux = lightMeter.readLightLevel();
  Serial.printf("Light: %.0f lux\n", lux);
}
```

2. **Тест помп (без сервера):**
```cpp
void testPumps() {
  Serial.println("=== TESTING PUMPS ===");
  
  for (int i = 0; i < 4; i++) {
    Serial.printf("Testing pump %d (pin %d)...\n", i+1, pumpPins[i]);
    digitalWrite(pumpPins[i], HIGH);
    delay(2000); // 2 секунди
    digitalWrite(pumpPins[i], LOW);
    delay(1000);
  }
}
```

3. **Тест відправки даних:**
   - Я дам вам тестовий сервер
   - Або можете використати Postman Echo для перевірки

---

## 📞 Зв'язок зі мною

**Коли все буде готово, мені потрібно від вас:**

1. ✅ MAC-адреса ESP (для реєстрації)
2. ✅ Список пінів які ви використовуєте
3. ✅ Калібровані значення датчиків
4. ✅ Продуктивність помпи (мл/сек)

**Я вам дам:**

1. ✅ Адресу API сервера (`https://yourdomain.com`)
2. ✅ Setup Token для першої реєстрації
3. ✅ Інструкції по тестуванню

---

## ❓ Часті питання

**Q: Що робити якщо WiFi відключився?**  
A: ESP буде автоматично переподключатись. Дані не будуть втрачені - вони надішлються при наступному підключенні.

**Q: Що якщо сервер не відповідає?**  
A: ESP буде повторювати запит через 1 хвилину. Критичні команди (полив) не втратяться.

**Q: Скільки рослин максимум?**  
A: ESP32 має достатньо пінів для 8 рослин (8 датчиків + 8 помп). Але рекомендую почати з 4.

**Q: Чи потрібен екран (OLED)?**  
A: Не обов'язково, але було б зручно для відображення статусу та QR-коду при налаштуванні.

**Q: Як оновлювати прошивку?**  
A: Можна додати OTA (Over-The-Air) update - я можу зробити endpoint для цього.

---

## 📝 Checklist перед здачею

- [ ] ESP підключається до WiFi
- [ ] Всі датчики читаються коректно
- [ ] Дані відправляються на сервер
- [ ] ESP отримує команди з сервера
- [ ] Помпи працюють при отриманні команди
- [ ] Фітолампа вмикається/вимикається
- [ ] Device Key зберігається після перезавантаження
- [ ] Захист від переливу працює
- [ ] Serial виводить зрозумілі логи
- [ ] Калібрування зроблено

---

**Успіхів у розробці! 🚀**

Якщо є питання - пишіть, я допоможу!

