// ── PowerSplit Simulator Engine ─────────────────────────────
// Matches Creed.md device-based simulation model exactly
(() => {
  'use strict';

  const UPDATE_INTERVAL = 100; // ms
  const CHART_INTERVAL = 500;  // ms between chart data points

  // ── DEVICE DEFINITIONS (from Creed.md Section 3) ───────────
  const DEVICES_A = [
    { threshold: 0.25, watts: 5,    label: 'Phone',          icon: '📱', desc: 'Phone charger only' },
    { threshold: 0.50, watts: 80,   label: 'Ph+Fan',         icon: '🌀', desc: 'Phone + Fan' },
    { threshold: 0.75, watts: 145,  label: '+Laptop',        icon: '💻', desc: 'Phone + Fan + Laptop' },
    { threshold: 1.01, watts: 1645, label: '+AC',            icon: '❄️', desc: 'Phone + Fan + Laptop + AC' },
  ];

  const DEVICES_B = [
    { threshold: 0.25, watts: 5,    label: 'Phone',          icon: '📱', desc: 'Phone charger only' },
    { threshold: 0.50, watts: 2005, label: '+Geyser',        icon: '🚿', desc: 'Phone + Geyser' },
    { threshold: 0.75, watts: 2105, label: '+TV',            icon: '📺', desc: 'Phone + Geyser + TV' },
    { threshold: 1.01, watts: 3605, label: '+AC',            icon: '❄️', desc: 'Everything + AC' },
  ];

  // ── STATE ──────────────────────────────────────────────────
  let totalUnitsA = 0, totalUnitsB = 0;
  let sessionStart = Date.now();
  let lastTick = Date.now();
  let lastChartUpdate = 0;
  let wasOutage = false;

  // Chart data arrays (rolling window)
  const MAX_CHART_POINTS = 200;
  let chartDataA = [];
  let chartDataB = [];

  // ── DOM REFS ───────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const sliderA = $('sliderA'), sliderB = $('sliderB');
  const canvas = $('oledCanvas');
  const ctx = canvas.getContext('2d');
  const chartCanvas = $('chartCanvas');
  const chartCtx = chartCanvas.getContext('2d');

  // ── AUDIO CONTEXT (outage alert) ───────────────────────────
  let audioCtx = null;
  function playAlert() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // Two-tone alert beep
      [520, 680].forEach(function(freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = 'square';
        gain.gain.value = 0.08;
        osc.start(audioCtx.currentTime + i * 0.15);
        osc.stop(audioCtx.currentTime + i * 0.15 + 0.12);
      });
    } catch(e) {}
  }

  // ── HELPERS ────────────────────────────────────────────────
  const getTariff = () => parseFloat($('tariff').value) || 5.5;
  const getTimeScale = () => parseInt($('timeScale').value) || 1;
  const getOutageThreshold = () => parseFloat($('outageThreshold').value) || 3000;

  function getDevice(pct, devices) {
    for (const d of devices) {
      if (pct < d.threshold) return d;
    }
    return devices[devices.length - 1];
  }

  // ── OLED RENDERER ──────────────────────────────────────────
  const S = 2; // scale: canvas 256×128 simulates 128×64
  const FH = 8 * S;

  function oledClear() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function oledText(text, x, y, size) {
    size = size || 1;
    ctx.fillStyle = '#33ff88';
    ctx.font = 'bold ' + (FH * size) + 'px "JetBrains Mono", monospace';
    ctx.fillText(text, x * S, (y + 7 * size) * S);
  }

  function oledLine(x0, y0, x1, y1) {
    ctx.strokeStyle = '#33ff88';
    ctx.lineWidth = S;
    ctx.beginPath();
    ctx.moveTo(x0 * S, y0 * S);
    ctx.lineTo(x1 * S, y1 * S);
    ctx.stroke();
  }

  function drawOLED(costA, costB, totalCost, labelA, labelB, projMo, outage) {
    oledClear();
    oledText('== POWERSPLIT ==', 0, 0);
    oledText('A:' + labelA + ' Rs' + costA.toFixed(1), 0, 12);
    oledText('B:' + labelB + ' Rs' + costB.toFixed(1), 0, 22);
    oledLine(0, 33, 128, 33);
    oledText('Total: Rs ' + totalCost.toFixed(2), 0, 37);
    oledText('Proj/mo: Rs ' + projMo.toFixed(0), 0, 47);
    if (outage) {
      oledText('!! CUT AC/GEYSER NOW', 0, 57);
    } else {
      oledText('Load: OK', 0, 57);
    }
  }

  // ── CHART RENDERER ─────────────────────────────────────────
  function drawChart() {
    var w = chartCanvas.width;
    var h = chartCanvas.height;
    chartCtx.clearRect(0, 0, w, h);

    if (chartDataA.length < 2) return;

    // Find max value for scaling
    var maxVal = 0.01;
    for (var i = 0; i < chartDataA.length; i++) {
      if (chartDataA[i] > maxVal) maxVal = chartDataA[i];
      if (chartDataB[i] > maxVal) maxVal = chartDataB[i];
    }
    maxVal *= 1.15; // headroom

    // Grid lines
    chartCtx.strokeStyle = 'rgba(255,255,255,0.06)';
    chartCtx.lineWidth = 1;
    for (var g = 1; g <= 4; g++) {
      var gy = h - (g / 5) * h;
      chartCtx.beginPath();
      chartCtx.moveTo(0, gy);
      chartCtx.lineTo(w, gy);
      chartCtx.stroke();
    }

    // Y-axis labels
    chartCtx.fillStyle = 'rgba(255,255,255,0.2)';
    chartCtx.font = '10px "JetBrains Mono", monospace';
    for (var g = 1; g <= 4; g++) {
      var gy = h - (g / 5) * h;
      var val = (maxVal * g / 5).toFixed(1);
      chartCtx.fillText('₹' + val, 4, gy - 3);
    }

    var n = chartDataA.length;
    var step = w / (MAX_CHART_POINTS - 1);

    // Draw line helper
    function drawLine(data, color) {
      chartCtx.strokeStyle = color;
      chartCtx.lineWidth = 2;
      chartCtx.beginPath();
      for (var j = 0; j < data.length; j++) {
        var x = j * step;
        var y = h - (data[j] / maxVal) * h;
        if (j === 0) chartCtx.moveTo(x, y);
        else chartCtx.lineTo(x, y);
      }
      chartCtx.stroke();

      // Glow
      chartCtx.strokeStyle = color;
      chartCtx.globalAlpha = 0.15;
      chartCtx.lineWidth = 6;
      chartCtx.beginPath();
      for (var j = 0; j < data.length; j++) {
        var x = j * step;
        var y = h - (data[j] / maxVal) * h;
        if (j === 0) chartCtx.moveTo(x, y);
        else chartCtx.lineTo(x, y);
      }
      chartCtx.stroke();
      chartCtx.globalAlpha = 1;
    }

    drawLine(chartDataA, '#6c5ce7');
    drawLine(chartDataB, '#00cec9');
  }

  // ── DOWNLOAD BILL ──────────────────────────────────────────
  $('downloadBill').addEventListener('click', function() {
    var tariff = getTariff();
    var costA = totalUnitsA * tariff;
    var costB = totalUnitsB * tariff;
    var total = costA + costB;
    var now = new Date();

    var bill = '═══════════════════════════════════════\n';
    bill += '  POWERSPLIT — BILL SUMMARY\n';
    bill += '═══════════════════════════════════════\n\n';
    bill += '  Date: ' + now.toLocaleDateString('en-IN') + '\n';
    bill += '  Time: ' + now.toLocaleTimeString('en-IN') + '\n';
    bill += '  Tariff: Rs ' + tariff.toFixed(2) + '/kWh\n\n';
    bill += '───────────────────────────────────────\n';
    bill += '  USER A\n';
    bill += '  Energy: ' + totalUnitsA.toFixed(4) + ' kWh\n';
    bill += '  Cost:   Rs ' + costA.toFixed(2) + '\n\n';
    bill += '  USER B\n';
    bill += '  Energy: ' + totalUnitsB.toFixed(4) + ' kWh\n';
    bill += '  Cost:   Rs ' + costB.toFixed(2) + '\n\n';
    bill += '───────────────────────────────────────\n';
    bill += '  TOTAL:  Rs ' + total.toFixed(2) + '\n';
    bill += '═══════════════════════════════════════\n';
    bill += '  Generated by PowerSplit Simulator\n';
    bill += '  github.com/elPicar0/PowerSplit\n';

    var blob = new Blob([bill], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'PowerSplit_Bill_' + now.toISOString().slice(0,10) + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── MAIN LOOP ──────────────────────────────────────────────
  function tick() {
    var now = Date.now();
    var realMs = now - lastTick;
    lastTick = now;

    var scale = getTimeScale();
    var elapsedHrs = (realMs * scale) / 3600000;
    var tariff = getTariff();
    var threshold = getOutageThreshold();

    // Get device based on knob position
    var pctA = sliderA.value / 100;
    var pctB = sliderB.value / 100;
    var devA = getDevice(pctA, DEVICES_A);
    var devB = getDevice(pctB, DEVICES_B);

    var wattsA = devA.watts;
    var wattsB = devB.watts;
    var totalWatts = wattsA + wattsB;

    // Accumulate energy
    totalUnitsA += (wattsA / 1000) * elapsedHrs;
    totalUnitsB += (wattsB / 1000) * elapsedHrs;

    var costA = totalUnitsA * tariff;
    var costB = totalUnitsB * tariff;
    var totalCost = costA + costB;

    var sessionHrs = ((now - sessionStart) * scale) / 3600000;
    var projMo = sessionHrs > 0.0001 ? (totalCost / sessionHrs) * 24 * 30 : 0;

    var outage = totalWatts > threshold;

    // Alert sound on outage transition
    if (outage && !wasOutage) playAlert();
    wasOutage = outage;

    // ── Update DOM ───────────────────────────────────────────
    $('deviceA').textContent = devA.icon + ' ' + devA.desc + ' (' + wattsA + 'W)';
    $('deviceB').textContent = devB.icon + ' ' + devB.desc + ' (' + wattsB + 'W)';

    $('powerA').textContent = wattsA + ' W';
    $('energyA').textContent = totalUnitsA.toFixed(3) + ' kWh';
    $('costA').textContent = '₹ ' + costA.toFixed(2);

    $('powerB').textContent = wattsB + ' W';
    $('energyB').textContent = totalUnitsB.toFixed(3) + ' kWh';
    $('costB').textContent = '₹ ' + costB.toFixed(2);

    $('totalCost').textContent = '₹ ' + totalCost.toFixed(2);
    $('projectedMonthly').textContent = '₹ ' + projMo.toFixed(0);

    // Combined load
    $('combinedLoad').textContent = totalWatts + ' W';
    $('combinedLoad').style.color = outage ? 'var(--red)' : 'var(--green)';

    var loadStatus = $('loadStatus');
    if (outage) {
      loadStatus.textContent = '⚠ OVERLOAD';
      loadStatus.className = 'load-status danger';
    } else if (totalWatts > threshold * 0.7) {
      loadStatus.textContent = '⚡ HIGH';
      loadStatus.className = 'load-status warning';
    } else {
      loadStatus.textContent = '✓ OK';
      loadStatus.className = 'load-status ok';
    }

    // Outage banner
    $('outageBanner').style.display = outage ? 'block' : 'none';

    // Split bar
    var pctSplitA = totalCost > 0 ? (costA / totalCost) * 100 : 50;
    $('splitBarA').style.width = pctSplitA + '%';
    $('splitPctA').textContent = 'A: ' + pctSplitA.toFixed(0) + '%';
    $('splitPctB').textContent = 'B: ' + (100 - pctSplitA).toFixed(0) + '%';

    // OLED canvas
    drawOLED(costA, costB, totalCost, devA.label, devB.label, projMo, outage);

    // Chart data (throttled)
    if (now - lastChartUpdate > CHART_INTERVAL) {
      chartDataA.push(costA);
      chartDataB.push(costB);
      if (chartDataA.length > MAX_CHART_POINTS) {
        chartDataA.shift();
        chartDataB.shift();
      }
      drawChart();
      lastChartUpdate = now;
    }
  }

  // ── RESET ──────────────────────────────────────────────────
  $('resetBtn').addEventListener('click', function() {
    totalUnitsA = 0; totalUnitsB = 0;
    sessionStart = Date.now();
    lastTick = Date.now();
    sliderA.value = 0; sliderB.value = 0;
    chartDataA = []; chartDataB = [];
    wasOutage = false;
    drawChart();
  });

  // ── BOOT ───────────────────────────────────────────────────
  oledClear();
  ctx.fillStyle = '#33ff88';
  ctx.font = 'bold ' + (FH * 2) + 'px "JetBrains Mono", monospace';
  ctx.fillText('POWER', 10 * S, 20 * S);
  ctx.fillText('SPLIT', 20 * S, 38 * S);
  ctx.font = 'bold ' + FH + 'px "JetBrains Mono", monospace';
  ctx.fillText('Zero Surprises v1.0', 8 * S, 55 * S);

  setTimeout(function() {
    setInterval(tick, UPDATE_INTERVAL);
  }, 1500);

})();
