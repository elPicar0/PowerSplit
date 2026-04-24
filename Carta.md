================================================================================
CARTA — Project Index & Guide
PowerSplit · PESU Hackathon 2026
Repo: https://github.com/elPicar0/PowerSplit
================================================================================

This file explains what every file does, what every function does,
and how to navigate this repo. Read this first.


════════════════════════════════════════
HOW TO READ THIS REPO
════════════════════════════════════════

There are three documents that run this project:

  Document       | What it is                    | When to read it
  ---------------|-------------------------------|----------------------------------
  Carta.md       | You are here. The index.      | First. Understand the structure.
  Creed.md       | The full project spec.        | Second. Understand the product.
  Diurnale.md    | The team task ledger.         | Third. Know your job.

  Carta   = the map.
  Creed   = the blueprint.
  Diurnale = the checklist.


════════════════════════════════════════
FILE MAP
════════════════════════════════════════

  EEE Hackathon/
  │
  ├── README.md                 GitHub-facing intro. Quick start for anyone
  │                             who finds this repo. Links to everything.
  │
  ├── Carta.md                  This file. Project index and code guide.
  │
  ├── Creed.md                  Full specification. Contains:
  │                               §1  Problem statement
  │                               §2  Approach (Wokwi-first strategy)
  │                               §3  Device simulation mapping
  │                               §4  Hardware parts list + contingency
  │                               §5  Arduino Uno vs ESP32 differences
  │                               §6  Wiring guide (OLED, ACS712, pots)
  │                               §7  Code setup + Wokwi instructions
  │                               §8  Web simulator documentation
  │                               §9  Demo script (word-for-word)
  │                               §10 Build timeline (7-hour plan)
  │                               §11 Troubleshooting table
  │                               §12 Pitch one-liner
  │
  ├── Diurnale.md               Team task ledger. 4 independent tracks:
  │                               Member 1 — Firmware (Wokwi + .ino)
  │                               Member 2 — Hardware (wiring + circuit)
  │                               Member 3 — Presentation (pitch + Q&A)
  │                               Member 4 — Web/Docs (simulators + README)
  │                             Also contains the convergence timeline.
  │
  ├── .gitignore                Excludes: OS files, IDE configs, Arduino
  │                             build artifacts, node_modules, .zip files.
  │
  ├── PowerSplit/
  │   ├── PowerSplit.ino        The Arduino sketch. Single source of truth.
  │                             This is what gets flashed to the ESP32
  │                             and pasted into Wokwi.
  │   └── diagram.json          Pre-built Wokwi circuit layout.
  │                             Import into Wokwi to skip manual wiring.
  │
  ├── wiring_diagram.png        Visual wiring reference for Member 2.
  │
  ├── favicon.svg               Browser tab icon (purple ⚡ on square).
  │
  ├── simulator/                Web simulator — slider version.
  │   ├── index.html            Page structure and layout.
  │   ├── style.css             Dark theme, responsive design.
  │   └── app.js                Simulation engine, OLED renderer,
  │                             live chart, download bill, alert sound.
  │
  └── harbinger/                Web simulator — toggle version.
      ├── index.html            Page structure with appliance buttons.
      ├── style.css             Three-column layout for A / Common / B.
      └── app.js                Toggle-based engine with 50/50 split,
                                live chart, download bill, alert sound.


════════════════════════════════════════
PowerSplit.ino — CODE GUIDE
════════════════════════════════════════

The Arduino sketch. Runs on ESP32 or Arduino Uno.
Reads two potentiometers, maps knob position to appliance wattages,
accumulates energy over time, calculates cost, and displays on OLED.

SETTINGS (change these):
  tariffPerUnit     Rs per kWh. Default: 5.5 (Karnataka EB rate).
  simulationMode    true = potentiometer simulation (demo mode).
                    false = real ACS712 sensor (production mode).

PIN DEFINITIONS:
  SENSOR_A          GPIO 34 (ESP32) or A0 (Uno). User A input.
  SENSOR_B          GPIO 35 (ESP32) or A1 (Uno). User B input.
  OLED SDA          GPIO 21 (ESP32) or A4 (Uno). Hardwired in library.
  OLED SCL          GPIO 22 (ESP32) or A5 (Uno). Hardwired in library.

