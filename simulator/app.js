// PowerSplit Live — Merged Engine
// Fork UI + Original OLED/Sound/Wattages + Web Serial + Gamification
class PowerSplitLive {
  constructor() {
    this.initState();
    this.inputs = { A: { potVal: 0 }, B: { potVal: 0 } };
    this.tariff = 5.5; this.threshold = 3000; this.timeScale = 360;
    this.totalLoad = 0; this.totalEnergy = 0; this.totalCost = 0;
    this.isHardwareConnected = false; this.port = null; this.reader = null;
    this.charts = { pie: null, line: null, bar: null };
    this.audioCtx = null; this.wasOutage = false;
    this.sessionStart = Date.now(); this.lastTick = Date.now();
    this.oledCanvas = document.getElementById('oledCanvas');
    this.oledCtx = this.oledCanvas.getContext('2d');
    this.S = 2; this.FH = 16;

    window.ui = {
      switchTab: (id) => {
        document.querySelectorAll('.tab-pane').forEach(e => e.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
        document.getElementById('tab-' + id).classList.add('active');
        if (event && event.currentTarget) event.currentTarget.classList.add('active');
      },
      openModal: () => { document.getElementById('addUserModal').classList.remove('hidden'); document.getElementById('newUserName').value = ''; },
      closeModal: () => document.getElementById('addUserModal').classList.add('hidden')
    };
    this.init();
  }

  initState() {
    try {
      var saved = localStorage.getItem('powersplit_profiles');
      if (saved) { this.profiles = JSON.parse(saved); if (!Array.isArray(this.profiles) || !this.profiles.length) throw 0; this.profiles.forEach(p => { if (!p.history) p.history = Array(15).fill(0); }); }
      else throw 0;
    } catch(e) {
      this.profiles = [
        { id:'p1', name:'User A', color:'#b026ff', channel:'A', load:0, energy:0, cost:0, points:500, streak:0, history:Array(15).fill(0) },
        { id:'p2', name:'User B', color:'#00ffff', channel:'B', load:0, energy:0, cost:0, points:500, streak:0, history:Array(15).fill(0) }
      ];
    }
  }

  init() { this.initCharts(); this.checkNightMode(); this.renderProfiles(); this.bootOLED(); setTimeout(() => { this.startEngine(); }, 1500); setInterval(() => this.checkNightMode(), 60000); }

  // — DEVICE DEFINITIONS (from Creed.md) —
  getDeviceA(pct) {
    if (pct < 0.25) return { watts:5, label:'Phone', icon:'📱', desc:'Phone charger (5W)' };
    if (pct < 0.50) return { watts:80, label:'Ph+Fan', icon:'🌀', desc:'Phone + Fan (80W)' };
    if (pct < 0.75) return { watts:145, label:'+Laptop', icon:'💻', desc:'Phone+Fan+Laptop (145W)' };
    return { watts:1645, label:'+AC', icon:'❄️', desc:'All + AC (1645W)' };
  }
  getDeviceB(pct) {
    if (pct < 0.25) return { watts:5, label:'Phone', icon:'📱', desc:'Phone charger (5W)' };
    if (pct < 0.50) return { watts:2005, label:'+Geyser', icon:'🚿', desc:'Phone+Geyser (2005W)' };
    if (pct < 0.75) return { watts:2105, label:'+TV', icon:'📺', desc:'Ph+Geyser+TV (2105W)' };
    return { watts:3605, label:'+AC', icon:'❄️', desc:'Everything + AC (3605W)' };
  }

  // — AUDIO (outage alert from original) —
  playAlert() {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var ac = this.audioCtx;
      [520,680].forEach((f,i) => { var o=ac.createOscillator(),g=ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value=f; o.type='square'; g.gain.value=0.08; o.start(ac.currentTime+i*0.15); o.stop(ac.currentTime+i*0.15+0.12); });
    } catch(e){}
  }

  // — ENGINE —
  startEngine() { this.simInterval = setInterval(() => this.tick(), 100); }

