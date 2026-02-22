# ⚡ Швидкий старт для IoT розробника

**TL;DR версія інструкції**

---

## 🎯 Що треба зробити

Зібрати ESP32 контролер який:
1. Читає датчики і шле на сервер кожні 5 хв
2. Отримує команди з сервера кожні 60 сек
3. Виконує полив та керує фітолампою

---

## 🔌 Залізо

- **ESP32** (або ESP8266)
- **Датчики загальні:** DHT22, BH1750
- **Датчики рослин:** 4 датчики вологості ґрунту
- **Виконавчі:** 4 помпи через реле, 1 фітолампа через реле

**Піни (приклад):**
```
Soil sensors: GPIO34, 35, 36, 39
Pumps:        GPIO5, 18, 19, 21
Light:        GPIO22
DHT22:        GPIO4
BH1750:       I2C (SDA/SCL)
```

---

## 📡 API (3 ендпоінти)

### 1. Відправити дані (кожні 5 хв)
```
POST /api/iot/measurements
Header: X-Device-Key: sk-dev-xxxx

Body:
{
  "device_id": "ESP_001",
  "measurements": [
    {"plant_id": "p1", "soil_moisture": 45.5, "soil_sensor_pin": 34},
    {"plant_id": "p2", "soil_moisture": 62.3, "soil_sensor_pin": 35}
  ],
  "environment": {
    "air_temp": 22.5,
    "air_humidity": 60.0,
    "light": 1200
  }
}
```

### 2. Отримати команди (кожні 60 сек)
```
GET /api/iot/commands?device_id=ESP_001
Header: X-Device-Key: sk-dev-xxxx

Response:
{
  "has_commands": true,
  "commands": [
    {
      "command_id": "cmd-123",
      "type": "water",
      "plant_id": "p1",
      "params": {
        "pump_pin": 5,
        "water_amount_ml": 200,
        "duration_seconds": 10
      }
    }
  ]
}
```

### 3. Відправити статус (після виконання)
```
POST /api/iot/commands/{command_id}/status
Header: X-Device-Key: sk-dev-xxxx

Body:
{
  "status": "completed",
  "notes": "OK"
}
```

---

## 💻 Мінімальний код

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASS";
const char* apiUrl = "https://yourdomain.com/api/iot";
String deviceKey = "sk-dev-xxxxxxxxx"; // Я дам
String deviceId = "ESP_001";

const int soilPins[] = {34, 35, 36, 39};
const int pumpPins[] = {5, 18, 19, 21};
String plantIds[4] = {"", "", "", ""}; // Буде з сервера

DHT dht(4, DHT22);

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  
  for(int i=0; i<4; i++) pinMode(pumpPins[i], OUTPUT);
  dht.begin();
}

void loop() {
  static unsigned long lastMeasurement = 0;
  static unsigned long lastCommand = 0;
  
  if (millis() - lastMeasurement > 300000) { // 5 хв
    sendMeasurements();
    lastMeasurement = millis();
  }
  
  if (millis() - lastCommand > 60000) { // 1 хв
    checkCommands();
    lastCommand = millis();
  }
  
  delay(100);
}

void sendMeasurements() {
  HTTPClient http;
  DynamicJsonDocument doc(2048);
  
  doc["device_id"] = deviceId;
  JsonArray measurements = doc.createNestedArray("measurements");
  
  for (int i = 0; i < 4; i++) {
    if (plantIds[i] != "") {
      JsonObject m = measurements.createNestedObject();
      m["plant_id"] = plantIds[i];
      m["soil_moisture"] = readSoil(soilPins[i]);
      m["soil_sensor_pin"] = soilPins[i];
    }
  }
  
  JsonObject env = doc.createNestedObject("environment");
  env["air_temp"] = dht.readTemperature();
  env["air_humidity"] = dht.readHumidity();
  env["light"] = 1200; // TODO: BH1750
  
  String payload;
  serializeJson(doc, payload);
  
  http.begin(String(apiUrl) + "/measurements");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", deviceKey);
  http.POST(payload);
  http.end();
}

