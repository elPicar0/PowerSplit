# ⚡ PowerSplit

**Transparent Electricity. Fair Bills. Zero Surprises.**

🔗 **Repo:** [github.com/elPicar0/PowerSplit](https://github.com/elPicar0/PowerSplit)

PowerSplit tracks electricity consumption per socket in real time, converts it to rupees, projects the monthly bill, and splits the cost fairly between flatmates — all on one small OLED screen.

> *"PowerSplit turns your electricity bill from a monthly surprise into a daily truth."*

---

## The Problem

250 million Indians live in rented homes. Almost none have transparent electricity billing.

| Problem | Who Faces It | Current "Solution" |
|---|---|---|
| Landlord charges arbitrary amounts | PG/hostel tenants | Pay blindly |
| Flatmates argue over shared bills | Shared apartments | Split equally (unfair) |
| Nobody knows daily spend until month end | Everyone | Nobody checks meter |
| Wrong devices kept on during outage | Everyone | Guesswork |

## The Solution

An ESP32 microcontroller with current sensors and an OLED display that:
- Reads power draw per socket in real time
- Shows cost in ₹ per user, updated every second
- Projects the end-of-month bill
- Warns when combined load risks an outage
- Costs less than ₹1,000 to build

---

## Repo Structure

```
├── Creed.md                    # Full project spec, wiring, demo script
├── Carta.md                    # Project index and code guide
├── Diurnale.md                 # Team task ledger (4 independent tracks)
├── wiring_diagram.png          # Visual wiring reference
├── favicon.svg                 # Browser tab icon
├── PowerSplit/
│   ├── PowerSplit.ino          # Arduino sketch (ESP32 / Arduino Uno)
│   └── diagram.json            # Wokwi pre-built circuit (import directly)
├── simulator/                  # Web simulator — slider version
│   ├── index.html
│   ├── style.css
│   └── app.js
└── harbinger/                  # Web simulator — toggle version (Harbinger)
    ├── index.html
    ├── style.css
    └── app.js
```

## Quick Start

### Run the Web Simulator
```bash
# Option 1: Open directly
open simulator/index.html

# Option 2: Serve locally (both versions)
npx -y http-server . -p 8080
# Slider version:  http://localhost:8080/simulator/
# Toggle version:  http://localhost:8080/harbinger/
```

### Flash the Arduino
1. Open `PowerSplit/PowerSplit.ino` in Arduino IDE
2. Install libraries: **Adafruit SSD1306** + **Adafruit GFX**
3. Select board: **ESP32 Dev Module** (or Arduino Uno)
4. Upload

### Test on Wokwi (no hardware needed)
1. Go to [wokwi.com](https://wokwi.com)
2. New Project → ESP32
3. Add: SSD1306 OLED + 2× Potentiometer
4. Paste code from `PowerSplit/PowerSplit.ino`
5. Hit Play

---

## Two Simulator Versions

### Simulator (Slider)
Knob-based simulation matching the physical potentiometer interface. Four discrete device combos per user.
- Live cost-over-time chart
- Download Bill as text file
- Outage alert sound

### Harbinger (Toggle)
Individual appliance toggle buttons with three categories:
- **User A** — Phone, Fan, Laptop, AC
- **User B** — Phone, Fan, Laptop, AC  
- **Common** — Geyser, TV, Washing Machine, Lights (cost split 50/50)
- Live chart, Download Bill, alert sound

---

## Hardware

| Component | Qty | Cost |
|---|---|---|
| ESP32 Dev Board | 1 | ₹400-600 |
| ACS712 Current Sensor 30A | 2 | ₹80-120 each |
| 0.96" OLED Display (SSD1306) | 1 | ₹150-200 |
| Breadboard + Jumper Wires | 1 set | ₹100-160 |
| 10K Potentiometer | 2 | ₹20-30 each |

**Total: ₹760 – ₹1,280**

See [Creed.md](Creed.md) for full wiring guide, troubleshooting, and demo script.

---

## Team

PESU Hackathon 2026 · PS-11 Open · Electrical Theme

See [Diurnale.md](Diurnale.md) for task assignments.
See [Carta.md](Carta.md) for full code guide and project index.

---

## License

MIT