  tick() {
    var now = Date.now(), realMs = now - this.lastTick; this.lastTick = now;
    var hrs = (realMs * this.timeScale) / 3600000;

    // Drift simulation if no hardware
    if (!this.isHardwareConnected) {
      ['A','B'].forEach(ch => { this.inputs[ch].potVal = Math.max(0, Math.min(4095, this.inputs[ch].potVal + (Math.random()-0.5)*500)); });
    }

    this.totalLoad = 0;
    this.profiles.forEach(p => {
      if (p.channel === 'A' || p.channel === 'B') {
        var pct = this.inputs[p.channel].potVal / 4095;
        var dev = p.channel === 'A' ? this.getDeviceA(pct) : this.getDeviceB(pct);
        p.load = dev.watts; p._dev = dev;
        this.totalLoad += p.load;
        p.energy += (p.load / 1000) * hrs;
        p.cost = p.energy * this.tariff;
        // Gamification
        if (p.load > 1500) { p.streak = 0; if (Math.random()<0.05) p.points = Math.max(0, p.points-2); }
        else if (p.load < 200 && p.load > 0) { if (Math.random()<0.05) { p.points += 1; p.streak += 1; } }
      } else { p.load = 0; p._dev = { label:'Idle', icon:'⏸', desc:'Unassigned' }; }
    });

    this.totalEnergy = this.profiles.reduce((a,p) => a+p.energy, 0);
    this.totalCost = this.profiles.reduce((a,p) => a+p.cost, 0);

    var outage = this.totalLoad > this.threshold;
    if (outage && !this.wasOutage) this.playAlert();
    this.wasOutage = outage;

    // History (every ~1s)
    if (Math.random() < 0.1) {
      this.profiles.forEach(p => { p.history.push(p.cost); if (p.history.length > 15) p.history.shift(); });
      this.updateCharts(); this.updateGamification();
    }

    this.updateDashboard(outage);
    this.generateSmartSuggestions();
    if (Math.random() < 0.05) this.saveData();
  }

  // — OLED CANVAS (from original) —
  bootOLED() {
    var c = this.oledCtx, S = this.S;
    c.fillStyle = '#000'; c.fillRect(0,0,256,128);
    c.fillStyle = '#33ff88';
    c.font = 'bold '+(this.FH*2)+'px "JetBrains Mono",monospace';
    c.fillText('POWER', 10*S, 20*S); c.fillText('SPLIT', 20*S, 38*S);
    c.font = 'bold '+this.FH+'px "JetBrains Mono",monospace';
    c.fillText('Zero Surprises v2.0', 4*S, 55*S);
  }

  oledClear() { this.oledCtx.fillStyle='#000'; this.oledCtx.fillRect(0,0,256,128); }
  oledText(t,x,y,sz) { sz=sz||1; this.oledCtx.fillStyle='#33ff88'; this.oledCtx.font='bold '+(this.FH*sz)+'px "JetBrains Mono",monospace'; this.oledCtx.fillText(t,x*this.S,(y+7*sz)*this.S); }
  oledLine(x0,y0,x1,y1) { this.oledCtx.strokeStyle='#33ff88'; this.oledCtx.lineWidth=this.S; this.oledCtx.beginPath(); this.oledCtx.moveTo(x0*this.S,y0*this.S); this.oledCtx.lineTo(x1*this.S,y1*this.S); this.oledCtx.stroke(); }

  drawOLED(outage) {
    var chA = this.profiles.find(p => p.channel==='A'), chB = this.profiles.find(p => p.channel==='B');
    var costA = chA ? chA.cost : 0, costB = chB ? chB.cost : 0;
    var labA = chA && chA._dev ? chA._dev.label : 'IDLE', labB = chB && chB._dev ? chB._dev.label : 'IDLE';
    var sessionHrs = ((Date.now()-this.sessionStart)*this.timeScale)/3600000;
    var projMo = sessionHrs > 0.0001 ? (this.totalCost/sessionHrs)*24*30 : 0;

    this.oledClear();
    this.oledText('== POWERSPLIT ==', 0, 0);
    this.oledText('A:'+labA+' Rs'+costA.toFixed(1), 0, 12);
    this.oledText('B:'+labB+' Rs'+costB.toFixed(1), 0, 22);
    this.oledLine(0, 33, 128, 33);
    this.oledText('Total: Rs '+this.totalCost.toFixed(2), 0, 37);
    this.oledText('Proj/mo: Rs '+projMo.toFixed(0), 0, 47);
    this.oledText(outage ? '!! CUT AC/GEYSER NOW' : 'Load: OK', 0, 57);
  }

