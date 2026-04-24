================================================================================
PESU HACKATHON 2026
POWERSPLIT — Transparent Electricity. Fair Bills. Zero Surprises.
Problem Statement: Open (PS-11) | Theme: Electrical | Duration: 7 Hours
Repo: https://github.com/elPicar0/PowerSplit
================================================================================


════════════════════════════════════════
1. THE PROBLEM STATEMENT
════════════════════════════════════════

In shared living spaces — PGs, hostels, rented flats — electricity is
completely invisible until it hurts. Tenants get arbitrary bills from
landlords with no way to verify them. Flatmates split costs equally
regardless of actual usage. And when power goes out, nobody knows which
devices matter most. PowerSplit brings electricity into the open —
tracking real-time cost per user, splitting bills fairly, and during
outages, showing exactly which devices are worth keeping on and for how
long. One device. Full visibility. Zero surprises.

THREE PROBLEMS. ONE DEVICE:

  Problem                                  | Who Faces It         | Current "Solution"
  -----------------------------------------|----------------------|--------------------
  Landlord charges arbitrary amounts        | PG/hostel tenants    | Pay blindly
  Flatmates argue over shared bills         | Shared apartments    | Split equally (unfair)
  Nobody knows daily spend until month end  | Everyone             | Nobody checks meter
  Wrong devices kept on during outage       | Everyone             | Guesswork


════════════════════════════════════════
2. THE APPROACH
════════════════════════════════════════

STEP 1 — BUILD AND TEST ON WOKWI FIRST (before touching any hardware)
  Wokwi is a free browser-based circuit simulator.
  URL: https://wokwi.com
  It has ESP32, OLED display, and potentiometers built in.
  Your actual code runs live inside it.

  Why Wokwi first:
  - Zero hardware needed to start
  - Get code working perfectly before touching real components
  - Save your Wokwi project link — this is your demo backup
  - If hardware fails on demo day, open Wokwi on laptop and demo there

STEP 2 — COPY TO REAL HARDWARE
  Once Wokwi simulation works, paste same code into Arduino IDE
  and upload to real ESP32 or Arduino. Should work immediately.

STEP 3 — DEMO
  Primary: real hardware with OLED display
  Backup: Wokwi running on laptop (fully valid, judges accept this)


════════════════════════════════════════
3. MULTIPLE DEVICE SIMULATION
════════════════════════════════════════

No extra hardware needed. It is just math.
Knob position maps to number of devices on — wattages are hardcoded.

USER A DEVICES:
  Knob 0-25%   = Phone charger only         (5W)
  Knob 25-50%  = Phone + Fan                (80W)
  Knob 50-75%  = Phone + Fan + Laptop       (145W)
  Knob 75-100% = Phone + Fan + Laptop + AC  (1645W)

USER B DEVICES:
  Knob 0-25%   = Phone charger only         (5W)
  Knob 25-50%  = Phone + Geyser             (2005W)
  Knob 50-75%  = Phone + Geyser + TV        (2105W)
  Knob 75-100% = Everything + AC            (3605W)

OUTAGE SIMULATION:
  When combined load crosses 3000W:
  - Display shows: !! CUT AC/GEYSER NOW
  - This is the "outage risk" moment in your demo
  - Turn a knob down, warning clears, backup power lasts longer


════════════════════════════════════════
4. HARDWARE
════════════════════════════════════════

COMPLETE PARTS LIST:

  Component                          | Qty | Purpose                          | Cost (approx)
  -----------------------------------|-----|----------------------------------|---------------
  ESP32 Development Board            |  1  | Brain — runs all logic           | Rs 400-600
  ACS712 Current Sensor 30A          |  2  | Measures current per user        | Rs 80-120 each
  0.96 inch OLED Display (I2C 4-pin) |  1  | Shows all readings               | Rs 150-200
  Full-size Breadboard (830 points)  |  1  | Holds everything, no soldering   | Rs 60-80
  Jumper Wires Male-Male             | 20  | Component connections            | Rs 50 (bundle)
  Jumper Wires Male-Female           | 20  | ESP32 to sensor/display          | Rs 50 (bundle)
  Potentiometer 10K ohm              |  2  | Simulates load per user          | Rs 20-30 each
  USB-A to Micro-USB Cable           |  1  | Powers ESP32                     | Rs 80 or use existing
  5V Phone Charger / Power Bank      |  1  | Power source (1A is enough)      | Rs 0 (use existing)

  TOTAL (simulation only):   Rs 760 - 960
  TOTAL (with real sensors): Rs 980 - 1280

  NOTE: If you already have an Arduino Uno, use it. No need to buy ESP32.
  See Section 5 for pin differences.

  TIP: Ask hackathon organizers first. ESP32, breadboard, and jumper
  wires are commonly provided at electrical hackathons.

