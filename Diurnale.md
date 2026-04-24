================================================================================
DIURNALE — PowerSplit Task Ledger
Repo: https://github.com/elPicar0/PowerSplit
================================================================================
Each member works independently. No task depends on another member's output.
When all 4 parts converge at Hour 5, the project is ready.

STATUS KEY:   [ ] = Not started   [/] = In progress   [x] = Done


════════════════════════════════════════════════════════════════════════════════
MEMBER 1 — FIRMWARE (The Code)
════════════════════════════════════════════════════════════════════════════════
Owns: PowerSplit.ino, Wokwi simulation, Arduino IDE

  [ ] Set up Wokwi project — FAST: import PowerSplit/diagram.json
      (or manually add ESP32 + OLED + 2 potentiometers)
  [ ] Paste PowerSplit.ino code into Wokwi editor
  [ ] Verify OLED boot screen appears ("POWER SPLIT — Zero Surprises v1.0")
  [ ] Test all 4 knob positions for User A (Phone → Ph+Fan → +Laptop → +AC)
  [ ] Test all 4 knob positions for User B (Phone → +Geyser → +TV → +AC)
  [ ] Verify device labels change correctly on OLED display
  [ ] Verify cost accumulates over time (watch Rs values tick up)
  [ ] Verify outage warning triggers when combined > 3000W
  [ ] Verify outage warning clears when load drops below 3000W
  [ ] Test monthly projection math (does it scale correctly?)
  [ ] Save Wokwi project link — share with team as backup demo
  [ ] If Arduino Uno is being used: change pin defines (34→A0, 35→A1)
      and change 4095.0 → 1023.0 (3 lines total)

  DELIVERABLE: Working Wokwi link + tested PowerSplit.ino file
  DEADLINE: End of Hour 4
  DEPENDS ON: Nobody. Code is already written in Creed.md Section 7.


════════════════════════════════════════════════════════════════════════════════
MEMBER 2 — HARDWARE (The Circuit)
════════════════════════════════════════════════════════════════════════════════
Owns: ESP32/Arduino, breadboard, OLED, potentiometers, wiring

  [ ] Collect all components (check with organizers for free parts first)
  [ ] Wire OLED to ESP32 (SDA→21, SCL→22, VCC→3.3V, GND→GND)
  [ ] Test OLED alone — upload a basic "Hello World" to confirm it works
  [ ] Wire Potentiometer 1 to GPIO 34 (Left→GND, Middle→34, Right→3.3V)
  [ ] Wire Potentiometer 2 to GPIO 35 (same pattern)
  [ ] Test pots alone — read analogRead() values on Serial Monitor
  [ ] Install Adafruit SSD1306 + Adafruit GFX libraries in Arduino IDE
  [ ] Upload PowerSplit.ino from Member 1's tested Wokwi version
  [ ] Verify real hardware matches Wokwi output exactly
  [ ] Run full demo sequence 3 times without crash or loose wire
  [ ] Secure all wires — no floating connections during demo

  DELIVERABLE: Working physical circuit matching Wokwi simulation
  DEADLINE: End of Hour 6
  DEPENDS ON: Nobody until Hour 5. Then gets final .ino from Member 1.

  TROUBLESHOOTING REFERENCE: Creed.md Section 10

  NOTE: If no hardware is available at all, this member joins Member 3
  on presentation prep. Wokwi becomes the primary demo.