FUNCTIONS:

  getWattsA(raw)    Takes raw analog reading (0–4095).
                    Returns wattage based on knob position:
                      0–25%  →   5W   (Phone)
                      25–50% →  80W   (Phone + Fan)
                      50–75% → 145W   (Phone + Fan + Laptop)
                      75–100%→ 1645W  (Phone + Fan + Laptop + AC)

  getLabelA(raw)    Same thresholds as getWattsA.
                    Returns a short string for the OLED display:
                      "Phone", "Ph+Fan", "+Laptop", "+AC"

  getWattsB(raw)    Same pattern as A but different appliances:
                      0–25%  →    5W   (Phone)
                      25–50% → 2005W   (Phone + Geyser)
                      50–75% → 2105W   (Phone + Geyser + TV)
                      75–100%→ 3605W   (Everything + AC)

  getLabelB(raw)    Labels for B: "Phone", "+Geyser", "+TV", "+AC"

  setup()           Initializes serial, OLED display, shows boot screen.
                    Halts with error if OLED not found (check wiring).

  loop()            Runs every 1 second. Does this:
                      1. Read analog pins → get raw values
                      2. Map to watts via getWattsA/B (simulation)
                         or calculate from ACS712 voltage (real sensor)
                      3. Accumulate kWh: energy += (watts/1000) × hours
                      4. Calculate cost: energy × tariff
                      5. Project monthly: (cost/session_hours) × 720
                      6. Check outage: combined watts > 3000?
                      7. Render to OLED display
                      8. Print to Serial Monitor (backup output)

DISPLAY LAYOUT (128×64 OLED):
  Line 1 (y=0):    "== POWERSPLIT =="
  Line 2 (y=12):   "A:[label] Rs[cost]"
  Line 3 (y=22):   "B:[label] Rs[cost]"
  Divider (y=33):  Horizontal line
  Line 4 (y=37):   "Total: Rs [total]"
  Line 5 (y=47):   "Proj/mo: Rs [monthly]"
  Line 6 (y=57):   "Load: OK" or "!! CUT AC/GEYSER NOW"


════════════════════════════════════════
simulator/ — CODE GUIDE
════════════════════════════════════════

Browser-based simulator. Slider version matching the potentiometer
hardware interface. No dependencies. Pure HTML/CSS/JS.

--------------------------------------------
index.html
--------------------------------------------
Sections in order:
  Header            Logo, tagline, status pill, reset button
  OLED Preview      Canvas element (256×128) rendering SSD1306 output
  Controls          Two cards (User A, User B) with sliders
  Outage Banner     Hidden by default, shown when load > threshold
  Dashboard         4 cards: Total Cost, Projected Monthly, Fair Split, Load
  Settings          Tariff, time scale, outage threshold inputs
  Footer            Credit line

--------------------------------------------
style.css
--------------------------------------------
Design system:
  --bg              #0a0a0f (deep dark background)
  --surface         #12121a (card backgrounds)
  --surface2        #1a1a26 (nested elements)
  --accent-a        #6c5ce7 (purple — User A)
  --accent-b        #00cec9 (teal — User B)
  --yellow          #ffeaa7 (total cost)
  --red             #ff6b6b (outage warnings)
  --green           #55efc4 (status indicators)

Key features:
  Radial background gradients for subtle depth
  Gradient text on h1 (purple-to-teal)
  Glow effects on card hover (per-user color)
  Pulsing green status dot animation
  Pulsing red outage banner animation
  Cross-browser slider thumbs (webkit + moz)
  Responsive breakpoints at 768px and 480px