CONTINGENCY PLAN:

  If unavailable           | Use instead              | Impact on demo
  -------------------------|--------------------------|----------------------------------
  ACS712 sensor            | Potentiometer (knob)     | Simulate load by turning knob
  OLED display             | Wokwi on laptop          | Actually looks cleaner
  Real hardware entirely   | Wokwi on laptop          | Fully valid demo
  ESP32                    | Arduino Uno              | See Section 5 for changes
  Breadboard               | Hand-wire carefully      | Messy but functional


════════════════════════════════════════
5. ARDUINO UNO vs ESP32 DIFFERENCES
════════════════════════════════════════

  Thing                  | ESP32           | Arduino Uno
  -----------------------|-----------------|-------------
  Analog pins            | GPIO 34, 35     | A0, A1
  Analog read max value  | 4095            | 1023
  OLED SDA pin           | GPIO 21         | A4
  OLED SCL pin           | GPIO 22         | A5
  Board in IDE           | ESP32 Dev Mod   | Arduino Uno
  WiFi                   | Built in        | Not available

CODE CHANGES FOR ARDUINO UNO (only 3 lines):

  Change:
    #define SENSOR_A 34
    #define SENSOR_B 35
    (raw / 4095.0)

  To:
    #define SENSOR_A A0
    #define SENSOR_B A1
    (raw / 1023.0)

  Everything else stays identical.


════════════════════════════════════════
6. WIRING GUIDE
════════════════════════════════════════

!!! IMPORTANT BEFORE YOU WIRE ANYTHING !!!
  - Do NOT connect to mains (wall socket) power during the hackathon
  - Power ESP32 only via USB from laptop or power bank
  - ACS712 clamps around a wire — does not touch live current directly
  - If using potentiometer simulation, skip ACS712 wiring entirely

--------------------------------------------
6.1 OLED DISPLAY to ESP32
--------------------------------------------

  OLED Pin | ESP32 Pin | Wire Color (suggested)
  ---------|-----------|------------------------
  VCC      | 3.3V      | Red
  GND      | GND       | Black
  SCL      | GPIO 22   | Yellow
  SDA      | GPIO 21   | Blue

--------------------------------------------
6.2 ACS712 SENSOR to ESP32 (do this twice, once per user)
--------------------------------------------

  ACS712 Pin | ESP32 Pin          | Notes
  -----------|--------------------|----------------------------
  VCC        | 5V (VIN on ESP32)  | Must be 5V not 3.3V
  GND        | GND                | Common ground
  OUT        | GPIO 34 (User A)   | Analog read pin
  OUT        | GPIO 35 (User B)   | Second user's socket

--------------------------------------------
6.3 POTENTIOMETER to ESP32 (simulation mode)
--------------------------------------------

  Pot Pin              | ESP32 Pin          | Notes
  ---------------------|--------------------|--------------------------
  Left leg             | GND                |
  Middle leg (wiper)   | GPIO 34 (User A)   | This gives analog reading
  Right leg            | 3.3V               |
  Second pot middle    | GPIO 35 (User B)   | Repeat for second user

A visual wiring diagram is included: wiring_diagram.png


════════════════════════════════════════
7. CODE
════════════════════════════════════════

Full source code is in: PowerSplit/PowerSplit.ino
Copy into Arduino IDE or paste into Wokwi editor.
Board setting: Tools > Board > ESP32 Dev Module