════════════════════════════════════════════════════════════════════════════════
MEMBER 3 — PRESENTATION (The Pitch)
════════════════════════════════════════════════════════════════════════════════
Owns: Pitch script, slide deck (if any), demo choreography, judge Q&A prep

  [ ] Read Creed.md Section 8 (Demo Script) — memorize the flow
  [ ] Write opening question on a sticky note: "How many of you have felt
      your electricity bill was too high but had no way to prove it?"
  [ ] Write closing one-liner on a sticky note: "PowerSplit turns your
      electricity bill from a monthly surprise into a daily truth."
  [ ] Practice the 3-minute pitch OUT LOUD at least 3 times solo
  [ ] Time each practice run — must be under 4 minutes
  [ ] Prepare answers for likely judge questions:
      [ ] "Is this reading real power?" → See Creed.md Section 8
      [ ] "Why not just use a smart plug?" → "Smart plugs cost Rs 2000+
          each and don't split bills or show projections."
      [ ] "How would this scale?" → "WiFi-enabled ESP32 can push data
          to a cloud dashboard. This demo proves the core logic."
      [ ] "What about 3+ users?" → "Add more sensors on more analog pins.
          The math scales linearly."
  [ ] Decide who says what during the team demo:
      - Who opens? Who operates the knobs? Who does Q&A?
  [ ] If making slides: max 5 slides (Problem → Solution → Demo → Impact → Ask)
  [ ] Practice the full demo with Member 2's hardware (or Wokwi)
  [ ] Do a final dress rehearsal at Hour 6.5

  DELIVERABLE: Team can deliver pitch smoothly, handle any question
  DEADLINE: Continuous — final rehearsal at Hour 6.5
  DEPENDS ON: Nobody. Script is in Creed.md. Practice starts immediately.


════════════════════════════════════════════════════════════════════════════════
MEMBER 4 — SIMULATOR & DOCUMENTATION (The Web Demo)
════════════════════════════════════════════════════════════════════════════════
Owns: Web simulator (simulator/), Harbinger version (harbinger/), docs

  [ ] Test the slider-based simulator at http://127.0.0.1:8080/simulator/
      [ ] Verify device labels match Creed.md Section 3
      [ ] Verify outage warning fires at > 3000W combined
      [ ] Verify OLED canvas matches real device layout
      [ ] Verify monthly projection math
  [ ] Test the Harbinger version at http://127.0.0.1:8080/harbinger/
      [ ] Verify all appliance toggle buttons work
      [ ] Verify Common appliances split cost 50/50
      [ ] Verify outage banner appears at combined > 3000W
      [ ] Test multiple appliance combinations
  [ ] Fix any visual bugs or math errors found in testing
  [ ] Take screenshots of both simulators for slides (if Member 3 needs them)
  [ ] Keep Creed.md updated if any code changes happen
  [x] Prepare a README.md with:
      [x] What PowerSplit is (1 paragraph)
      [x] How to run the simulator (2 lines)
      [x] How to flash the Arduino (3 lines)
      [ ] Link to Wokwi project (add once created)
  [ ] Have simulator running on a laptop during demo as visual backup

  DELIVERABLE: Both simulators working, screenshots ready, docs clean
  DEADLINE: End of Hour 5
  DEPENDS ON: Nobody. All code is already written.


════════════════════════════════════════════════════════════════════════════════
TIMELINE — HOW THE 4 PARTS CONVERGE
════════════════════════════════════════════════════════════════════════════════

  Hour  | Member 1 (Code)    | Member 2 (HW)       | Member 3 (Pitch)  | Member 4 (Web/Docs)
  ------|--------------------|----------------------|-------------------|--------------------
   1    | Wokwi setup        | Collect parts        | Read script       | Test simulators
   2    | Test knob logic    | Wire OLED            | Practice solo     | Fix bugs
   3    | Test outage warn   | Wire potentiometers  | Practice solo     | Screenshots
   4    | Final Wokwi test   | Test serial readings | Prep Q&A          | Write README
   5    | Hand .ino to M2    | Upload final code    | Rehearse w/ demo  | Docs done
   6    | Support M2 debug   | Full demo test x3    | Dress rehearsal   | Backup laptop ready
   7    | STOP. Watch pitch. | STOP. Demo ready.    | DELIVER PITCH.    | STOP. Support.

  RULE: At Hour 7, everyone stops building. Period.
  The pitch is the product. The demo proves it. The build is just the tool.


================================================================================
No member waits for another. Everyone starts at Hour 0. Go.
================================================================================
