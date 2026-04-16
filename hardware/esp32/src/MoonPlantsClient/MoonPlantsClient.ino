/**
 * MoonPlants ESP32 Real Client
 * 
 * - DHT11 на GPIO 4
 * - LM75B на I2C (SDA 21, SCL 22)
 * - "Помпа" (LED) на GPIO 26
 * - "Лампа" (LED) на GPIO 27
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "DHT.h"
#include <ArduinoJson.h>
#include "mbedtls/md.h"
#include "mbedtls/base64.h"
#include "time.h"

// ==============================
// CONFIGURATION
// ==============================
const char* WIFI_SSID     = "TP-Link_9C6A";
const char* WIFI_PASSWORD = "03152102";

const String API_BASE_URL = "http://192.168.1.102:3000"; // ЗАМІНИТИ на IP комп'ютера (IPv4)
const String DEVICE_ID    = "00000000-0000-0000-0000-000000000002";
const String HMAC_SECRET  = "esp32_real_secret_key_123";

// NTP Server
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 0;
const int   daylightOffset_sec = 0;

// Pin Definitions
#define DHTPIN 4
#define DHTTYPE DHT11
#define PUMP_PIN 26
#define LAMP_PIN 27
#define LM75B_ADDR 0x48

// Hardware calibration
const float ML_PER_SECOND = 5.0; // 5 мл/с - це тимчасова заглушка для помпи

// Globals
DHT dht(DHTPIN, DHTTYPE);
unsigned long sequence = 1;
unsigned long lastMeasureTime = 0;
const unsigned long MEASURE_INTERVAL = 30000; // Send measurements every 30 seconds

// Async control state
bool isPumpRunning = false;
unsigned long pumpTurnOffTime = 0;

bool isLightRunning = false;
unsigned long lightTurnOffTime = 0;

// ==============================
// HELPER FUNCTIONS
// ==============================

String toHex(const unsigned char* data, size_t length) {
  String hex = "";
  for (size_t i = 0; i < length; i++) {
    if (data[i] < 0x10) hex += "0";
    hex += String(data[i], HEX);
  }
  return hex;
}

String toBase64Url(const unsigned char* input, size_t length) {
  unsigned char base64_buf[128];
  size_t olen = 0;
  mbedtls_base64_encode(base64_buf, sizeof(base64_buf), &olen, input, length);
  base64_buf[olen] = '\0';
  
  String b64 = String((char*)base64_buf);
  b64.replace("+", "-");
  b64.replace("/", "_");
  b64.replace("=", "");
  return b64;
}

String generateSHA256Hex(const String& payload) {
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 0);
  mbedtls_md_starts(&ctx);
  mbedtls_md_update(&ctx, (const unsigned char*)payload.c_str(), payload.length());
  unsigned char hash[32];
  mbedtls_md_finish(&ctx, hash);
  mbedtls_md_free(&ctx);
  return toHex(hash, 32);
}

String generateHMAC(const String& payload, const String& key) {
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key.c_str(), key.length());
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)payload.c_str(), payload.length());
  unsigned char mac[32];
  mbedtls_md_hmac_finish(&ctx, mac);
  mbedtls_md_free(&ctx);
  return toBase64Url(mac, 32);
}

unsigned long getTimestamp() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return 0;
  }
  time(&now);
  return now;
}

float readLM75B() {
  Wire.beginTransmission(LM75B_ADDR);
  Wire.write(0x00);
  Wire.endTransmission();
  
  Wire.requestFrom(LM75B_ADDR, 2);
  if (Wire.available() == 2) {
    int8_t msb = Wire.read();
    uint8_t lsb = Wire.read();
    float temp = (msb << 8 | lsb) >> 5;
    return temp * 0.125;
  }
  return NAN;
}

// ==============================
// API CALLS
// ==============================

void sendMeasurements() {
  unsigned long timestamp = getTimestamp();
  if (timestamp == 0) return;

  String method = "POST";
  String path = "/api/iot/v1/measurements";
  
  float dhtT = dht.readTemperature();
  float dhtH = dht.readHumidity();
  float lmT = readLM75B();
  
  if (isnan(lmT) && !isnan(dhtT)) lmT = dhtT; // fallback
  if (isnan(dhtH)) dhtH = 50.0;
  if (isnan(lmT)) lmT = 22.0;

  JsonDocument doc;
  doc["measuredAt"] = timestamp;
  doc["air"]["tempC"] = lmT;
  doc["air"]["humidityPct"] = dhtH;
  doc["lightLux"] = random(300, 500); // Симуляція освітленості
  
  JsonArray soil = doc["soil"].to<JsonArray>();
  JsonObject s1 = soil.add<JsonObject>();
  s1["channel"] = 1;
  s1["moistureRaw"] = random(350, 450); // Симуляція вологості ґрунту канал 1
  JsonObject s2 = soil.add<JsonObject>();
  s2["channel"] = 2;
  s2["moistureRaw"] = random(350, 450); // Симуляція вологості ґрунту канал 2
  
  doc["batteryV"] = 3.3;
  doc["rssiDbm"] = WiFi.RSSI();
  
  String body;
  serializeJson(doc, body);
  
  String contentHash = generateSHA256Hex(body);
  String seqStr = String(sequence++);
  String timeStr = String(timestamp);
  
  String canonical = method + "\n" + path + "\n" + DEVICE_ID + "\n" + seqStr + "\n" + timeStr + "\n" + contentHash;
  String signature = generateHMAC(canonical, HMAC_SECRET);
  
  HTTPClient http;
  http.begin(API_BASE_URL + path);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Seq", seqStr);
  http.addHeader("X-Device-Timestamp", timeStr);
  http.addHeader("X-Content-SHA256", contentHash);
  http.addHeader("X-Device-Signature", signature);
  
  int responseCode = http.POST(body);
  Serial.printf("[POST Measurements] Status: %d\n", responseCode);
  if (responseCode > 0) {
    Serial.println(http.getString());
  }
  http.end();
}

void sendAck(String commandId, String status) {
  unsigned long timestamp = getTimestamp();
  String method = "POST";
  String path = "/api/iot/v1/commands/" + commandId + "/ack";
  
  JsonDocument doc;
  doc["status"] = status;
  doc["executedAt"] = timestamp;
  doc["result"] = serialized("{}");
  
  String body;
  serializeJson(doc, body);
  
  String contentHash = generateSHA256Hex(body);
  String seqStr = String(sequence++);
  String timeStr = String(timestamp);
  
  String canonical = method + "\n" + path + "\n" + DEVICE_ID + "\n" + seqStr + "\n" + timeStr + "\n" + contentHash;
  String signature = generateHMAC(canonical, HMAC_SECRET);
  
  HTTPClient http;
  http.begin(API_BASE_URL + path);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Seq", seqStr);
  http.addHeader("X-Device-Timestamp", timeStr);
  http.addHeader("X-Content-SHA256", contentHash);
  http.addHeader("X-Device-Signature", signature);
  
  int responseCode = http.POST(body);
  Serial.printf("[POST ACK] Cmd %s Status: %d\n", commandId.c_str(), responseCode);
  http.end();
}

void pollCommands() {
  unsigned long timestamp = getTimestamp();
  if (timestamp == 0) return;

  String method = "GET";
  String path = "/api/iot/v1/commands";
  String fullUrl = API_BASE_URL + path + "?limit=5";
  
  String contentHash = generateSHA256Hex("");
  String seqStr = String(sequence++);
  String timeStr = String(timestamp);
  
  String canonical = method + "\n" + path + "\n" + DEVICE_ID + "\n" + seqStr + "\n" + timeStr + "\n" + contentHash;
  String signature = generateHMAC(canonical, HMAC_SECRET);
  
  HTTPClient http;
  http.begin(fullUrl);
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Seq", seqStr);
  http.addHeader("X-Device-Timestamp", timeStr);
  http.addHeader("X-Content-SHA256", contentHash);
  http.addHeader("X-Device-Signature", signature);
  
  int responseCode = http.GET();
  if (responseCode == 200) {
    String resp = http.getString();
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, resp);
    
    if (!error) {
      JsonArray commands = doc["commands"];
      for (JsonObject cmd : commands) {
        String cmdId = cmd["id"].as<String>();
        String cmdType = cmd["type"].as<String>();
        JsonObject cmdPayload = cmd["payload"];
        
        Serial.println("[Command Received] ID: " + cmdId + ", Type: " + cmdType);
        
        if (cmdType == "PUMP_WATER") {
          int channel = cmdPayload["channel"] | 1;
          
          // Імітуємо реакцію тільки для каналу 1 (наш єдиний підключений LED помпи)
          if (channel == 1) {
            float water_ml = cmdPayload["water_ml"] | 0.0;
            if (water_ml > 0) {
              unsigned long duration_ms = (unsigned long)((water_ml / ML_PER_SECOND) * 1000);
              
              digitalWrite(PUMP_PIN, HIGH);
              pumpTurnOffTime = millis() + duration_ms;
              isPumpRunning = true;
              
              Serial.printf("Pump ON for %lu ms (%.1f ml)\n", duration_ms, water_ml);
            }
          } else {
            Serial.printf("Pump ignored for channel %d\n", channel);
          }
          sendAck(cmdId, "ok"); // Завжди повертаємо ok
        } 
        else if (cmdType == "LIGHT_ON") {
          unsigned long duration_sec = cmdPayload["duration_sec"] | 0;
          digitalWrite(LAMP_PIN, HIGH);
          
          if (duration_sec > 0) {
            lightTurnOffTime = millis() + (duration_sec * 1000);
            isLightRunning = true;
            Serial.printf("Lamp ON for %lu sec\n", duration_sec);
          } else {
            isLightRunning = false; // Світить безкінечно
            Serial.println("Lamp ON (infinite)");
          }
          sendAck(cmdId, "ok");
        }
        else if (cmdType == "LIGHT_OFF") {
          digitalWrite(LAMP_PIN, LOW);
          isLightRunning = false;
          Serial.println("Lamp OFF");
          sendAck(cmdId, "ok");
        }
      }
    }
  } else if (responseCode != 404 && responseCode != 204 && responseCode > 0) {
    Serial.printf("[GET Commands] Failed, Status: %d\n", responseCode);
    Serial.println(http.getString());
  }
  http.end();
}

// ==============================
// MAIN LOGIC
// ==============================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n--- MoonPlants Real Client ---");
  
  Wire.begin(21, 22);
  dht.begin();
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(LAMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);
  digitalWrite(LAMP_PIN, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi ");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println(" CONNECTED!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.print("Waiting for NTP time ");
  while (getTimestamp() < 100000) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println(" TIME SYNCED!");
  
  sequence = getTimestamp();
}

void loop() {
  unsigned long currentMillis = millis();

  // Асинхронне вимкнення помпи
  if (isPumpRunning && currentMillis >= pumpTurnOffTime) {
    digitalWrite(PUMP_PIN, LOW);
    isPumpRunning = false;
    Serial.println("Pump OFF (Auto)");
  }

  // Асинхронне вимкнення лампи
  if (isLightRunning && currentMillis >= lightTurnOffTime) {
    digitalWrite(LAMP_PIN, LOW);
    isLightRunning = false;
    Serial.println("Lamp OFF (Auto)");
  }

  if (WiFi.status() == WL_CONNECTED) {
    static unsigned long lastPollTime = 0;
    if (currentMillis - lastPollTime >= 5000) {
      lastPollTime = currentMillis;
      pollCommands();
    }

    if (currentMillis - lastMeasureTime >= MEASURE_INTERVAL || lastMeasureTime == 0) {
      lastMeasureTime = currentMillis;
      sendMeasurements();
    }
  }
  
  delay(50); // Невелика затримка щоб не завантажувати процесор на 100%
}