--------------------------------------------
7.1 INSTALL THESE LIBRARIES FIRST
--------------------------------------------
Go to: Tools > Manage Libraries, search and install:
  - Adafruit SSD1306
  - Adafruit GFX Library
  (Wire is built-in, no install needed)

  In Wokwi: libraries are pre-installed, no action needed.

--------------------------------------------
7.2 SWITCHING MODES
--------------------------------------------

  bool simulationMode = true;   // potentiometer + device labels
  bool simulationMode = false;  // real ACS712 sensor

Change this one line in PowerSplit.ino. Nothing else changes.

--------------------------------------------
7.3 SETTING UP ON WOKWI
--------------------------------------------

1. Go to https://wokwi.com
2. Click New Project > ESP32
3. Add components from parts panel:
   - Search "oled" — add SSD1306 display
   - Add Potentiometer x2
4. Wire exactly as per Section 6
5. Paste full code from PowerSplit/PowerSplit.ino into the editor
6. Click Play — simulation runs live
7. Turn the virtual knobs — display updates in real time
8. Save your project link — this is your demo backup

FAST SETUP: A pre-built diagram.json is included in the PowerSplit/ folder.
Import it directly into Wokwi to skip manual component placement.


════════════════════════════════════════
8. WEB SIMULATORS
════════════════════════════════════════

Two browser-based simulators are included for testing logic
without hardware and as visual demo backups.

--------------------------------------------
8.1 SIMULATOR (Slider Version)
--------------------------------------------
Location: simulator/
Run: open simulator/index.html in any browser, or serve with any HTTP server.

Features:
  - Two sliders simulating potentiometer knobs (User A and User B)
  - Discrete device steps matching Section 3 (Phone → Fan → Laptop → AC)
  - OLED display canvas preview (pixel-perfect SSD1306 rendering)
  - Live cost, energy, and monthly projection
  - Outage warning when combined load > 3000W
  - Fair split bar showing cost percentage per user
  - Time scaling (up to 3600× for fast demo)
  - Live cost-over-time chart (dual line graph)
  - Download Bill button (exports formatted text receipt)
  - Outage alert sound (two-tone beep via Web Audio API)
  - Favicon with PowerSplit branding

--------------------------------------------
8.2 HARBINGER (Toggle Version)
--------------------------------------------
Location: harbinger/
Run: open harbinger/index.html in any browser, or serve with any HTTP server.

Features:
  - Individual appliance toggle buttons (not sliders)
  - Any combination of devices can be turned on/off independently
  - Three categories:
      User A personal:  Phone (5W), Fan (75W), Laptop (65W), AC (1500W)
      User B personal:  Phone (5W), Fan (75W), Laptop (65W), AC (1500W)
      Common (50/50):   Geyser (2000W), TV (100W), Washing Machine (500W), Lights (60W)
  - Common appliance costs are automatically split 50/50 between users
  - Outage warning banner at combined load > 3000W
  - OLED display canvas preview
  - Live cost-over-time chart (3 lines: A total, B total, Common)
  - Download Bill button (exports detailed breakdown with common split)
  - Outage alert sound (two-tone beep)
  - Favicon with PowerSplit branding


════════════════════════════════════════
9. DEMO SCRIPT
════════════════════════════════════════

Target: 3-4 minutes total. Practice at least 3 times before presenting.
Primary demo: real hardware. Backup: Wokwi on laptop.

--------------------------------------------
OPENING (30 seconds)
--------------------------------------------
Say:
  "Quick question — how many of you have ever felt your electricity
  bill was too high but had no way to prove it?"

  (pause)

  "That's the problem we solved. This is PowerSplit."

--------------------------------------------
PROBLEM (30 seconds)
--------------------------------------------
Say:
  "If you're a tenant in a PG, your landlord tells you a number.
  You pay it. No way to verify. If you're sharing a flat, you split
  equally even if one person uses twice as much. And when power goes
  out, nobody knows what to switch off first. PowerSplit fixes all three."

--------------------------------------------
HARDWARE DEMO (60-90 seconds)
--------------------------------------------
Step 1:
  "This is PowerSplit. Two knobs — two flatmates."

Step 2 — both knobs low:
  "Both users have just their phones charging. Cost is minimal."

