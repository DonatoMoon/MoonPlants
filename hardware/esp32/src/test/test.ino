#include <ESP8266WiFi.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <Adafruit_Sensor.h>

Adafruit_BME280 bme; 

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- BME280 Test on ESP8266 ---");

  // На ESP8266 D2 = SDA (4), D1 = SCL (5)
  Wire.begin(4, 5); 

  // Спробуємо знайти датчик
  if (!bme.begin(0x76, &Wire)) {
    Serial.println("Could not find a valid BME280 sensor, check wiring!");
    while (1); // Зупиняємося, якщо не знайшли
  }

  Serial.println("BME280 OK!");
}

void loop() {
  Serial.print("Temp: ");
  Serial.print(bme.readTemperature());
  Serial.print(" C, Hum: ");
  Serial.print(bme.readHumidity());
  Serial.println(" %");
  
  delay(2000);
}