  // — UI UPDATES —
  updateDashboard(outage) {
    document.getElementById('valTotalLoad').innerText = Math.round(this.totalLoad);
    document.getElementById('valTotalEnergy').innerText = this.totalEnergy.toFixed(2);
    document.getElementById('valTotalCost').innerText = this.totalCost.toFixed(2);
    var sessionHrs = ((Date.now()-this.sessionStart)*this.timeScale)/3600000;
    var projMo = sessionHrs > 0.0001 ? (this.totalCost/sessionHrs)*24*30 : 0;
    document.getElementById('valProjected').innerText = projMo.toFixed(0);

    // Load bar
    var pct = Math.min(100, (this.totalLoad / 4000) * 100);
    var bar = document.getElementById('totalLoadBar');
    bar.style.width = pct + '%';
    bar.className = 'load-bar ' + (outage ? 'fill-red' : 'fill-purple');

    var lst = document.getElementById('loadStatusText');
    if (outage) { lst.textContent = '⚠ OVERLOAD'; lst.className = 'load-status-text danger'; }
    else if (this.totalLoad > this.threshold*0.7) { lst.textContent = '⚡ HIGH'; lst.className = 'load-status-text warning'; }
    else { lst.textContent = '✓ OK'; lst.className = 'load-status-text ok'; }

    // Alert banner
    var ab = document.getElementById('alertBanner');
    if (outage) { ab.classList.remove('hidden'); document.getElementById('alertMessage').textContent = 'Combined load: '+Math.round(this.totalLoad)+'W exceeds '+this.threshold+'W threshold.'; }
    else ab.classList.add('hidden');

    // Split bar
    var chA = this.profiles.find(p => p.channel==='A'), chB = this.profiles.find(p => p.channel==='B');
    var cA = chA?chA.cost:0, cB = chB?chB.cost:0, tot = cA+cB;
    var splitPct = tot > 0 ? (cA/tot)*100 : 50;
    document.getElementById('splitBarA').style.width = splitPct+'%';
    document.getElementById('splitLabelA').textContent = 'A: '+splitPct.toFixed(0)+'% · ₹'+cA.toFixed(2);
    document.getElementById('splitLabelB').textContent = 'B: '+(100-splitPct).toFixed(0)+'% · ₹'+cB.toFixed(2);

    // OLED
    this.drawOLED(outage);

    // Profile cards (only if visible)
    if (document.getElementById('tab-profiles').classList.contains('active')) {
      this.profiles.forEach(p => {
        var el = (id) => document.getElementById(id);
        var eL = el('p-load-'+p.id), eC = el('p-cost-'+p.id), eE = el('p-energy-'+p.id), eA = el('p-app-'+p.id);
        if(eL) eL.innerText = Math.round(p.load);
        if(eC) eC.innerText = p.cost.toFixed(2);
        if(eE) eE.innerText = p.energy.toFixed(3);
        if(eA) eA.innerText = p._dev ? p._dev.desc : 'Idle';
      });
    }
  }

  generateSmartSuggestions() {
    var sb = document.getElementById('suggestionBanner'), st = document.getElementById('suggestionText');
    var hi = [...this.profiles].sort((a,b) => b.load-a.load)[0];
    if (hi && hi.load > 1500) {
      st.innerHTML = '<strong>'+hi.name+'</strong>, turning off the AC/Geyser could save ₹'+((hi.load/1000)*this.tariff).toFixed(2)+' per hour!';
      sb.classList.remove('hidden');
    } else if (hi && hi.load === 0) { sb.classList.add('hidden'); }
    else { if (Math.random()<0.01) { st.innerHTML = 'Great job! Current loads are low and efficient.'; sb.classList.remove('hidden'); } }
  }

  updateGamification() {
    var sorted = [...this.profiles].sort((a,b) => b.points-a.points);
    var html = '';
    sorted.forEach((p,i) => {
      html += '<div class="leaderboard-item"><div><i class="fa-solid fa-medal '+(i===0?'text-yellow':'text-secondary')+'"></i> '+p.name+' <span style="font-size:10px;color:#666;margin-left:6px">🔥 '+p.streak+'</span></div><div class="text-cyan" style="font-weight:700">'+p.points+' pts</div></div>';
    });
    document.getElementById('leaderboardList').innerHTML = html;

    var best = sorted[0], hiStreak = [...this.profiles].sort((a,b)=>b.streak-a.streak)[0], beast = [...this.profiles].sort((a,b)=>b.energy-a.energy)[0];
    var bh = '';
    if (best) bh += '<div class="badge"><i class="fa-solid fa-leaf text-green"></i>Eco Saver<br><small>'+best.name+'</small></div>';
    if (hiStreak && hiStreak.streak > 20) bh += '<div class="badge"><i class="fa-solid fa-fire text-yellow"></i>Streaker<br><small>'+hiStreak.name+'</small></div>';
    if (beast && beast.energy > 5) bh += '<div class="badge"><i class="fa-solid fa-bolt text-purple"></i>Power Beast<br><small>'+beast.name+'</small></div>';
    document.getElementById('badgesList').innerHTML = bh;
  }

