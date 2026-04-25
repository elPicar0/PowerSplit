/*
 * ═══════════════════════════════════════════════════════════════
 * POWERSPLIT — Transparent Electricity. Fair Bills. Zero Surprises.
 * ═══════════════════════════════════════════════════════════════
 * 
 * PESU Hackathon 2026 | PS-11 Open | Electrical Theme
 * 
 * Hardware:
 *   - ESP32 Dev Module (or Arduino Uno — see pin notes)
 *   - 2x 10K Potentiometers (simulate load per user)
 *   - 1x ACS712 30A Current Sensor (real mode only)
 *   - 0.96" OLED Display (SSD1306, I2C)
 * 
 * Wiring (ESP32):
 *   OLED SDA  → GPIO 21    (Uno: A4)
 *   OLED SCL  → GPIO 22    (Uno: A5)
 *   OLED VCC  → 3.3V
 *   OLED GND  → GND
 *   Pot A SIG → GPIO 34    (User A knob)
 *   Pot B SIG → GPIO 35    (User B knob)
 *   ACS712 OUT→ GPIO 32    (real current sensor, optional)
 *   ACS712 VCC→ VCC (3.3V on ESP32)
 *   ACS712 GND→ GND
 * 
 * For Arduino Uno: change pin defines and 4095.0 → 1023.0
 * 
 * Libraries needed (install via Library Manager):
 *   - Adafruit SSD1306
 *   - Adafruit GFX Library
 *   In Wokwi: libraries are pre-installed, no action needed.
 * 
 * Board: Tools > Board > ESP32 Dev Module
 * 
 * SERIAL OUTPUT FORMAT (JSON, one line per second):
 *   {"A":1024,"B":3200,"wA":80,"wB":2105,"cA":1.23,"cB":4.56,
 *    "tot":5.79,"proj":1234,"out":0,"lA":"Ph+Fan","lB":"+Geyser",
 *    "acs":0.45,"tW":2185}
 * 
 * The web dashboard (simulator/app.js) reads this via Web Serial API.
 * When hardware is connected, the dashboard displays these values directly.
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ── DISPLAY SETUP ──────────────────────────────────────────────
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ── PIN DEFINITIONS (ESP32)
// For Arduino Uno: change 34→A0, 35→A1, 32→A2
#define POT_A    34   // Potentiometer A signal (User A)
#define POT_B    35   // Potentiometer B signal (User B)
#define ACS_PIN  32   // ACS712 current sensor output

// ── SETTINGS ───────────────────────────────────────────────────
float tariffPerUnit = 5.5;   // Rs per kWh (Karnataka EB rate)
bool  simulationMode = true; // true  = pots + device-label mapping
                              // false = pots + ACS712 real current

// ACS712 30A calibration
// Sensitivity: 66mV/A, midpoint: ~1.65V on 3.3V supply (or 2.5V on 5V)
// Adjust ACS_MIDPOINT based on your wiring voltage
#define ACS_SENSITIVITY 0.066  // V per Amp
#define ACS_MIDPOINT    1.65   // midpoint voltage (3.3V supply / 2)
#define MAINS_VOLTAGE   230.0  // India standard

// Outage threshold
#define OUTAGE_THRESHOLD 3000  // Watts

// ── TRACKING VARIABLES ────────────────────────────────────────
float totalUnitsA = 0;       // Accumulated kWh for User A
float totalUnitsB = 0;       // Accumulated kWh for User B
unsigned long lastTime = 0;  // Last loop timestamp
float lastAcsAmps = 0;       // Last ACS712 reading (for display)

// ── DEVICE WATTAGE — USER A ───────────────────────────────────
// Knob 0-25%   = Phone charger only         (5W)
// Knob 25-50%  = Phone + Fan                (80W)
// Knob 50-75%  = Phone + Fan + Laptop       (145W)
// Knob 75-100% = Phone + Fan + Laptop + AC  (1645W)
float getWattsA(int raw) {
  float pct = raw / 4095.0;
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

// ── ACS712 READING ────────────────────────────────────────────
// Returns current in Amps (absolute value)
float readACS712() {
  // Average 20 samples for stability
  long sum = 0;
  for (int i = 0; i < 20; i++) {
    sum += analogRead(ACS_PIN);
    delayMicroseconds(100);
  }
  float avgRaw = sum / 20.0;
  float voltage = (avgRaw / 4095.0) * 3.3;
  float amps = abs((voltage - ACS_MIDPOINT) / ACS_SENSITIVITY);
  // Filter noise: if below 0.1A, treat as zero
  if (amps < 0.1) amps = 0;
  return amps;
}

// ── SETUP ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // Wait a moment for Serial to initialize
  delay(100);
  Serial.println("{\"status\":\"booting\"}");

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("{\"error\":\"OLED not found. Check SDA->21, SCL->22\"}");
    // Try alternate address
    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3D)) {
      Serial.println("{\"error\":\"OLED not found on 0x3D either. Halting.\"}");
      while (true); // Halt
    }
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
  display.println("Zero Surprises v2.0");
  display.display();
  delay(2000);

  lastTime = millis();

  Serial.print("{\"status\":\"ready\",\"mode\":\"");
  Serial.print(simulationMode ? "simulation" : "sensor");
  Serial.println("\"}");
}

// ── MAIN LOOP ──────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();
  float elapsed = (now - lastTime) / 3600000.0;
  lastTime = now;

  // Read potentiometers
  int rawA = analogRead(POT_A);
  int rawB = analogRead(POT_B);

  float wattsA, wattsB;
  String labelA, labelB;

  if (simulationMode) {
    // Pot-based device simulation
    wattsA = getWattsA(rawA);
    wattsB = getWattsB(rawB);
    labelA = getLabelA(rawA);
    labelB = getLabelB(rawB);
  } else {
    // Real current sensing via ACS712
    // Pots still read for device-label display
    labelA = getLabelA(rawA);
    labelB = getLabelB(rawB);

    // Read real current from ACS712
    lastAcsAmps = readACS712();
    float totalRealWatts = lastAcsAmps * MAINS_VOLTAGE;

    // Split real power proportionally based on pot positions
    // This lets the pots act as "which user is using what" indicators
    // while ACS712 reads actual total current
    float potSum = (float)rawA + (float)rawB;
    if (potSum > 0) {
      wattsA = totalRealWatts * (rawA / potSum);
      wattsB = totalRealWatts * (rawB / potSum);
    } else {
      wattsA = 0;
      wattsB = 0;
    }
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

  bool outageRisk = totalWatts > OUTAGE_THRESHOLD;

  // ── OLED DISPLAY ────────────────────────────────────────────
  display.clearDisplay();
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.println("== POWERSPLIT ==");

  display.setCursor(0, 12);
  display.print("A:");
  display.print(labelA);
  display.print(" Rs");
  display.println(costA, 1);

  display.setCursor(0, 22);
  display.print("B:");
  display.print(labelB);
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

  // ── JSON SERIAL OUTPUT (for Web Dashboard) ──────────────────
  // One JSON line per second. The web frontend reads via Web Serial API.
  // Fields:
  //   A, B     = raw pot ADC (0–4095) — dashboard uses for its own mapping
  //   wA, wB   = computed watts per channel
  //   cA, cB   = cost per user (Rs)
  //   tot      = total cost (Rs)
  //   proj     = projected monthly bill (Rs)
  //   out      = outage flag (0 or 1)
  //   lA, lB   = device label per channel
  //   tW       = total watts
  //   acs      = ACS712 amps reading (0 in simulation mode)
  //   eA, eB   = energy kWh per user

  Serial.print("{\"A\":");
  Serial.print(rawA);
  Serial.print(",\"B\":");
  Serial.print(rawB);
  Serial.print(",\"wA\":");
  Serial.print(wattsA, 0);
  Serial.print(",\"wB\":");
  Serial.print(wattsB, 0);
  Serial.print(",\"cA\":");
  Serial.print(costA, 2);
  Serial.print(",\"cB\":");
  Serial.print(costB, 2);
  Serial.print(",\"tot\":");
  Serial.print(totalCost, 2);
  Serial.print(",\"proj\":");
  Serial.print(projectedMonthly, 0);
  Serial.print(",\"out\":");
  Serial.print(outageRisk ? 1 : 0);
  Serial.print(",\"tW\":");
  Serial.print(totalWatts, 0);
  Serial.print(",\"acs\":");
  Serial.print(simulationMode ? 0 : lastAcsAmps, 2);
  Serial.print(",\"eA\":");
  Serial.print(totalUnitsA, 4);
  Serial.print(",\"eB\":");
  Serial.print(totalUnitsB, 4);
  Serial.print(",\"lA\":\"");
  Serial.print(labelA);
  Serial.print("\",\"lB\":\"");
  Serial.print(labelB);
  Serial.println("\"}");

  delay(1000);
}
