/**
 * MoonPlants ESP32 Real Client V2 (BMP280 + DHT11 + LCD + Analog)
 *
 * Hardware Scheme:
 * 1. Actuators:
 *    - Pump (Relay) on GPIO 18 (High-Z Control)
 *    - LED Lamp on GPIO 17 (Active High)
 * 2. I2C Bus (GPIO 21, 22):
 *    - BMP280 (Temperature & Pressure) - Address 0x76
 *    - LCD 128x32 (ST7567) - Address 0x3F
 * 3. Digital:
 *    - DHT11 (Humidity) on GPIO 16
 * 4. Analog:
 *    - Soil Moisture on GPIO 32
 *    - Photoresistor on GPIO 34
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>
#include <DHT.h>
#include <U8g2lib.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include "mbedtls/md.h"
#include "mbedtls/base64.h"
#include "time.h"

// ==============================
// CONFIGURATION
// ==============================
const char* WIFI_SSID     = "TP-Link_9C6A";
const char* WIFI_PASSWORD = "03152102";

const String API_BASE_URL = "http://192.168.1.102:3000"; 
const String DEVICE_ID    = "00000000-0000-0000-0000-000000000002";
const String HMAC_SECRET  = "esp32_real_secret_key_123";

const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 0;
const int   daylightOffset_sec = 0;

// Pin Definitions
#define PUMP_PIN 18
#define LAMP_PIN 17
#define SOIL_PIN 32
#define LIGHT_PIN 34
#define DHTPIN   27
#define DHTTYPE  DHT11

// Hardware calibration
const float ML_PER_SECOND = 18.0; 

// Globals
Adafruit_BMP280 bmp;
DHT dht(DHTPIN, DHTTYPE);
U8G2_ST7567_ENH_DG128064_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);

unsigned long sequence = 1;
unsigned long lastMeasureTime = 0;
const unsigned long MEASURE_INTERVAL = 30000; 

String lastStatus = "Wait...";
float currTemp = 0, currHum = 0;
int currSoil = 0, currLight = 0;

// Async control state
bool isPumpRunning = false;
unsigned long pumpTurnOffTime = 0;
bool isLightRunning = false;
unsigned long lightTurnOffTime = 0;

// ==============================
// UI FUNCTIONS
// ==============================

void updateDisplay() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x10_tf); 
  
  u8g2.drawStr(0, 8, "MoonPlants");
  if (WiFi.status() == WL_CONNECTED) {
    u8g2.drawStr(80, 8, "WiFi OK");
  } else {
    u8g2.drawStr(80, 8, "OFFLINE");
  }
  
  char buf[32];
  sprintf(buf, "T:%.1fC H:%.0f%%", currTemp, currHum);
  u8g2.drawStr(0, 20, buf);
  
  sprintf(buf, "S:%d L:%d", currSoil, currLight);
  u8g2.drawStr(65, 20, buf);

  if (isPumpRunning) {
    u8g2.drawStr(0, 31, "> PUMPING WATER <");
  } else {
    u8g2.drawStr(0, 31, lastStatus.c_str());
  }

  u8g2.sendBuffer();
}

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
  if (!getLocalTime(&timeinfo)) return 0;
  time(&now);
  return now;
}

// ==============================
// API CALLS
// ==============================

void sendMeasurements() {
  if (WiFi.status() != WL_CONNECTED) return; 
  
  unsigned long timestamp = getTimestamp();
  if (timestamp == 0) return;

  String method = "POST";
  String path = "/api/iot/v1/measurements";
  
  currTemp = bmp.readTemperature();
  currHum = dht.readHumidity();
  currSoil = analogRead(SOIL_PIN);
  currLight = analogRead(LIGHT_PIN);
  
  if (isnan(currTemp)) currTemp = 22.0;
  if (isnan(currHum)) currHum = 50.0;

  // Формуємо JSON суворо за OpenAPI схемою
  JsonDocument doc;
  doc["measuredAt"] = timestamp;
  
  JsonObject air = doc["air"].to<JsonObject>();
  air["tempC"] = currTemp;
  air["humidityPct"] = currHum;
  // Поле pressureHpa ВИДАЛЕНО, бо воно не описане в схемі API і викликає помилку 400
  
  doc["lightLux"] = currLight; 
  
  JsonArray soil = doc["soil"].to<JsonArray>();
  JsonObject s1 = soil.add<JsonObject>();
  s1["channel"] = 1;
  s1["moistureRaw"] = currSoil;
  
  doc["batteryV"] = 3.3; 
  doc["rssiDbm"] = (int)WiFi.RSSI();
  
  String body;
  serializeJson(doc, body);
  
  Serial.println("[API] Sending measurements: " + body);

  String contentHash = generateSHA256Hex(body);
  String seqStr = String(sequence++);
  String timeStr = String(timestamp);
  
  String canonical = method + "\n" + path + "\n" + DEVICE_ID + "\n" + seqStr + "\n" + timeStr + "\n" + contentHash;
  String signature = generateHMAC(canonical, HMAC_SECRET);
  
  HTTPClient http;
  http.setTimeout(10000); 
  http.begin(API_BASE_URL + path);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Seq", seqStr);
  http.addHeader("X-Device-Timestamp", timeStr);
  http.addHeader("X-Content-SHA256", contentHash);
  http.addHeader("X-Device-Signature", signature);
  
  int responseCode = http.POST(body);
  Serial.println("[API] POST " + path + " Response: " + String(responseCode));

  if (responseCode > 0) {
    lastStatus = "Sync OK: " + String(responseCode);
  } else {
    lastStatus = "ERR: " + String(responseCode);
    Serial.println("[API] Error: " + http.errorToString(responseCode));
  }
  http.end();
  updateDisplay();
}

void sendAck(String commandId, String status) {
  if (WiFi.status() != WL_CONNECTED) return;

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
  http.setTimeout(10000);
  http.begin(API_BASE_URL + path);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Seq", seqStr);
  http.addHeader("X-Device-Timestamp", timeStr);
  http.addHeader("X-Content-SHA256", contentHash);
  http.addHeader("X-Device-Signature", signature);
  
  int responseCode = http.POST(body);
  Serial.println("[API] ACK " + commandId + " Response: " + String(responseCode));
  http.end();
}

void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

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
  http.setTimeout(10000);
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
      if (commands.size() > 0) {
        Serial.println("[API] Received " + String(commands.size()) + " commands");
      }
      for (JsonObject cmd : commands) {
        String cmdId = cmd["id"].as<String>();
        String cmdType = cmd["type"].as<String>();
        JsonObject cmdPayload = cmd["payload"];
        
        Serial.println("[CMD] Handling " + cmdType + " (ID: " + cmdId + ")");

        if (cmdType == "PUMP_WATER") {
          float water_ml = cmdPayload["water_ml"] | 0.0;
          if (water_ml > 0) {
            unsigned long duration_ms = (unsigned long)((water_ml / ML_PER_SECOND) * 1000);
            Serial.println("[ACT] Pump ON for " + String(duration_ms) + "ms (" + String(water_ml) + "ml)");
            pinMode(PUMP_PIN, OUTPUT); 
            digitalWrite(PUMP_PIN, LOW); 
            pumpTurnOffTime = millis() + duration_ms;
            isPumpRunning = true;
          }
          sendAck(cmdId, "ok");
        } 
        else if (cmdType == "LIGHT_ON") {
          digitalWrite(LAMP_PIN, HIGH);
          unsigned long duration_sec = cmdPayload["duration_sec"] | 0;
          Serial.println("[ACT] Light ON" + (duration_sec > 0 ? " for " + String(duration_sec) + "s" : ""));
          if (duration_sec > 0) {
            lightTurnOffTime = millis() + (duration_sec * 1000);
            isLightRunning = true;
          }
          sendAck(cmdId, "ok");
        }
        else if (cmdType == "LIGHT_OFF") {
          Serial.println("[ACT] Light OFF");
          digitalWrite(LAMP_PIN, LOW);
          isLightRunning = false;
          sendAck(cmdId, "ok");
        }
      }
    } else {
      Serial.println("[API] JSON Parse Error: " + String(error.c_str()));
    }
  } else if (responseCode != 204) { // 204 No Content is normal if no commands
     Serial.println("[API] GET Commands Error: " + String(responseCode));
  }
  http.end();
  updateDisplay();
}

// ==============================
// MAIN LOGIC
// ==============================

void setup() {
  Serial.begin(115200);
  delay(1500); 
  
  Serial.println("\n[SETUP] MoonPlants V2");
  Serial.println("[SETUP] Device ID: " + DEVICE_ID);

  Wire.begin(21, 22); 
  u8g2.setI2CAddress(0x3F * 2); 
  if (u8g2.begin()) {
    u8g2.setContrast(30); 
    Serial.println("[STEP 1] LCD ST7567 OK");
  }

  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(0, 15, "MoonPlants Boot...");
  u8g2.sendBuffer();

  delay(200);

  pinMode(PUMP_PIN, INPUT); 
  pinMode(LAMP_PIN, OUTPUT);
  digitalWrite(LAMP_PIN, LOW); 
  dht.begin();
  Serial.println("[STEP 2] DHT11 OK");

  if (!bmp.begin(0x76)) {
    Serial.println("[STEP 3] BMP280 FAILED");
    u8g2.drawStr(0, 28, "BMP280 Missing!");
    u8g2.sendBuffer();
  } else {
    Serial.println("[STEP 3] BMP280 OK");
  }

  analogReadResolution(12); 
  
  u8g2.clearBuffer();
  u8g2.drawStr(0, 15, "Connecting WiFi...");
  u8g2.sendBuffer();

  Serial.print("[WIFI] Connecting to " + String(WIFI_SSID));
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(1000);
    Serial.print(".");
    retry++;
  }
  Serial.println("");
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] Connected! IP: " + WiFi.localIP().toString());
    u8g2.clearBuffer();
    u8g2.drawStr(0, 15, "WiFi Connected!");
    u8g2.drawStr(0, 28, WiFi.localIP().toString().c_str());
    u8g2.sendBuffer();
    delay(2000);
  } else {
    Serial.println("[WIFI] Connection FAILED");
  }

  Serial.println("[TIME] Syncing NTP...");
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  while (getTimestamp() < 100000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[TIME] Sync OK: " + String(getTimestamp()));
  
  sequence = getTimestamp();

  // Temporary sensor test block
  Serial.println("[TEST] Starting quick sensor test...");
  delay(2000);
  for (int i = 0; i < 5; i++) {
    float h = dht.readHumidity();
    int soil = analogRead(SOIL_PIN);
    Serial.printf("[TEST] DHT hum=%.1f  Soil=%d\n", h, soil);
    delay(2500);
  }
  Serial.println("[TEST] Sensor test complete");
  
  updateDisplay();
  Serial.println("[SETUP] Complete\n");
}

// Calibration for Black Capacitive Sensor on ESP32 (12-bit ADC: 0-4095)
const int SOIL_DRY = 4095; 
const int SOIL_WET = 2700; 

void loop() {
  unsigned long currentMillis = millis();

  if (isPumpRunning && currentMillis >= pumpTurnOffTime) {
    pinMode(PUMP_PIN, INPUT); 
    isPumpRunning = false;
    Serial.println("[ACT] Pump OFF (Auto)");
    updateDisplay();
  }

  if (isLightRunning && currentMillis >= lightTurnOffTime) {
    digitalWrite(LAMP_PIN, LOW);
    isLightRunning = false;
    Serial.println("[ACT] Light OFF (Auto)");
    updateDisplay();
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
  } else {
    static unsigned long lastReconnectAttempt = 0;
    if (currentMillis - lastReconnectAttempt >= 10000) {
      lastReconnectAttempt = currentMillis;
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }
  
  static unsigned long lastUpdate = 0;
  if (currentMillis - lastUpdate >= 2000) {
    lastUpdate = currentMillis;
    int rawSoil = analogRead(SOIL_PIN);
    currLight = analogRead(LIGHT_PIN);
    
    // Map to percentage for display/logic
    currSoil = map(rawSoil, SOIL_DRY, SOIL_WET, 0, 100);
    currSoil = constrain(currSoil, 0, 100);
    
    // Read sensors
    float bmpT = bmp.readTemperature();
    float dhtH = dht.readHumidity();
    float dhtT = dht.readTemperature();

    if (!isnan(bmpT)) {
      currTemp = bmpT;
    } else if (!isnan(dhtT)) {
      currTemp = dhtT;
    }

    if (!isnan(dhtH)) {
      currHum = dhtH;
    } else {
      Serial.println("[ERR] DHT11: Failed to read humidity!");
    }
    
    // Log to serial with Raw Soil to verify calibration
    Serial.printf("[DATA] T:%.1fC H:%.1f%% Soil:%d%% (Raw:%d) Light:%d\n", currTemp, currHum, currSoil, rawSoil, currLight);
    
    // Update LCD
    updateDisplay();
  }

  delay(50);
}