  renderProfiles() {
    var grid = document.getElementById('usersGrid'); grid.innerHTML = '';
    this.profiles.forEach(p => {
      var cb = p.channel!=='none' ? '<span class="channel-badge">CH '+p.channel+'</span>' : '';
      grid.innerHTML += '<div class="glass-panel user-card" style="--user-color:'+p.color+';--user-color-glow:'+p.color+'66"><div class="user-header"><div class="avatar">'+p.name.charAt(0)+'</div><div><h3 style="font-size:20px">'+p.name+' '+cb+'</h3><div class="text-secondary" style="font-size:12px">Eco Points: <span class="text-cyan">'+p.points+'</span></div></div><button class="btn-secondary" style="margin-left:auto;padding:8px" onclick="window.app.deleteProfile(\''+p.id+'\')"><i class="fa-solid fa-trash"></i></button></div><div class="metrics-grid" style="grid-template-columns:1fr 1fr;margin-bottom:16px"><div><div class="text-secondary" style="font-size:12px">Current Load</div><div class="text-cyan" style="font-size:28px;font-weight:bold"><span id="p-load-'+p.id+'">0</span>W</div><div class="text-primary" style="font-size:12px;margin-top:4px"><i class="fa-solid fa-plug text-purple"></i> <span id="p-app-'+p.id+'">Idle</span></div></div><div><div class="text-secondary" style="font-size:12px">Cost & Energy</div><div class="text-green" style="font-size:20px;font-weight:bold">₹<span id="p-cost-'+p.id+'">'+p.cost.toFixed(2)+'</span></div><div class="text-secondary" style="font-size:12px"><span id="p-energy-'+p.id+'">'+p.energy.toFixed(3)+'</span> kWh</div></div></div><div class="channel-assign"><label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px">Assign to Hardware Input</label><select onchange="window.app.assignChannel(\''+p.id+'\',this.value)"><option value="none" '+(p.channel==='none'?'selected':'')+'>Unassigned</option><option value="A" '+(p.channel==='A'?'selected':'')+'>Channel A (GPIO 34)</option><option value="B" '+(p.channel==='B'?'selected':'')+'>Channel B (GPIO 35)</option></select></div></div>';
    });
  }

  // — ACTIONS —
  assignChannel(pid, ch) {
    var p = this.profiles.find(x => x.id===pid);
    if (p) { if (ch!=='none') this.profiles.forEach(x => { if(x.channel===ch && x.id!==pid) x.channel='none'; }); p.channel=ch; this.saveData(); this.renderProfiles(); this.updateCharts(); }
  }

  addProfile() {
    var name = document.getElementById('newUserName').value.trim() || 'New User';
    var color = document.getElementById('newUserColor').value;
    this.profiles.push({ id:'p'+Date.now(), name:name, color:color, channel:'none', load:0, energy:0, cost:0, points:500, streak:0, history:Array(15).fill(0) });
    this.renderProfiles(); this.updateCharts(); window.ui.closeModal(); this.saveData();
  }

  deleteProfile(id) { this.profiles = this.profiles.filter(p=>p.id!==id); this.renderProfiles(); this.updateCharts(); this.saveData(); }

  resetAll() {
    this.profiles.forEach(p => { p.energy=0; p.cost=0; p.load=0; p.points=500; p.streak=0; p.history=Array(15).fill(0); });
    this.sessionStart = Date.now(); this.lastTick = Date.now();
    this.inputs.A.potVal = 0; this.inputs.B.potVal = 0;
    this.wasOutage = false; this.totalLoad=0; this.totalEnergy=0; this.totalCost=0;
    this.updateCharts(); this.saveData(); this.bootOLED();
  }

  saveSettings() {
    this.tariff = parseFloat(document.getElementById('inputTariff').value) || 5.5;
    this.threshold = parseFloat(document.getElementById('inputThreshold').value) || 3000;
    this.timeScale = parseInt(document.getElementById('inputTimeScale').value) || 360;
    // Visual feedback
    var btn = event.target; btn.textContent = '✓ Saved!'; setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Settings'; }, 1500);
  }

