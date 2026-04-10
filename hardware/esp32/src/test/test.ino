/**
 * MoonPlants ESP32 Hardware Test (No BME280)
 * 
 * - DHT11 на GPIO 4
 * - LM75B на I2C (SDA 21, SCL 22)
 * - "Помпа" (LED) на GPIO 26
 * - "Лампа" (LED) на GPIO 27
 */

#include <Wire.h>
#include "DHT.h"

// DHT11
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// LM75B адреса за замовчуванням 0x48
#define LM75B_ADDR 0x48

// Піни периферії
#define PUMP_PIN 26
#define LAMP_PIN 27

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n--- MoonPlants HW Test (DHT11 + LM75B) ---");
  
  // 1. Ініціалізація I2C
  Wire.begin(21, 22);

  // 2. Ініціалізація DHT11
  dht.begin();
  Serial.println("DHT11 initialized [OK]");

  // 3. Налаштування пінів
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(LAMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);
  digitalWrite(LAMP_PIN, LOW);

  Serial.println("LEDs and Pins ready.");
  Serial.println("-------------------------------------------\n");
}

float readLM75B() {
  Wire.beginTransmission(LM75B_ADDR);
  Wire.write(0x00); // Регістр температури
  Wire.endTransmission();
  
  Wire.requestFrom(LM75B_ADDR, 2);
  if (Wire.available() == 2) {
    int8_t msb = Wire.read();
    uint8_t lsb = Wire.read();
    // Обчислення температури для LM75B
    float temp = (msb << 8 | lsb) >> 5;
    return temp * 0.125;
  }
  return NAN;
}

void loop() {
  Serial.println(">>> START CYCLE <<<");
  
  // Вмикаємо "пристрої"
  digitalWrite(PUMP_PIN, HIGH);
  digitalWrite(LAMP_PIN, HIGH);

  // Читання DHT11
  float dhtH = dht.readHumidity();
  float dhtT = dht.readTemperature();

  // Читання LM75B
  float lmT = readLM75B();

  // Вивід даних
  Serial.println("--- SENSORS DATA ---");
  
  if (isnan(dhtT) || isnan(dhtH)) {
    Serial.println("DHT11:  Error reading sensor!");
  } else {
    Serial.printf("DHT11:  Temp: %.1f C, Hum: %.1f%%\n", dhtT, dhtH);
  }

  if (isnan(lmT)) {
    Serial.println("LM75B:  Error reading sensor!");
  } else {
    Serial.printf("LM75B:  Temp: %.1f C\n", lmT);
  }
  
  Serial.println("--------------------");

  delay(1000);

  // Вимикаємо "пристрої"
  digitalWrite(PUMP_PIN, LOW);
  digitalWrite(LAMP_PIN, LOW);
  
  Serial.println("<<< END CYCLE >>>\n");
  delay(2000);
}
