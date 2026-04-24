#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ── DISPLAY SETUP
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ── PIN DEFINITIONS (ESP32)
// For Arduino Uno: change 34 to A0, change 35 to A1
#define SENSOR_A 34
#define SENSOR_B 35

// ── SETTINGS
float tariffPerUnit = 5.5;   // Rs per kWh (Karnataka EB rate)
bool simulationMode = true;  // true = potentiometer, false = ACS712

// ── TRACKING
float totalUnitsA = 0;
float totalUnitsB = 0;
unsigned long lastTime = 0;

// ── DEVICE WATTAGE — USER A
float getWattsA(int raw) {
  float pct = raw / 4095.0;
  // For Arduino Uno change 4095.0 to 1023.0
  if (pct < 0.25) return 5;
  else if (pct < 0.50) return 80;
  else if (pct < 0.75) return 145;
  else return 1645;
}

String getLabelA(int raw) {
  float pct = raw / 4095.0;
  if (pct < 0.25) return "Phone";
  else if (pct < 0.50) return "Ph+Fan";
  else if (pct < 0.75) return "+Laptop";
  else return "+AC";
}

// ── DEVICE WATTAGE — USER B
float getWattsB(int raw) {
  float pct = raw / 4095.0;
  if (pct < 0.25) return 5;
  else if (pct < 0.50) return 2005;
  else if (pct < 0.75) return 2105;
  else return 3605;
}

String getLabelB(int raw) {
  float pct = raw / 4095.0;
  if (pct < 0.25) return "Phone";
  else if (pct < 0.50) return "+Geyser";
  else if (pct < 0.75) return "+TV";
  else return "+AC";
}

void setup() {
  Serial.begin(115200);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("Display not found — check wiring");
    while (true);
  }
  display.clearDisplay();
  display.setTextColor(WHITE);
  lastTime = millis();
}

void loop() {
  unsigned long now = millis();
  float elapsed = (now - lastTime) / 3600000.0;
  lastTime = now;

  int rawA = analogRead(SENSOR_A);
  int rawB = analogRead(SENSOR_B);

  float wattsA, wattsB;

  if (simulationMode) {
    wattsA = getWattsA(rawA);
    wattsB = getWattsB(rawB);
  } else {
    float vA = (rawA / 4095.0) * 3.3;
    float vB = (rawB / 4095.0) * 3.3;
    float iA = abs((vA - 2.5) / 0.066);
    float iB = abs((vB - 2.5) / 0.066);
    wattsA = iA * 230.0;
    wattsB = iB * 230.0;
  }

  totalUnitsA += (wattsA / 1000.0) * elapsed;
  totalUnitsB += (wattsB / 1000.0) * elapsed;

  float costA = totalUnitsA * tariffPerUnit;
  float costB = totalUnitsB * tariffPerUnit;
  float totalCost = costA + costB;
  float totalWatts = wattsA + wattsB;

  float sessionHours = now / 3600000.0;
  float projectedMonthly = (sessionHours > 0)
    ? (totalCost / sessionHours) * 24 * 30 : 0;

  bool outageRisk = totalWatts > 3000;

  // ── DISPLAY
  display.clearDisplay();
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.println("== POWERSPLIT ==");

  display.setCursor(0, 12);
  display.print("A:");
  display.print(getLabelA(rawA));
  display.print(" Rs");
  display.println(costA, 1);

  display.setCursor(0, 22);
  display.print("B:");
  display.print(getLabelB(rawB));
  display.print(" Rs");
  display.println(costB, 1);

  display.drawLine(0, 33, 128, 33, WHITE);

  display.setCursor(0, 37);
  display.print("Total: Rs ");
  display.println(totalCost, 2);

  display.setCursor(0, 47);
  display.print("Proj/mo: Rs ");
  display.print(projectedMonthly, 0);

  display.setCursor(0, 57);
  if (outageRisk) {
    display.println("!! CUT AC/GEYSER NOW");
  } else {
    display.println("Load: OK");
  }

  display.display();

  // ── SERIAL MONITOR BACKUP
  Serial.print("A: Rs "); Serial.print(costA);
  Serial.print(" | B: Rs "); Serial.print(costB);
  Serial.print(" | Total: Rs "); Serial.print(totalCost);
  Serial.print(" | Proj/mo: Rs "); Serial.println(projectedMonthly);

  delay(1000);
}
