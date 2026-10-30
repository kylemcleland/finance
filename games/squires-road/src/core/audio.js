// Core: synthesized sound effects + tiny procedural music loops.
(() => {
  let ac = null, master = null, sfxGain = null, musGain = null;
  let enabled = true;
  try { enabled = localStorage.getItem('sr_sound') !== 'off'; } catch (_) { /* ignore */ }

  const audio = {
    get enabled() { return enabled; },
    unlock() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = enabled ? 0.8 : 0; master.connect(ac.destination);
      sfxGain = ac.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
      musGain = ac.createGain(); musGain.gain.value = 0.22; musGain.connect(master);
      if (pendingTrack) G.music.play(pendingTrack);
    },
    setEnabled(on) {
      enabled = on;
      try { localStorage.setItem('sr_sound', on ? 'on' : 'off'); } catch (_) { /* ignore */ }
      if (master) master.gain.value = on ? 0.8 : 0;
    },
  };
  G.audio = audio;

  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function tone(freq, dur, o = {}) {
    const t = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    const v = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || sfxGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function hiss(dur, o = {}) {
    const t = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource();
    src.buffer = noise();
    const f = ac.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1500, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    f.Q.value = o.q || 1;
    const g = ac.createGain();
    const v = o.vol ?? 0.3;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxGain);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  const SFX = {
    step: () => hiss(0.05, { freq: 600, vol: 0.06, q: 2 }),
    bush: () => hiss(0.18, { freq: 2500, sweep: 800, vol: 0.12 }),
    door: () => { tone(180, 0.12, { type: 'triangle', vol: 0.2 }); tone(120, 0.15, { type: 'triangle', vol: 0.2, delay: 0.08 }); },
    swing: () => hiss(0.14, { freq: 1200, sweep: 4000, vol: 0.18, q: 3 }),
    hit: () => { hiss(0.12, { freq: 400, vol: 0.4, filter: 'lowpass' }); tone(140, 0.12, { type: 'square', vol: 0.15, slide: 60 }); },
    hurt: () => { tone(300, 0.2, { type: 'sawtooth', vol: 0.2, slide: 90 }); hiss(0.1, { freq: 800, vol: 0.2 }); },
    clang: () => { tone(1250, 0.25, { type: 'square', vol: 0.12 }); tone(1870, 0.18, { type: 'square', vol: 0.08 }); hiss(0.08, { freq: 5000, vol: 0.2 }); },
    block: () => { tone(420, 0.1, { type: 'square', vol: 0.15 }); hiss(0.08, { freq: 2000, vol: 0.2 }); },
    parry: () => { tone(1500, 0.35, { type: 'triangle', vol: 0.25 }); tone(2250, 0.3, { type: 'triangle', vol: 0.15, delay: 0.03 }); hiss(0.1, { freq: 6000, vol: 0.25 }); },
    dodge: () => hiss(0.16, { freq: 900, sweep: 300, vol: 0.15 }),
    coin: () => { tone(988, 0.08, { vol: 0.15 }); tone(1319, 0.25, { vol: 0.15, delay: 0.07 }); },
    select: () => tone(660, 0.05, { vol: 0.08 }),
    confirm: () => { tone(660, 0.06, { vol: 0.1 }); tone(990, 0.1, { vol: 0.1, delay: 0.05 }); },
    cancel: () => { tone(440, 0.06, { vol: 0.1 }); tone(330, 0.1, { vol: 0.1, delay: 0.05 }); },
    text: () => tone(520 + Math.random() * 40, 0.025, { vol: 0.04, type: 'square' }),
    levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { vol: 0.15, delay: i * 0.09, type: 'square' })),
    win: () => [392, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, 0.22, { vol: 0.15, delay: i * 0.11 })),
    lose: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.3, { vol: 0.15, delay: i * 0.18, type: 'triangle' })),
    arrow: () => hiss(0.25, { freq: 3000, sweep: 1200, vol: 0.12, q: 4 }),
    thud: () => { tone(110, 0.15, { type: 'sine', vol: 0.4, slide: 50 }); hiss(0.06, { freq: 300, vol: 0.25 }); },
    charge: () => tone(200, 0.5, { type: 'sawtooth', vol: 0.08, slide: 600 }),
    crowd: () => hiss(1.2, { freq: 900, vol: 0.18, q: 0.4 }),
    horn: () => { tone(294, 0.5, { type: 'sawtooth', vol: 0.1 }); tone(440, 0.7, { type: 'sawtooth', vol: 0.1, delay: 0.35 }); },
    break: () => { hiss(0.35, { freq: 1800, vol: 0.45, q: 0.6 }); tone(90, 0.25, { type: 'square', vol: 0.15, slide: 40 }); },
    gallop: () => { tone(90, 0.06, { type: 'sine', vol: 0.3 }); tone(80, 0.06, { type: 'sine', vol: 0.25, delay: 0.09 }); },
    heal: () => [523, 784, 1047].forEach((f, i) => tone(f, 0.15, { vol: 0.1, delay: i * 0.06, type: 'triangle' })),
    bump: () => tone(90, 0.06, { type: 'square', vol: 0.08 }),
    alert: () => { tone(1200, 0.08, { vol: 0.12 }); tone(1600, 0.12, { vol: 0.12, delay: 0.08 }); },
  };
  G.sfx = {
    play(name) {
      if (!ac || !enabled) return;
      const f = SFX[name];
      try { f && f(); } catch (e) { /* ignore audio glitches */ }
    },
    register(name, fn) { SFX[name] = fn; },
    tone: (...a) => ac && tone(...a), hiss: (...a) => ac && hiss(...a),
  };

  // --- Music: step sequencer over simple patterns -------------------------
  // Notes: semitone offsets from root; null = rest. Each track: tempo, root, lead, bass.
  const N = (s) => s.split(' ').map((t) => (t === '.' ? null : parseInt(t, 10)));
  const TRACKS = {
    title:   { bpm: 92, root: 57, lead: N('0 . 4 7 12 . 11 7 9 . 7 4 5 . 4 2 0 . 4 7 12 . 14 12 11 . 7 . 9 . . .'), bass: N('0 . . . -5 . . . -3 . . . -7 . . . 0 . . . -5 . . . -3 . . . -5 . . .'), wave: 'triangle' },
    village: { bpm: 104, root: 60, lead: N('7 . 9 . 7 4 . 2 0 . 2 4 7 . . . 9 . 12 . 9 7 . 4 5 . 4 2 0 . . .'), bass: N('0 . 7 . 0 . 7 . 5 . 12 . 5 . 12 . 0 . 7 . 0 . 7 . -5 . 2 . 7 . 2 .'), wave: 'square' },
    route:   { bpm: 120, root: 62, lead: N('0 2 4 . 7 . 4 . 9 7 4 2 0 . . . 2 4 5 . 9 . 7 5 4 . 2 . 0 . . .'), bass: N('0 . 0 7 0 . 0 7 -2 . -2 5 -2 . -2 5 -4 . -4 3 -4 . -4 3 -5 . -5 2 -5 . 7 .'), wave: 'square' },
    town:    { bpm: 98, root: 58, lead: N('4 . 5 7 . 9 7 5 4 . 2 . 0 . . . 4 . 5 7 . 12 11 9 7 . . 5 4 . . .'), bass: N('0 . 7 . 4 . 7 . 5 . 9 . 7 . 11 . 0 . 7 . 4 . 7 . 5 . 7 . 0 . . .'), wave: 'triangle' },
    battle:  { bpm: 150, root: 57, lead: N('0 0 3 0 5 0 7 6 0 0 3 0 10 8 7 5 0 0 3 0 5 0 7 10 12 10 8 7 5 3 2 3'), bass: N('0 . 0 . 0 . 0 . -4 . -4 . -4 . -4 . -2 . -2 . -2 . -2 . -5 . -5 . -5 . 7 .'), wave: 'sawtooth' },
    boss:    { bpm: 160, root: 52, lead: N('0 1 0 7 6 . 0 1 0 8 7 . 0 1 0 10 8 7 6 . 0 1 0 7 6 . 3 2 1 . . .'), bass: N('0 0 . 0 0 . 0 0 -1 -1 . -1 -1 . -1 -1 0 0 . 0 0 . 0 0 -4 -4 . -4 -5 . -5 .'), wave: 'sawtooth' },
    tourney: { bpm: 132, root: 60, lead: N('0 . 0 4 7 . 7 . 9 7 5 4 2 . . . 4 . 4 7 12 . 12 . 11 9 7 5 7 . . .'), bass: N('0 . 7 . 0 . 7 . 5 . 0 . 7 . 2 . 0 . 7 . 0 . 7 . 5 . 7 . 0 . 7 .'), wave: 'square' },
    victory: { bpm: 140, root: 60, lead: N('0 4 7 12 . . 7 12 16 . . . 14 12 11 12 . . . . . . . .'), bass: N('0 . . . 7 . . . 5 . . . 7 . . . 0 . . . . . . .'), wave: 'square', once: true },
    castle:  { bpm: 88, root: 55, lead: N('0 . 3 . 7 . 3 . 8 . 7 . 3 . . . 0 . 3 . 7 . 12 . 10 . 8 . 7 . . .'), bass: N('0 . . . 0 . . . -4 . . . -4 . . . -2 . . . -2 . . . -5 . . . -5 . . .'), wave: 'triangle' },
  };
  let cur = null, curName = null, timer = null, stepIdx = 0, nextTime = 0, pendingTrack = null;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function schedule() {
    if (!cur || !ac) return;
    const spb = 60 / cur.bpm / 2; // eighth notes
    while (nextTime < ac.currentTime + 0.25) {
      const i = stepIdx % cur.lead.length;
      const l = cur.lead[i];
      const b = cur.bass[stepIdx % cur.bass.length];
      const delay = Math.max(0, nextTime - ac.currentTime);
      if (l != null) tone(mtof(cur.root + 12 + l), spb * 1.6, { type: cur.wave, vol: 0.12, delay, dest: musGain, attack: 0.01 });
      if (b != null) tone(mtof(cur.root - 12 + b), spb * 1.8, { type: 'triangle', vol: 0.22, delay, dest: musGain, attack: 0.01 });
      if (cur.bpm >= 130 && stepIdx % 2 === 0) hiss(0.04, { freq: 7000, vol: 0.05, delay, dest: musGain });
      nextTime += spb;
      stepIdx++;
      if (cur.once && stepIdx >= cur.lead.length) { cur = null; return; }
    }
  }
  G.music = {
    get current() { return curName; },
    play(name) {
      if (curName === name && cur) return;
      curName = name;
      if (!ac) { pendingTrack = name; return; }
      cur = TRACKS[name] || null;
      stepIdx = 0;
      nextTime = ac.currentTime + 0.05;
      if (!timer) timer = setInterval(schedule, 60);
    },
    stop() { cur = null; curName = null; },
    register(name, track) { TRACKS[name] = track; },
    N,
  };
})();