  downloadBill() {
    var now = new Date();
    var b = '═══════════════════════════════════════\n  POWERSPLIT — BILL SUMMARY\n═══════════════════════════════════════\n\n';
    b += '  Date: '+now.toLocaleDateString('en-IN')+'\n  Time: '+now.toLocaleTimeString('en-IN')+'\n  Tariff: Rs '+this.tariff.toFixed(2)+'/kWh\n\n';
    b += '───────────────────────────────────────\n';
    this.profiles.forEach(p => { b += '  '+p.name+(p.channel!=='none'?' [CH '+p.channel+']':'')+'\n  Energy: '+p.energy.toFixed(4)+' kWh\n  Cost:   Rs '+p.cost.toFixed(2)+'\n  Eco Score: '+p.points+' pts\n\n'; });
    b += '───────────────────────────────────────\n  TOTAL: Rs '+this.totalCost.toFixed(2)+'\n═══════════════════════════════════════\n  Generated by PowerSplit\n  github.com/elPicar0/PowerSplit\n';
    var blob = new Blob([b], {type:'text/plain'}), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'PowerSplit_Bill_'+now.toISOString().slice(0,10)+'.txt'; a.click(); URL.revokeObjectURL(url);
  }

  checkNightMode() { var h = new Date().getHours(); document.body.classList.toggle('night-mode', h>=18||h<6); }
  saveData() { localStorage.setItem('powersplit_profiles', JSON.stringify(this.profiles)); }

  // — WEB SERIAL (from fork) —
  async connectHardware() {
    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      this.isHardwareConnected = true;
      document.getElementById('hardwareStatus').innerHTML = '<span class="status-dot green"></span> ESP32 Connected';
      document.getElementById('btnConnect').style.display = 'none';
      this.readSerial();
    } catch(e) { console.error('Serial failed', e); alert('Could not connect. Running in simulation mode.'); }
  }

  async readSerial() {
    var dec = new TextDecoderStream(); this.port.readable.pipeTo(dec.writable);
    this.reader = dec.readable.getReader(); var buf = '';
    try {
      while (true) {
        var { value, done } = await this.reader.read(); if (done) break;
        buf += value; var lines = buf.split('\n'); buf = lines.pop();
        for (var ln of lines) { try { var d = JSON.parse(ln.trim()); if(d.A!==undefined) this.inputs.A.potVal=d.A; if(d.B!==undefined) this.inputs.B.potVal=d.B; } catch(e){} }
      }
    } catch(e) {
      this.isHardwareConnected = false;
      document.getElementById('hardwareStatus').innerHTML = '<span class="status-dot red"></span> Disconnected';
      document.getElementById('btnConnect').style.display = 'block';
    }
  }

  // — CHART.JS —
  initCharts() {
    Chart.defaults.color = '#94a3b8'; Chart.defaults.font.family = 'Outfit';
    this.charts.pie = new Chart(document.getElementById('pieChart').getContext('2d'), {
      type:'doughnut', data:{labels:[],datasets:[{data:[],backgroundColor:[],borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:'#f8fafc'}}}}
    });
    this.charts.line = new Chart(document.getElementById('lineChart').getContext('2d'), {
      type:'line', data:{labels:Array(15).fill(''),datasets:[]},
      options:{responsive:true,maintainAspectRatio:false,scales:{x:{display:false},y:{grid:{color:'rgba(255,255,255,0.05)'}}}}
    });
    this.charts.bar = new Chart(document.getElementById('barChart').getContext('2d'), {
      type:'bar', data:{labels:[],datasets:[{label:'Energy (kWh)',data:[],backgroundColor:[]}]},
      options:{responsive:true,maintainAspectRatio:false,scales:{y:{grid:{color:'rgba(255,255,255,0.05)'}}},plugins:{legend:{display:false}}}
    });
    this.updateCharts();
  }

  updateCharts() {
    if (!this.charts.pie) return;
    var n=this.profiles.map(p=>p.name), c=this.profiles.map(p=>p.color), co=this.profiles.map(p=>p.cost), e=this.profiles.map(p=>p.energy);
    this.charts.pie.data.labels=n; this.charts.pie.data.datasets[0].data=co; this.charts.pie.data.datasets[0].backgroundColor=c; this.charts.pie.update();
    this.charts.bar.data.labels=n; this.charts.bar.data.datasets[0].data=e; this.charts.bar.data.datasets[0].backgroundColor=c; this.charts.bar.update();
    this.charts.line.data.datasets=this.profiles.map(p=>({label:p.name,data:p.history||[],borderColor:p.color,tension:0.4,pointRadius:0,borderWidth:2})); this.charts.line.update();
  }
}

window.app = new PowerSplitLive();