Step 3 — turn Knob A to 75%:
  "User A switches on the fan and laptop."
  (display shows label change and cost jump)

Step 4 — turn Knob B to 50%:
  "User B turns on the geyser."
  (cost jumps sharply)

Step 5 — point to projection:
  "Monthly projection is already Rs 1,800. Live. Every second."

Step 6 — turn both to 100%:
  "Both ACs on."
  (display shows: !! CUT AC/GEYSER NOW)
  "System tells you exactly what to cut — not everything, just
  the right things."

Step 7 — turn Knob B down:
  "User B switches off the geyser. Warning clears. And the bill
  split is already calculated. No argument at month end."

--------------------------------------------
IMPACT (30 seconds)
--------------------------------------------
Say:
  "250 million Indians live in rented homes. Almost none have
  transparent electricity billing. PowerSplit gives them evidence,
  gives them fairness, and costs less than Rs 1,000 to build."

--------------------------------------------
IF JUDGE ASKS: "Is this reading real power?"
--------------------------------------------
Say:
  "This demo uses simulated loads mapped to real appliance wattages.
  The ACS712 sensor integration is in our code — switching to real
  sensor mode is a single line change."

--------------------------------------------
IF HARDWARE FAILS — SWITCH TO WOKWI
--------------------------------------------
Say:
  "Let me show you the simulation we built to validate this."
  Open saved Wokwi project on laptop. Demo continues identically.


════════════════════════════════════════
10. 7-HOUR BUILD TIMELINE
════════════════════════════════════════

  Hour | Task                                          | Done When
  -----|-----------------------------------------------|---------------------------
   1   | Set up Wokwi. Add ESP32 + OLED + 2 pots.     | Components on canvas
       | Install Arduino IDE + libraries on laptop.    | IDE open, libraries in
  -----|-----------------------------------------------|---------------------------
   2   | Wire OLED in Wokwi. Paste code. Run it.      | Text on Wokwi display
  -----|-----------------------------------------------|---------------------------
   3   | Test knob positions. Check device labels      | Labels and cost change
       | and cost math in simulation.                  | correctly with knob
  -----|-----------------------------------------------|---------------------------
   4   | Test outage warning. Check all transitions.   | !! warning appears at
       |                                               | high load
  -----|-----------------------------------------------|---------------------------
   5   | Move to real hardware. Wire OLED to ESP32.    | Same output on real OLED
       | Upload code. Match Wokwi behaviour.           |
  -----|-----------------------------------------------|---------------------------
   6   | Wire potentiometers. Run full demo 3 times.   | Demo runs without issues
  -----|-----------------------------------------------|---------------------------
   7   | STOP BUILDING. Practice pitch out loud.       | Team confident,
       | Keep Wokwi open as backup on laptop.          | no hesitation

  GOLDEN RULE FOR HOUR 7:
  Stop building. Start practicing.
  A working simple demo beats a broken complex one every time.


════════════════════════════════════════
11. TROUBLESHOOTING
════════════════════════════════════════

  Problem                    | Likely Cause           | Fix
  ---------------------------|------------------------|------------------------------
  OLED shows nothing         | Wrong I2C address      | Change 0x3C to 0x3D in code
  OLED shows garbage         | Loose SDA/SCL wire     | Re-seat on GPIO 21 and 22
  Sensor reads 0 always      | Wrong analog pin       | Use only 34, 35, 36, 39
  Device label not changing  | Pot wired to 5V        | Wire pot right leg to 3.3V
  Cost not changing          | Wrong simulation mode  | Check simulationMode line
  ESP32 not detected by PC   | Missing driver         | Install CP2102 driver
  Upload fails               | Wrong board selected   | Tools > ESP32 Dev Module
  Numbers jumping wildly     | Floating analog pin    | Add 10K resistor pin to GND
  Wokwi code not running     | Component wiring wrong | Check OLED and pot wiring


════════════════════════════════════════
12. PITCH ONE-LINER
════════════════════════════════════════

  "PowerSplit turns your electricity bill from a monthly surprise
   into a daily truth."

Use this to open. Use this to close.


================================================================================
Good luck. Build clean. Pitch hard.
================================================================================