--------------------------------------------
app.js
--------------------------------------------
Runs as an IIFE. Updates at 100ms intervals (10 Hz).

  DEVICES_A[]       Array of 4 device tiers for User A.
                    Each: { threshold, watts, label, icon, desc }

  DEVICES_B[]       Same for User B.

  getDevice(pct, devices)
                    Takes slider percentage and device array.
                    Returns the matching device tier object.

  getTariff()       Reads tariff input from DOM.
  getTimeScale()    Reads time scale select from DOM.
  getOutageThreshold()  Reads outage threshold input from DOM.

  oledClear()       Fills canvas black.
  oledText(t,x,y,sz)  Renders monospace text in green (#33ff88)
                    at simulated SSD1306 coordinates. Scale factor 2×.
  oledLine(x0,y0,x1,y1)  Draws a green line on canvas.

  drawOLED(...)     Renders full OLED frame matching PowerSplit.ino
                    display layout exactly.

  tick()            Main loop. Called every 100ms.
                      1. Calculate scaled elapsed time
                      2. Get device from slider position
                      3. Accumulate kWh
                      4. Calculate costs and projection
                      5. Update all DOM elements
                      6. Update OLED canvas
                      7. Show/hide outage banner

  Reset button      Zeroes all accumulators, resets sliders to 0.

  Boot sequence     Shows "POWER SPLIT — Zero Surprises v1.0"
                    on canvas for 1.5s, then starts tick loop.


════════════════════════════════════════
harbinger/ — CODE GUIDE
════════════════════════════════════════

Browser-based simulator. Toggle version with individual appliance
buttons and a "Common" category for shared devices.

KEY DIFFERENCE FROM SIMULATOR:
  simulator/ uses sliders → discrete device combos (4 tiers)
  harbinger/ uses toggle buttons → any combination of appliances

--------------------------------------------
index.html
--------------------------------------------
Layout: 3-column panel grid (User A | Common | User B)
Each panel has:
  - Panel header with avatar
  - Appliance toggle buttons (built dynamically by JS)
  - Stats: Load (W), Energy (kWh), Cost (₹)

--------------------------------------------
style.css
--------------------------------------------
Extends the same design system as simulator/ with additions:
  --c               #fdcb6e (gold — Common category)
  .appliance-btn    Toggle button with iOS-style switch
  .appliance-btn.on Green border + green toggle knob
  3-column .panels  Responsive, collapses to 1-column on mobile

--------------------------------------------
app.js
--------------------------------------------

  USER_A_APPLIANCES[]   Personal devices for User A:
                        Phone (5W), Fan (75W), Laptop (65W), AC (1500W)

  USER_B_APPLIANCES[]   Personal devices for User B:
                        Phone (5W), Fan (75W), Laptop (65W), AC (1500W)

  COMMON_APPLIANCES[]   Shared devices (cost split 50/50):
                        Geyser (2000W), TV (100W),
                        Washing Machine (500W), Lights (60W)

  state{}               Object tracking on/off state for every appliance.
                        Key = appliance id, Value = boolean.

  buildGrid(container, appliances)
                        Dynamically creates toggle buttons in the DOM.
                        Attaches click handlers that flip state[id].

  sumWatts(appliances)  Sums wattage of all ON appliances in a category.

  activeNames(appliances)
                        Returns array of names of ON appliances.
                        Used for OLED display label rendering.

  tick()                Main loop (100ms). Same structure as simulator but:
                        - Reads toggle state instead of slider position
                        - Tracks 3 accumulators: unitsA, unitsB, unitsC
                        - Common cost split: costShareA = costA + (costC × 0.5)
                        - Combined load = wattsA + wattsB + wattsC

  COST SPLIT FORMULA:
    User A pays:  own personal cost  +  50% of common cost
    User B pays:  own personal cost  +  50% of common cost
    Total:        personal A + personal B + common (100%)


════════════════════════════════════════
QUICK REFERENCE — WHO READS WHAT
════════════════════════════════════════

  You are...             | Read these
  -----------------------|----------------------------------------
  New to the project     | Carta.md → Creed.md → Diurnale.md
  Member 1 (Firmware)    | Creed.md §3, §5, §7. PowerSplit.ino.
  Member 2 (Hardware)    | Creed.md §4, §6, §11. Diurnale.md M2.
  Member 3 (Pitch)       | Creed.md §1, §9, §12. Diurnale.md M3.
  Member 4 (Web/Docs)    | Carta.md sim/harbinger sections.
  Judge or visitor       | README.md.


================================================================================
Carta complete. Now go build.
================================================================================
