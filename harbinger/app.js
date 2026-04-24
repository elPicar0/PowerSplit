(() => {
  'use strict';

  // ── APPLIANCE DEFINITIONS ──────────────────────────────────
  const USER_A_APPLIANCES = [
    { id: 'a_phone',  name: 'Phone Charger', watts: 5,    icon: '📱' },
    { id: 'a_fan',    name: 'Fan',           watts: 75,   icon: '🌀' },
    { id: 'a_laptop', name: 'Laptop',        watts: 65,   icon: '💻' },
    { id: 'a_ac',     name: 'AC',            watts: 1500, icon: '❄️' },
  ];

  const USER_B_APPLIANCES = [
    { id: 'b_phone',  name: 'Phone Charger', watts: 5,    icon: '📱' },
    { id: 'b_fan',    name: 'Fan',           watts: 75,   icon: '🌀' },
    { id: 'b_laptop', name: 'Laptop',        watts: 65,   icon: '💻' },
    { id: 'b_ac',     name: 'AC',            watts: 1500, icon: '❄️' },
  ];

  const COMMON_APPLIANCES = [
    { id: 'c_geyser',  name: 'Geyser',          watts: 2000, icon: '🚿' },
    { id: 'c_tv',      name: 'TV',              watts: 100,  icon: '📺' },
    { id: 'c_washer',  name: 'Washing Machine', watts: 500,  icon: '👕' },
    { id: 'c_light',   name: 'Common Lights',   watts: 60,   icon: '💡' },
  ];

  // ── STATE ──────────────────────────────────────────────────
  const state = {};
  let unitsA = 0, unitsB = 0, unitsC = 0;
  let sessionStart = Date.now(), lastTick = Date.now();
  let lastChartUpdate = 0, wasOutage = false;

  const MAX_CHART_POINTS = 200;
  let chartA = [], chartB = [], chartC = [];

  const $ = id => document.getElementById(id);
  const canvas = $('oledCanvas');
  const ctx = canvas.getContext('2d');
  const chartCanvas = $('chartCanvas');
  const chartCtx = chartCanvas.getContext('2d');

  // ── AUDIO (outage alert) ───────────────────────────────────
  let audioCtx = null;
  function playAlert() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      [520, 680].forEach(function(freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.value = freq; osc.type = 'square'; gain.gain.value = 0.08;
        osc.start(audioCtx.currentTime + i * 0.15);
        osc.stop(audioCtx.currentTime + i * 0.15 + 0.12);
      });
    } catch(e) {}
  }

  // ── BUILD TOGGLE BUTTONS ──────────────────────────────────
  function buildGrid(container, appliances) {
    var grid = $(container);
    appliances.forEach(function(ap) {
      state[ap.id] = false;
      var btn = document.createElement('div');
      btn.className = 'appliance-btn';
      btn.dataset.id = ap.id;
      btn.innerHTML =
        '<span class="a-icon">' + ap.icon + '</span>' +
        '<div class="a-info"><div class="a-name">' + ap.name + '</div>' +
        '<div class="a-watts">' + ap.watts + 'W</div></div>' +
        '<div class="a-toggle"></div>';
      btn.addEventListener('click', function() {
        state[ap.id] = !state[ap.id];
        btn.classList.toggle('on', state[ap.id]);
      });
      grid.appendChild(btn);
    });
  }

  buildGrid('gridA', USER_A_APPLIANCES);
  buildGrid('gridB', USER_B_APPLIANCES);
  buildGrid('gridCommon', COMMON_APPLIANCES);

  // ── HELPERS ────────────────────────────────────────────────
  function sumWatts(appliances) {
    var w = 0;
    appliances.forEach(function(ap) { if (state[ap.id]) w += ap.watts; });
    return w;
  }

  function activeNames(appliances) {
    var names = [];
    appliances.forEach(function(ap) { if (state[ap.id]) names.push(ap.name); });
    return names.length > 0 ? names : ['(none)'];
  }

  // ── OLED ───────────────────────────────────────────────────
  var S = 2, FH = 8 * S;
  function oledClear() { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 128); }
  function oledText(t, x, y, sz) {
    sz = sz || 1;
    ctx.fillStyle = '#33ff88';
    ctx.font = 'bold ' + (FH * sz) + 'px "JetBrains Mono",monospace';
    ctx.fillText(t, x * S, (y + 7 * sz) * S);
  }
  function oledLine(x0, y0, x1, y1) {
    ctx.strokeStyle = '#33ff88'; ctx.lineWidth = S;
    ctx.beginPath(); ctx.moveTo(x0 * S, y0 * S); ctx.lineTo(x1 * S, y1 * S); ctx.stroke();
  }

  // ── CHART ──────────────────────────────────────────────────
  function drawChart() {
    var w = chartCanvas.width, h = chartCanvas.height;
    chartCtx.clearRect(0, 0, w, h);
    if (chartA.length < 2) return;

    var maxVal = 0.01;
    for (var i = 0; i < chartA.length; i++) {
      if (chartA[i] > maxVal) maxVal = chartA[i];
      if (chartB[i] > maxVal) maxVal = chartB[i];
    }
    maxVal *= 1.15;

    // Grid
    chartCtx.strokeStyle = 'rgba(255,255,255,0.06)'; chartCtx.lineWidth = 1;
    for (var g = 1; g <= 4; g++) {
      var gy = h - (g / 5) * h;
      chartCtx.beginPath(); chartCtx.moveTo(0, gy); chartCtx.lineTo(w, gy); chartCtx.stroke();
      chartCtx.fillStyle = 'rgba(255,255,255,0.2)';
      chartCtx.font = '10px "JetBrains Mono",monospace';
      chartCtx.fillText('₹' + (maxVal * g / 5).toFixed(1), 4, gy - 3);
    }

    var step = w / (MAX_CHART_POINTS - 1);
    function drawLine(data, color) {
      chartCtx.strokeStyle = color; chartCtx.lineWidth = 2; chartCtx.beginPath();
      for (var j = 0; j < data.length; j++) {
        var x = j * step, y = h - (data[j] / maxVal) * h;
        if (j === 0) chartCtx.moveTo(x, y); else chartCtx.lineTo(x, y);
      }
      chartCtx.stroke();
      chartCtx.globalAlpha = 0.15; chartCtx.lineWidth = 6; chartCtx.beginPath();
      for (var j = 0; j < data.length; j++) {
        var x = j * step, y = h - (data[j] / maxVal) * h;
        if (j === 0) chartCtx.moveTo(x, y); else chartCtx.lineTo(x, y);
      }
      chartCtx.stroke(); chartCtx.globalAlpha = 1;
    }

    drawLine(chartA, '#6c5ce7');
    drawLine(chartC, '#fdcb6e');
    drawLine(chartB, '#00cec9');
  }

  // ── DOWNLOAD BILL ──────────────────────────────────────────
  $('downloadBill').addEventListener('click', function() {
    var tariff = parseFloat($('tariff').value) || 5.5;
    var costOwnA = unitsA * tariff, costOwnB = unitsB * tariff;
    var costCommon = unitsC * tariff;
    var shareA = costOwnA + costCommon * 0.5;
    var shareB = costOwnB + costCommon * 0.5;
    var total = costOwnA + costOwnB + costCommon;
    var now = new Date();

    var bill = '═══════════════════════════════════════\n';
    bill += '  POWERSPLIT HARBINGER — BILL SUMMARY\n';
    bill += '═══════════════════════════════════════\n\n';
    bill += '  Date: ' + now.toLocaleDateString('en-IN') + '\n';
    bill += '  Time: ' + now.toLocaleTimeString('en-IN') + '\n';
    bill += '  Tariff: Rs ' + tariff.toFixed(2) + '/kWh\n\n';
    bill += '───────────────────────────────────────\n';
    bill += '  USER A (Personal)\n';
    bill += '  Devices: ' + activeNames(USER_A_APPLIANCES).join(', ') + '\n';
    bill += '  Energy:  ' + unitsA.toFixed(4) + ' kWh\n';
    bill += '  Own cost:  Rs ' + costOwnA.toFixed(2) + '\n';
    bill += '  + Common share (50%): Rs ' + (costCommon * 0.5).toFixed(2) + '\n';
    bill += '  TOTAL A: Rs ' + shareA.toFixed(2) + '\n\n';
    bill += '  USER B (Personal)\n';
    bill += '  Devices: ' + activeNames(USER_B_APPLIANCES).join(', ') + '\n';
    bill += '  Energy:  ' + unitsB.toFixed(4) + ' kWh\n';
    bill += '  Own cost:  Rs ' + costOwnB.toFixed(2) + '\n';
    bill += '  + Common share (50%): Rs ' + (costCommon * 0.5).toFixed(2) + '\n';
    bill += '  TOTAL B: Rs ' + shareB.toFixed(2) + '\n\n';
    bill += '  COMMON APPLIANCES\n';
    bill += '  Devices: ' + activeNames(COMMON_APPLIANCES).join(', ') + '\n';
    bill += '  Energy:  ' + unitsC.toFixed(4) + ' kWh\n';
    bill += '  Cost:    Rs ' + costCommon.toFixed(2) + ' (split 50/50)\n\n';
    bill += '───────────────────────────────────────\n';
    bill += '  GRAND TOTAL: Rs ' + total.toFixed(2) + '\n';
    bill += '═══════════════════════════════════════\n';
    bill += '  Generated by PowerSplit Harbinger\n';
    bill += '  github.com/elPicar0/PowerSplit\n';

    var blob = new Blob([bill], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'PowerSplit_Harbinger_Bill_' + now.toISOString().slice(0, 10) + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── MAIN LOOP ──────────────────────────────────────────────
  function tick() {
    var now = Date.now();
    var realMs = now - lastTick;
    lastTick = now;
    var scale = parseInt($('timeScale').value) || 1;
    var hrs = (realMs * scale) / 3600000;
    var tariff = parseFloat($('tariff').value) || 5.5;
    var threshold = parseFloat($('outageW').value) || 3000;

    var wA = sumWatts(USER_A_APPLIANCES);
    var wB = sumWatts(USER_B_APPLIANCES);
    var wC = sumWatts(COMMON_APPLIANCES);
    var wTotal = wA + wB + wC;

    unitsA += (wA / 1000) * hrs;
    unitsB += (wB / 1000) * hrs;
    unitsC += (wC / 1000) * hrs;

    var costOwnA = unitsA * tariff;
    var costOwnB = unitsB * tariff;
    var costCommon = unitsC * tariff;
    var costShareA = costOwnA + costCommon * 0.5;
    var costShareB = costOwnB + costCommon * 0.5;
    var totalCost = costOwnA + costOwnB + costCommon;

    var sessionHrs = ((now - sessionStart) * scale) / 3600000;
    var projMo = sessionHrs > 0.0001 ? (totalCost / sessionHrs) * 24 * 30 : 0;
    var outage = wTotal > threshold;

    // Alert sound on outage transition
    if (outage && !wasOutage) playAlert();
    wasOutage = outage;

    // DOM updates
    $('loadA').textContent = wA + ' W';
    $('energyA').textContent = unitsA.toFixed(3) + ' kWh';
    $('costA').textContent = '₹ ' + costShareA.toFixed(2);

    $('loadB').textContent = wB + ' W';
    $('energyB').textContent = unitsB.toFixed(3) + ' kWh';
    $('costB').textContent = '₹ ' + costShareB.toFixed(2);

    $('loadC').textContent = wC + ' W';
    $('energyC').textContent = unitsC.toFixed(3) + ' kWh';
    $('costC').textContent = '₹ ' + costCommon.toFixed(2);

    $('totalCost').textContent = '₹ ' + totalCost.toFixed(2);
    $('projMonthly').textContent = '₹ ' + projMo.toFixed(0);
    $('combinedLoad').textContent = wTotal + ' W';
    $('combinedLoad').style.color = outage ? 'var(--red)' : 'var(--green)';

    var ls = $('loadStatus');
    if (outage) { ls.textContent = '⚠ OVERLOAD'; ls.className = 'load-status danger'; }
    else if (wTotal > threshold * 0.7) { ls.textContent = '⚡ HIGH'; ls.className = 'load-status warning'; }
    else { ls.textContent = '✓ OK'; ls.className = 'load-status ok'; }

    $('outageBanner').style.display = outage ? 'flex' : 'none';

    var pctA = totalCost > 0 ? (costShareA / totalCost) * 100 : 50;
    $('splitBarA').style.width = pctA + '%';
    $('splitPctA').textContent = 'A: ₹' + costShareA.toFixed(1);
    $('splitPctB').textContent = 'B: ₹' + costShareB.toFixed(1);

    // OLED
    oledClear();
    oledText('== POWERSPLIT ==', 0, 0);
    var labA = activeNames(USER_A_APPLIANCES).join(',');
    if (labA.length > 16) labA = labA.substring(0, 15) + '~';
    var labB = activeNames(USER_B_APPLIANCES).join(',');
    if (labB.length > 16) labB = labB.substring(0, 15) + '~';
    oledText('A:' + labA, 0, 12);
    oledText(' Rs' + costShareA.toFixed(1), 0, 22);
    oledText('B:' + labB, 68, 12);
    oledText(' Rs' + costShareB.toFixed(1), 68, 22);
    oledLine(0, 33, 128, 33);
    oledText('Total:Rs' + totalCost.toFixed(1), 0, 37);
    oledText('Mo:Rs' + projMo.toFixed(0), 0, 47);
    oledText(outage ? '!!OVERLOAD!!' : 'Load:OK', 0, 57);

    // Chart (throttled)
    if (now - lastChartUpdate > 500) {
      chartA.push(costShareA);
      chartB.push(costShareB);
      chartC.push(costCommon);
      if (chartA.length > MAX_CHART_POINTS) { chartA.shift(); chartB.shift(); chartC.shift(); }
      drawChart();
      lastChartUpdate = now;
    }
  }

  // ── RESET ──────────────────────────────────────────────────
  $('resetBtn').addEventListener('click', function() {
    unitsA = 0; unitsB = 0; unitsC = 0;
    sessionStart = Date.now(); lastTick = Date.now();
    chartA = []; chartB = []; chartC = []; wasOutage = false;
    Object.keys(state).forEach(function(k) { state[k] = false; });
    document.querySelectorAll('.appliance-btn').forEach(function(b) { b.classList.remove('on'); });
    drawChart();
  });

  // ── BOOT ───────────────────────────────────────────────────
  oledClear();
  ctx.fillStyle = '#33ff88';
  ctx.font = 'bold ' + (FH * 2) + 'px "JetBrains Mono",monospace';
  ctx.fillText('POWER', 10 * S, 20 * S);
  ctx.fillText('SPLIT', 20 * S, 38 * S);
  ctx.font = 'bold ' + FH + 'px "JetBrains Mono",monospace';
  ctx.fillText('Harbinger v1.0', 12 * S, 55 * S);
  setTimeout(function() { setInterval(tick, 100); }, 1500);
})();
