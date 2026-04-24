/*
 * ═══════════════════════════════════════════════════════════════
 * POWERSPLIT — Transparent Electricity. Fair Bills. Zero Surprises.
 * ═══════════════════════════════════════════════════════════════
 * 
 * PESU Hackathon 2026 | PS-11 Open | Electrical Theme
 * 
 * Hardware:
 *   - ESP32 Dev Module (or Arduino Uno — see pin notes)
 *   - 2x ACS712 30A Current Sensors (or 2x 10K Potentiometers)
 *   - 0.96" OLED Display (SSD1306, I2C)
 * 
 * Wiring (ESP32):
 *   OLED SDA  → GPIO 21    (Uno: A4)
 *   OLED SCL  → GPIO 22    (Uno: A5)
 *   OLED VCC  → 3.3V
 *   OLED GND  → GND
 *   Sensor A  → GPIO 34    (Uno: A0)
 *   Sensor B  → GPIO 35    (Uno: A1)
 * 
 * For Arduino Uno: change pin defines and 4095.0 → 1023.0
 * 
 * Libraries needed (install via Library Manager):
 *   - Adafruit SSD1306
 *   - Adafruit GFX Library
 *   In Wokwi: libraries are pre-installed, no action needed.
 * 
 * Board: Tools > Board > ESP32 Dev Module
 * Also paste into Wokwi editor for simulation testing.
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ── DISPLAY SETUP ──────────────────────────────────────────────
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ── PIN DEFINITIONS (ESP32)
// For Arduino Uno: change 34 to A0, change 35 to A1
#define SENSOR_A 34
#define SENSOR_B 35

// ── SETTINGS ───────────────────────────────────────────────────
float tariffPerUnit = 5.5;   // Rs per kWh (Karnataka EB rate)
bool simulationMode = true;  // true = potentiometer + device labels
                              // false = real ACS712 sensor

// ── TRACKING VARIABLES ────────────────────────────────────────
float totalUnitsA = 0;       // Accumulated kWh for User A
float totalUnitsB = 0;       // Accumulated kWh for User B
unsigned long lastTime = 0;  // Last loop timestamp

// ── DEVICE WATTAGE — USER A ───────────────────────────────────
// Knob 0-25%   = Phone charger only         (5W)
// Knob 25-50%  = Phone + Fan                (80W)
// Knob 50-75%  = Phone + Fan + Laptop       (145W)
// Knob 75-100% = Phone + Fan + Laptop + AC  (1645W)
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

// ── DEVICE WATTAGE — USER B ───────────────────────────────────
// Knob 0-25%   = Phone charger only         (5W)
// Knob 25-50%  = Phone + Geyser             (2005W)
// Knob 50-75%  = Phone + Geyser + TV        (2105W)
// Knob 75-100% = Everything + AC            (3605W)
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

// ── SETUP ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("PowerSplit starting...");

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("Display not found — check wiring");
    Serial.println("SDA->21, SCL->22, VCC->3.3V");
    Serial.println("Try changing address to 0x3D");
    while (true); // Halt
  }

  display.clearDisplay();
  display.setTextColor(WHITE);

  // Boot screen
  display.setTextSize(2);
  display.setCursor(10, 10);
  display.println("POWER");
  display.setCursor(20, 30);
  display.println("SPLIT");
  display.setTextSize(1);
  display.setCursor(8, 52);
  display.println("Zero Surprises v1.0");
  display.display();
  delay(2000);

  lastTime = millis();

  Serial.println("PowerSplit ready.");
  Serial.println(simulationMode ? "Mode: SIMULATION (potentiometer + device labels)"
                                : "Mode: REAL SENSOR (ACS712)");
}

// ── MAIN LOOP ──────────────────────────────────────────────────
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
    // ACS712 30A: sensitivity = 66mV/A, midpoint = 2.5V
    float vA = (rawA / 4095.0) * 3.3;
    float vB = (rawB / 4095.0) * 3.3;
    float iA = abs((vA - 2.5) / 0.066);
    float iB = abs((vB - 2.5) / 0.066);
    wattsA = iA * 230.0;
    wattsB = iB * 230.0;
  }

  // Accumulate energy in kWh
  totalUnitsA += (wattsA / 1000.0) * elapsed;
  totalUnitsB += (wattsB / 1000.0) * elapsed;

  // Calculate costs
  float costA = totalUnitsA * tariffPerUnit;
  float costB = totalUnitsB * tariffPerUnit;
  float totalCost = costA + costB;
  float totalWatts = wattsA + wattsB;

  // Project to monthly bill
  float sessionHours = now / 3600000.0;
  float projectedMonthly = (sessionHours > 0)
    ? (totalCost / sessionHours) * 24 * 30 : 0;

  bool outageRisk = totalWatts > 3000;

  // ── DISPLAY ──────────────────────────────────────────────────
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

  // Serial Monitor backup output
  Serial.print("A: Rs "); Serial.print(costA);
  Serial.print(" | B: Rs "); Serial.print(costB);
  Serial.print(" | Total: Rs "); Serial.print(totalCost);
  Serial.print(" | Proj/mo: Rs "); Serial.println(projectedMonthly);

  delay(1000);
}