void checkCommands() {
  HTTPClient http;
  http.begin(String(apiUrl) + "/commands?device_id=" + deviceId);
  http.addHeader("X-Device-Key", deviceKey);
  
  if (http.GET() == 200) {
    DynamicJsonDocument doc(2048);
    deserializeJson(doc, http.getString());
    
    if (doc["has_commands"]) {
      JsonArray cmds = doc["commands"];
      for (JsonObject cmd : cmds) {
        if (cmd["type"] == "water") {
          int pin = cmd["params"]["pump_pin"];
          int dur = cmd["params"]["duration_seconds"];
          
          digitalWrite(pin, HIGH);
          delay(dur * 1000);
          digitalWrite(pin, LOW);
          
          reportStatus(cmd["command_id"], "completed");
        }
      }
    }
  }
  http.end();
}

void reportStatus(String cmdId, String status) {
  HTTPClient http;
  DynamicJsonDocument doc(256);
  doc["status"] = status;
  doc["notes"] = "OK";
  
  String payload;
  serializeJson(doc, payload);
  
  http.begin(String(apiUrl) + "/commands/" + cmdId + "/status");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", deviceKey);
  http.POST(payload);
  http.end();
}

float readSoil(int pin) {
  int raw = analogRead(pin);
  float moisture = map(raw, 4095, 1000, 0, 100);
  return constrain(moisture, 0, 100);
}
```

---

## 📦 Бібліотеки

Arduino IDE -> Tools -> Manage Libraries:
1. `DHT sensor library` (Adafruit)
2. `ArduinoJson` (v6)
3. `BH1750` (Christopher Laws)

---

## ⚙️ Калібрування

### Датчик вологості:
```cpp
// 1. Тримати в повітрі -> записати значення (напр. 4095)
// 2. Опустити в воду -> записати значення (напр. 1000)
const int DRY_VALUE = 4095;
const int WET_VALUE = 1000;
```

### Помпа:
```cpp
// 1. Запустити на 10 сек
// 2. Виміряти скільки мл -> поділити на 10 = мл/сек
const float ML_PER_SEC = 20.0;
```

---

## 🔐 Безпека

```cpp
// Максимум 30 сек полив
const int MAX_DURATION = 30000;

// Мінімум 1 година між поливами
const unsigned long MIN_INTERVAL = 3600000;

unsigned long lastWater[4] = {0,0,0,0};

bool canWater(int idx) {
  return (millis() - lastWater[idx]) > MIN_INTERVAL;
}
```

---

## 🧪 Тестування

```cpp
void testSensors() {
  Serial.println("=== TEST ===");
  for(int i=0; i<4; i++) {
    Serial.printf("Soil %d: %.1f%%\n", i, readSoil(soilPins[i]));
  }
  Serial.printf("Temp: %.1f°C\n", dht.readTemperature());
  Serial.printf("Humidity: %.1f%%\n", dht.readHumidity());
}

void testPumps() {
  for(int i=0; i<4; i++) {
    Serial.printf("Pump %d ON\n", i);
    digitalWrite(pumpPins[i], HIGH);
    delay(2000);
    digitalWrite(pumpPins[i], LOW);
    delay(1000);
  }
}
```

---

## 📝 Що я дам вам

1. ✅ Адресу API: `https://yourdomain.com`
2. ✅ Device Key: `sk-dev-xxxxxxxxx`
3. ✅ Setup Token для реєстрації

---

## 📝 Що мені треба від вас

1. ✅ MAC-адреса ESP
2. ✅ Список пінів
3. ✅ Калібровані значення (DRY/WET)
4. ✅ Продуктивність помпи (мл/сек)

---

## ✅ Checklist

- [ ] WiFi підключається
- [ ] Датчики читаються
- [ ] Дані йдуть на сервер (200 OK)
- [ ] Команди приходять з сервера
- [ ] Помпи працюють
- [ ] Device Key зберігається після reboot
- [ ] Логи в Serial працюють

---

## 🔗 Детальна документація

Дивись: `INSTRUCTION_FOR_IOT_DEVELOPER_UA.md` - там все детально розписано

---

**Успіхів! 🚀**

