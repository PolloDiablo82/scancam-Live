/* SoundCard 0.2 — plays hum2loop/1 song files in the browser with Web Audio.
   No dependencies, no audio files: every instrument is synthesised, so songs stay tiny JSON.
   Load with <script src="soundcard.js"></script> (or import it); it sets window.SoundCard.

   const music = SoundCard.load(song);      // object or JSON string
   SoundCard.unlockOnFirstInput();          // browsers need a tap/click before audio
   music.play();  music.play({loop:false, layer:'calm'});
   music.stop(0.3);                         // fade seconds
   music.setVolume(0.6);                    // 0..1, smooth (good for ducking)
   music.setLayer('calm');                  // mood layers from song.layers, crossfades (seconds as 2nd arg)
   music.mute('drums', true);               // by track name or role
   music.setTempo(1.08);                    // 1 = original speed
   SoundCard.render(song,{loops,layer})     // -> Promise<AudioBuffer>, offline (previews)
   SoundCard.note(spec, midi, when, dur)    // play one note on a live instrument spec
   SoundCard.hold(spec, midi) -> release()  // hold a note (keyboards)
   SoundCard.instruments / SoundCard.kits   // [{id,label,group}]

   Song tracks: { name, role, inst?, wave?, vol?, pan?, fx?:{reverb,echo,chorus}, notes:[[step,len,midi,vel?]] }
   `inst` picks an instrument (or a drum kit for drum tracks). Old songs with only `wave` still play.
   song.layers: { calm:[names|roles], fight:[...], boss:[...] } — tracks not listed fade out in that layer.
   song.defaultLayer: layer used until setLayer() is called (no layer = every track plays).
   song.echo: '1/8d' (default) | '1/8' | '1/4' | '1/16'
*/
(function (root) {
  const VERSION = '0.3.0';
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- instruments ----------
     osc: [type, detuneCents, semitoneOffset, level]; types: sine triangle sawtooth square pulse25 pulse12
     env: [attack, decay, sustain(0..1), release]   filter: [type, baseHz, Q, envOctaves, envDecay]
     vib: [rateHz, depthCents, delaySec]            fm: [ratio, index, decay]  breath: noise level */
  const INSTRUMENTS = {
    chip:      { label: 'Chip', group: 'lead', osc: [['square', 0, 0, 1]], env: [.004, .12, .7, .05], level: .2, vib: [5.5, 10, .3] },
    chip25:    { label: 'Chip bright', group: 'lead', osc: [['pulse25', 0, 0, 1]], env: [.004, .12, .7, .05], level: .34, vib: [5.5, 10, .3] },
    chip12:    { label: 'Chip thin', group: 'lead', osc: [['pulse12', 0, 0, 1]], env: [.004, .1, .65, .05], level: .38, vib: [5.5, 10, .3] },
    soft:      { label: 'Soft', group: 'lead', osc: [['triangle', 0, 0, 1]], env: [.01, .15, .75, .1], level: .28, vib: [5, 8, .35] },
    buzzy:     { label: 'Buzzy', group: 'lead', osc: [['sawtooth', -6, 0, .6], ['sawtooth', 6, 0, .6]], filter: ['lowpass', 2600, 2, 1.5, .25], env: [.005, .15, .7, .08], level: .32 },
    synth:     { label: 'Synth lead', group: 'lead', osc: [['sawtooth', -8, 0, .5], ['sawtooth', 8, 0, .5], ['pulse25', 0, -12, .3]], filter: ['lowpass', 1800, 4, 2.2, .3], env: [.01, .25, .75, .15], level: .34, vib: [5.5, 14, .35] },
    pluck:     { label: 'Pluck', group: 'lead', osc: [['sawtooth', -4, 0, .6], ['sawtooth', 4, 0, .6]], filter: ['lowpass', 700, 6, 4.5, .16], env: [.002, .4, 0, .12], level: .46 },
    bell:      { label: 'Bell', group: 'lead', fm: [3.5, 3.2, .9], env: [.002, 1.6, 0, .9], level: .27 },
    organ:     { label: 'Organ', group: 'lead', osc: [['sine', 0, 0, 1], ['sine', 0, 12, .6], ['sine', 0, 19, .35], ['sine', 0, 24, .3]], env: [.006, .05, .95, .06], level: .15 },
    flute:     { label: 'Flute', group: 'lead', osc: [['sine', 0, 0, 1], ['triangle', 0, 12, .1]], breath: .05, env: [.05, .1, .85, .12], level: .2, vib: [5, 18, .3] },
    epiano:    { label: 'E-Piano', group: 'lead', fm: [2, 1.4, .45], osc: [['sine', 0, 0, .55]], env: [.004, .9, .18, .35], level: .26, vib: [4.5, 6, .45] },
    guitar:    { label: 'Acoustic', group: 'lead', osc: [['triangle', -3, 0, .75], ['sawtooth', 3, 0, .35]], filter: ['lowpass', 1100, 2.5, 3.0, .18], env: [.003, .55, .05, .18], level: .36 },
    marimba:   { label: 'Marimba', group: 'lead', osc: [['sine', 0, 0, 1], ['sine', 0, 24, .28]], env: [.002, .26, 0, .12], level: .28 },
    kalimba:   { label: 'Kalimba', group: 'lead', fm: [2.95, 1.6, .18], env: [.002, .52, 0, .25], level: .28 },
    brass:     { label: 'Warm Brass', group: 'lead', osc: [['sawtooth', -7, 0, .55], ['sawtooth', 7, 0, .55]], filter: ['lowpass', 650, 2.2, 2.8, .32], env: [.045, .22, .78, .14], level: .30, vib: [5.2, 9, .35] },
    pad:       { label: 'Pad', group: 'pad', osc: [['sawtooth', -10, 0, .4], ['sawtooth', 10, 0, .4], ['triangle', 0, -12, .5]], filter: ['lowpass', 1200, 1, 1, 1], env: [.45, .5, .8, 1], level: .23 },
    strings:   { label: 'Strings', group: 'pad', osc: [['sawtooth', -7, 0, .5], ['sawtooth', 7, 0, .5], ['sawtooth', 0, 12, .15]], filter: ['lowpass', 2200, 1, .5, .5], env: [.18, .3, .85, .5], level: .24, vib: [5, 8, .4] },
    choir:     { label: 'Choir Pad', group: 'pad', osc: [['sine', -6, 0, .6], ['triangle', 6, 0, .45], ['sine', 0, 12, .25]], filter: ['lowpass', 1600, 1.6, .7, .8], env: [.35, .4, .85, .8], level: .24, vib: [4.8, 12, .45] },
    chipbass:  { label: 'Chip bass', group: 'bass', osc: [['triangle', 0, 0, 1], ['square', 0, 12, .55]], env: [.003, .08, .85, .05], level: .33 },
    pulsebass: { label: 'Pulse bass', group: 'bass', osc: [['square', 0, 0, .8], ['pulse25', 0, 12, .25]], filter: ['lowpass', 1500, 1, 1, .2], env: [.003, .1, .75, .05], level: .34 },
    synthbass: { label: 'Synth bass', group: 'bass', osc: [['sawtooth', 0, 0, .7], ['square', 0, -12, .45], ['sawtooth', 5, 12, .2]], filter: ['lowpass', 420, 7, 3.5, .16], env: [.003, .2, .65, .06], level: .45 },
    subbass:   { label: 'Sub bass', group: 'bass', osc: [['sine', 0, 0, 1], ['triangle', 0, 12, .9], ['sawtooth', 0, 24, .25]], env: [.004, .1, .9, .06], level: .26 },
    pluckbass: { label: 'Pluck bass', group: 'bass', osc: [['pulse25', 0, 0, .8], ['triangle', 0, -12, .5]], filter: ['lowpass', 900, 5, 3.5, .14], env: [.002, .28, .3, .06], level: .55 },
  };
  const KITS = { punchy: 'Punchy', chip: 'Chip', '808': '808' };
  const LEGACY = { square: 'chip', triangle: 'soft', sawtooth: 'buzzy', sine: 'flute' };
  const LEGACY_BASS = { square: 'pulsebass', triangle: 'chipbass', sawtooth: 'synthbass', sine: 'subbass' };
  const ROLE_FX = { lead: { reverb: .16, echo: .1 }, counter: { reverb: .2, echo: .14 }, harmony: { reverb: .28, chorus: .3 }, bass: { reverb: .03 }, drums: { reverb: .07 } };
  const ROLE_PAN = { harmony: -.25, counter: .3 };

  /* ---------- audio graph (one per AudioContext) ---------- */
  let live = null, liveCtx = null, activePlayers = 0, suspendTimer = null;
  function context() {
    if (suspendTimer) { clearTimeout(suspendTimer); suspendTimer = null; }
    if (!liveCtx) { liveCtx = new (root.AudioContext || root.webkitAudioContext)({ latencyHint: 'interactive' }); live = makeGraph(liveCtx); }
    if (liveCtx.state === 'suspended') liveCtx.resume();
    return liveCtx;
  }
  function scheduleSuspend(ms) {
    if (suspendTimer) clearTimeout(suspendTimer);
    suspendTimer = setTimeout(() => {
      suspendTimer = null;
      if (activePlayers === 0 && liveCtx && liveCtx.state === 'running') liveCtx.suspend().catch(() => {});
    }, ms);
  }
  function unlockOnFirstInput() {
    const go = () => { context(); ['pointerdown', 'keydown', 'touchstart'].forEach(e => root.removeEventListener(e, go, true)); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(e => root.addEventListener(e, go, true));
  }
  function impulse(c, secs, power) {
    const n = Math.ceil(secs * c.sampleRate), b = c.createBuffer(2, n, c.sampleRate), pre = Math.floor(.012 * c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = pre; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** power; }
    return b;
  }
  function makeGraph(c) {
    const G = { ctx: c, waves: {}, noise: null, open: null, offline: typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext };
    G.master = c.createGain();
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = .004; comp.release.value = .2;
    G.out = c.createGain(); G.out.gain.value = .8;
    const lim = c.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .1;
    G.master.connect(hp).connect(comp).connect(G.out).connect(lim).connect(c.destination);
    // reverb
    G.reverb = c.createGain();
    const conv = c.createConvolver(); conv.buffer = impulse(c, 2.4, 3.2);
    const rlp = c.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 5500;
    const rret = c.createGain(); rret.gain.value = .9;
    G.reverb.connect(conv).connect(rlp).connect(rret).connect(G.master);
    // echo (tempo-synced on play)
    G.echo = c.createGain(); G.delay = c.createDelay(2); G.delay.delayTime.value = .45;
    const fb = c.createGain(); fb.gain.value = .33; const elp = c.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 2800;
    const eret = c.createGain(); eret.gain.value = .7;
    G.echo.connect(G.delay); G.delay.connect(elp); elp.connect(fb).connect(G.delay); elp.connect(eret).connect(G.master);
    // chorus: two modulated short delays, spread left/right
    G.chorus = c.createGain();
    [[.012, .63, -.7], [.019, .81, .7]].forEach(([dt, rate, p]) => {
      const d = c.createDelay(.1); d.delayTime.value = dt;
      const l = c.createOscillator(); l.frequency.value = rate; const lg = c.createGain(); lg.gain.value = .0025; l.connect(lg).connect(d.delayTime); l.start();
      const pan = c.createStereoPanner(); pan.pan.value = p; const g = c.createGain(); g.gain.value = .8;
      G.chorus.connect(d).connect(g).connect(pan).connect(G.master);
    });
    return G;
  }
  function setEcho(G, bpm, kind) {
    const beat = 60 / bpm, t = ({ '1/8': .5, '1/4': 1, '1/8d': .75, '1/16': .25 }[kind] || .75) * beat;
    G.delay.delayTime.setValueAtTime(clamp(t, .05, 1.9), G.ctx.currentTime);
  }
  function wave(G, type) {
    if (G.waves[type]) return G.waves[type];
    const duty = type === 'pulse25' ? .25 : .125, N = 64, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) { re[n] = Math.sin(2 * Math.PI * n * duty) / (Math.PI * n); im[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (Math.PI * n); }
    return (G.waves[type] = G.ctx.createPeriodicWave(re, im));
  }
  function noise(G) {
    if (!G.noise) {
      const c = G.ctx; G.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = G.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return G.noise;
  }

  /* ---------- one melodic note. dur=null holds until the returned release() ---------- */
  function voice(G, dest, ins, m, t, dur, vel) {
    const c = G.ctx, f = hz(m), out = c.createGain(), lvl = ins.level * (vel == null ? 1 : vel);
    const [a, d, s, r] = ins.env, nodes = [];
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(lvl, t + a); out.gain.setTargetAtTime(lvl * s, t + a, d / 3);
    let into = out;
    if (ins.filter) {
      const [type, base, q, oct, fd] = ins.filter, fl = c.createBiquadFilter(), kb = base * Math.sqrt(f / 261.6);
      fl.type = type; fl.Q.value = q;
      fl.frequency.setValueAtTime(Math.min(16000, kb * 2 ** oct), t); fl.frequency.setTargetAtTime(Math.min(16000, kb), t + .002, fd / 3);
      fl.connect(out); into = fl;
    }
    let vib = null;
    if (ins.vib) {
      const l = c.createOscillator(); l.frequency.value = ins.vib[0]; vib = c.createGain();
      vib.gain.setValueAtTime(0, t); vib.gain.linearRampToValueAtTime(0, t + ins.vib[2]); vib.gain.linearRampToValueAtTime(ins.vib[1], t + ins.vib[2] + .25);
      l.connect(vib); nodes.push(l);
    }
    for (const [type, det, semi, lev] of ins.osc || []) {
      const o = c.createOscillator();
      if (type === 'pulse25' || type === 'pulse12') o.setPeriodicWave(wave(G, type)); else o.type = type;
      o.frequency.value = f * 2 ** (semi / 12); o.detune.value = det; if (vib) vib.connect(o.detune);
      const g = c.createGain(); g.gain.value = lev; o.connect(g).connect(into); nodes.push(o);
    }
    if (ins.fm) {
      const [ratio, index, mdec] = ins.fm, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
      car.frequency.value = f; mod.frequency.value = f * ratio;
      mg.gain.setValueAtTime(f * index, t); mg.gain.setTargetAtTime(f * index * .08, t, mdec / 3);
      mod.connect(mg).connect(car.frequency); car.connect(into); nodes.push(car, mod);
    }
    if (ins.breath) {
      const n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      n.buffer = noise(G); n.loop = true; bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * 2); bp.Q.value = 1.5; g.gain.value = ins.breath * 6;
      n.connect(bp).connect(g).connect(into); nodes.push(n);
    }
    out.connect(dest);
    nodes.forEach(n => n.start(t));
    const finish = (te) => {
      const stopAt = s === 0 ? Math.min(te + r * 2.5, t + a + d * 2.5 + r) : te + r * 2.5;
      nodes.forEach(n => { try { n.stop(stopAt + .02); } catch (e) {} });
      nodes[nodes.length - 1].onended = () => out.disconnect();
    };
    if (dur != null) {
      const te = t + Math.max(.03, dur); out.gain.setTargetAtTime(0, te, r / 3); finish(te);
      return null;
    }
    return () => {
      const n = c.currentTime;
      if (out.gain.cancelAndHoldAtTime) out.gain.cancelAndHoldAtTime(n); else { out.gain.cancelScheduledValues(n); out.gain.setValueAtTime(out.gain.value, n); }
      out.gain.setTargetAtTime(0, n, r / 3); finish(n);
    };
  }

  /* ---------- drums: 36 kick, 37 rim, 38 snare, 39 clap, 42 hat, 44 pedal hat, 46 open hat, 49 crash, 51 ride, 45/47/50 toms ---------- */
  function env(g, t, peak, dec) { g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(.0008, t + dec); }
  function noiseHit(G, dest, t, type, freq, q, peak, dec, offset) {
    const c = G.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise(G); f.type = type; f.frequency.value = freq; f.Q.value = q; env(g, t, peak, dec);
    s.connect(f).connect(g).connect(dest); s.start(t, offset == null ? Math.random() * 1.5 : offset); s.stop(t + dec + .05);
    s.onended = () => g.disconnect();
    return g;
  }
  function toneHit(G, dest, t, type, f0, f1, pdec, peak, dec) {
    const c = G.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + pdec); env(g, t, peak, dec);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dec + .05); o.onended = () => g.disconnect();
  }
  function metal(G, dest, t, peak, dec, hpf) {
    // one always-running bank of six square waves per graph (808 style); each hit is just an envelope on it
    const c = G.ctx;
    if (!G.metal) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 10000; bp.Q.value = .8;
      for (const fr of [205.3, 304.4, 369.6, 522.7, 540, 800]) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = fr; const g = c.createGain(); g.gain.value = .5; o.connect(g).connect(bp); o.start(); }
      G.metal = {};
      for (const f of [7000, 4500]) { const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = f; bp.connect(hp); G.metal[f] = hp; }
    }
    const g = c.createGain(); g.gain.value = 0; env(g, t, peak, dec); G.metal[hpf && hpf < 6000 ? 4500 : 7000].connect(g).connect(dest);
    if (!G.offline) setTimeout(() => { try { g.disconnect(); } catch (e) {} }, (t - c.currentTime + dec + .5) * 1000);
    return g;
  }
  function choke(G, t) {
    if (G.open && G.open.t < t) {
      for (const g of G.open.gs) { try { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, .01); } catch (e) {} }
      G.open = null;
    }
  }
  function drum(G, dest, kit, m, t, vel) {
    const v = (vel == null ? 1 : vel) * (kit === 'chip' ? 1.4 : kit === '808' ? .85 : 1);
    if (kit === 'chip') {
      if (m <= 36) { toneHit(G, dest, t, 'triangle', 180, 40, .09, .9 * v, .16); noiseHit(G, dest, t, 'lowpass', 1500, 1, .25 * v, .03); }
      else if (m === 38 || m === 40) { noiseHit(G, dest, t, 'bandpass', 2600, .9, .7 * v, .13); toneHit(G, dest, t, 'square', 220, 140, .05, .08 * v, .06); }
      else if (m === 39) { noiseHit(G, dest, t, 'bandpass', 1800, 1.2, .6 * v, .1); }
      else if (m === 37) { toneHit(G, dest, t, 'square', 900, 800, .02, .1 * v, .03); }
      else if (m === 42 || m === 44) { choke(G, t); noiseHit(G, dest, t, 'highpass', 9000, .7, .35 * v, .035); }
      else if (m === 46) { const g = noiseHit(G, dest, t, 'highpass', 8000, .7, .3 * v, .22); G.open = { gs: [g], t }; }
      else if (m === 49 || m === 57) noiseHit(G, dest, t, 'highpass', 5500, .5, .3 * v, .9);
      else if (m === 51) noiseHit(G, dest, t, 'bandpass', 7500, 2, .22 * v, .35);
      else toneHit(G, dest, t, 'triangle', hz(m + 5), hz(m - 3), .12, .7 * v, .2);
      return;
    }
    const is808 = kit === '808';
    if (m <= 36) {
      if (is808) { toneHit(G, dest, t, 'sine', 120, 47, .07, 1.05 * v, .75); }
      else { toneHit(G, dest, t, 'sine', 165, 50, .055, 1.0 * v, .34); noiseHit(G, dest, t, 'highpass', 2500, .7, .22 * v, .012, .3); toneHit(G, dest, t, 'triangle', 90, 50, .05, .25 * v, .12); }
    } else if (m === 38 || m === 40) {
      if (is808) { toneHit(G, dest, t, 'triangle', 238, 180, .04, .35 * v, .12); toneHit(G, dest, t, 'triangle', 476, 330, .03, .18 * v, .07); noiseHit(G, dest, t, 'highpass', 1800, .7, .5 * v, .17); }
      else { toneHit(G, dest, t, 'triangle', 210, 160, .05, .42 * v, .1); noiseHit(G, dest, t, 'bandpass', 2200, .7, .7 * v, .17); noiseHit(G, dest, t, 'highpass', 6000, .7, .18 * v, .09); }
    } else if (m === 39) {
      for (const k of [0, .011, .022]) noiseHit(G, dest, t + k, 'bandpass', 1300, 1.6, .55 * v, k < .02 ? .012 : .2, .5);
    } else if (m === 37) {
      toneHit(G, dest, t, 'triangle', 1700, 1500, .01, .3 * v, .03); noiseHit(G, dest, t, 'bandpass', 3000, 2, .2 * v, .02);
    } else if (m === 42 || m === 44) {
      choke(G, t); metal(G, dest, t, (is808 ? .22 : .14) * v, .05); noiseHit(G, dest, t, 'highpass', 8000, .7, (is808 ? .06 : .18) * v, .04);
    } else if (m === 46) {
      const g1 = metal(G, dest, t, (is808 ? .2 : .13) * v, .32); const g2 = noiseHit(G, dest, t, 'highpass', 7500, .7, .12 * v, .28); G.open = { gs: [g1, g2], t };
    } else if (m === 49 || m === 57) {
      metal(G, dest, t, .1 * v, 1.4, 5000); noiseHit(G, dest, t, 'highpass', 5000, .5, .26 * v, 1.3);
    } else if (m === 51) {
      metal(G, dest, t, .1 * v, .7, 4000); noiseHit(G, dest, t, 'bandpass', 8000, 1.5, .08 * v, .5);
    } else {
      const f = hz(m + (is808 ? 0 : 7)); toneHit(G, dest, t, 'sine', f * 1.6, f, .08, .8 * v, is808 ? .5 : .28); noiseHit(G, dest, t, 'lowpass', 2000, .7, .1 * v, .03);
    }
  }

  /* ---------- tracks ---------- */
  const isDrums = t => t.wave === 'drums' || t.role === 'drums' || (t.inst && KITS[t.inst] && !INSTRUMENTS[t.inst]);
  function resolve(t) {
    if (isDrums(t)) return { kit: KITS[t.inst] ? t.inst : 'punchy' };
    if (INSTRUMENTS[t.inst]) return { inst: t.inst };
    return { inst: (t.role === 'bass' ? LEGACY_BASS : LEGACY)[t.wave] || (t.role === 'bass' ? 'pulsebass' : 'chip') };
  }
  function prepTrack(t) {
    const r = resolve(t), byStep = {};
    for (const n of t.notes || []) { const [s, l, m, v] = n; (byStep[s] = byStep[s] || []).push([l, m, v == null ? 1 : v]); }
    return { name: t.name, role: t.role, kit: r.kit, inst: r.inst, vol: t.vol == null ? .7 : t.vol, pan: t.pan == null ? (ROLE_PAN[t.role] || 0) : t.pan,
      fx: t.fx || ROLE_FX[t.role] || (r.kit ? ROLE_FX.drums : ROLE_FX.lead), byStep, muted: false, layerOn: true };
  }
  function makeStrip(G, t, volume) {
    const c = G.ctx, s = { in: c.createGain(), gate: c.createGain(), vol: c.createGain(), pan: c.createStereoPanner(), sends: {} };
    s.vol.gain.value = t.vol * volume; s.pan.pan.value = clamp(t.pan, -1, 1); s.gate.gain.value = t.layerOn && !t.muted ? 1 : 0;
    s.in.connect(s.gate).connect(s.vol).connect(s.pan).connect(G.master);
    for (const k of ['reverb', 'echo', 'chorus']) { const amt = +(t.fx && t.fx[k]) || 0; if (amt > 0) { const g = c.createGain(); g.gain.value = clamp(amt, 0, 1); s.vol.connect(g).connect(G[k]); s.sends[k] = g; } }
    s.kill = () => { try { s.in.disconnect(); s.gate.disconnect(); s.vol.disconnect(); s.pan.disconnect(); for (const g of Object.values(s.sends)) g.disconnect(); } catch (e) {} };
    return s;
  }
  function sound(G, t, dest, l, m, v, when, sp) {
    if (t.kit) drum(G, dest, t.kit, m, when, v);
    else voice(G, dest, INSTRUMENTS[t.inst], m, when, l * sp, v);
  }
  function parse(song) { return typeof song === 'string' ? JSON.parse(song) : song; }
  function layerSet(song, name) { const L = song.layers && name && song.layers[name]; return Array.isArray(L) ? L : null; }
  const inLayer = (set, t) => !set || set.includes(t.name) || set.includes(t.role);

  /* ---------- live player ---------- */
  function load(song) {
    song = parse(song);
    const steps = song.steps || 64, baseBpm = song.bpm || 120, tracks = (song.tracks || []).map(prepTrack);
    let timer = null, step = 0, nextTime = 0, rate = 1, volume = 1, looping = true, playing = false, strips = null, layer = null, G = null;
    const sp = () => 60 / (baseBpm * rate) / 4;
    applyLayer(song.defaultLayer);

    function tick() {
      const c = G.ctx;
      while (nextTime < c.currentTime + .2) {
        if (!looping && step >= steps) {
          clearInterval(timer); timer = null;
          setTimeout(() => { if (!timer && playing) stop(.15); }, Math.max(0, (nextTime - c.currentTime + .4) * 1000));
          return;
        }
        const s = step % steps;
        tracks.forEach((t, i) => { if ((t.layerOn && !t.muted) || nextTime < t.offUntil) for (const [l, m, v] of t.byStep[s] || []) sound(G, t, strips[i].in, l, m, v, nextTime, sp()); });
        nextTime += sp(); step++;
      }
    }
    function play(opts = {}) {
      context(); G = live; stop(0);
      looping = opts.loop !== false;
      if (opts.layer !== undefined) applyLayer(opts.layer);
      setEcho(G, baseBpm * rate, song.echo);
      strips = tracks.map(t => makeStrip(G, t, volume));
      step = 0; nextTime = G.ctx.currentTime + .06; playing = true; activePlayers++;
      timer = setInterval(tick, 25); tick();
    }
    function stop(fade = .3) {
      if (!strips) return;
      clearInterval(timer); timer = null;
      if (playing) { playing = false; activePlayers = Math.max(0, activePlayers - 1); }
      const old = strips, c = G.ctx; strips = null;
      old.forEach(s => s.vol.gain.setTargetAtTime(0, c.currentTime, Math.max(.005, fade / 3)));
      const waitMs = fade * 1000 + 3500;
      setTimeout(() => old.forEach(s => s.kill()), waitMs);
      if (activePlayers === 0) scheduleSuspend(waitMs + 200);
    }
    function gates(fade) {
      if (!strips) return; const c = G.ctx;
      tracks.forEach((t, i) => { const on = t.layerOn && !t.muted; if (!on) t.offUntil = Math.max(t.offUntil || 0, c.currentTime + fade); strips[i].gate.gain.setTargetAtTime(on ? 1 : 0, c.currentTime, Math.max(.01, fade / 3)); });
    }
    function applyLayer(name) { layer = name || null; const set = layerSet(song, layer); tracks.forEach(t => { t.layerOn = inLayer(set, t); }); }
    function setLayer(name, fade = 1.2) { if ((name || null) === layer) return; applyLayer(name); gates(fade); }
    function setVolume(v) {
      volume = clamp(v, 0, 1);
      if (strips) tracks.forEach((t, i) => strips[i].vol.gain.setTargetAtTime(t.vol * volume, G.ctx.currentTime, .05));
    }
    function mute(nameOrRole, on = true) { for (const t of tracks) if (t.name === nameOrRole || t.role === nameOrRole) t.muted = on; gates(.05); }
    function setTempo(r) { rate = clamp(r, .25, 4); if (G && strips) setEcho(G, baseBpm * rate, song.echo); }

    return {
      play, stop, setVolume, mute, setTempo, setLayer,
      get playing() { return playing; }, get layer() { return layer; }, get step() { return step % steps; },
      get layers() { return Object.keys(song.layers || {}); },
      get tracks() { return tracks.map(t => ({ name: t.name, role: t.role, inst: t.inst || t.kit, muted: t.muted, on: t.layerOn })); },
      title: song.title, bpm: baseBpm, steps,
    };
  }

  /* ---------- offline render (previews, exports) ---------- */
  async function render(song, opts = {}) {
    song = parse(song);
    const loops = opts.loops || 1, tempo = opts.tempo || 1, sr = opts.sampleRate || 44100, tail = opts.tail == null ? 2.5 : opts.tail;
    const steps = song.steps || 64, bpm = (song.bpm || 120) * tempo, sp = 60 / bpm / 4, set = layerSet(song, opts.layer === undefined ? song.defaultLayer : opts.layer);
    const c = new (root.OfflineAudioContext || root.webkitOfflineAudioContext)(2, Math.ceil((steps * sp * loops + tail) * sr), sr);
    const G = makeGraph(c); setEcho(G, bpm, song.echo);
    const tracks = (song.tracks || []).map(prepTrack);
    tracks.forEach(t => { t.layerOn = inLayer(set, t); if (opts.mute && (opts.mute.includes(t.name) || opts.mute.includes(t.role))) t.muted = true; });
    const strips = tracks.map(t => makeStrip(G, t, opts.volume == null ? 1 : opts.volume));
    for (let L = 0; L < loops; L++) for (let s = 0; s < steps; s++) {
      const when = .05 + (L * steps + s) * sp;
      tracks.forEach((t, i) => { if (!t.layerOn || t.muted) return; for (const [l, m, v] of t.byStep[s] || []) sound(G, t, strips[i].in, l, m, v, when, sp); });
    }
    return c.startRendering();
  }

  /* ---------- live notes for keyboards and editors ---------- */
  const specStrips = new WeakMap();
  function stripFor(spec) {
    context(); const t = prepTrack({ ...spec, notes: [] }), sig = JSON.stringify([t.kit, t.inst, t.vol, t.pan, t.fx]);
    let e = specStrips.get(spec);
    if (!e || e.sig !== sig) { if (e) setTimeout(e.s.kill, 4000); e = { sig, t, s: makeStrip(live, t, 1) }; specStrips.set(spec, e); }
    return e;
  }
  function note(spec, m, when, dur, vel) {
    const e = stripFor(spec), t0 = when == null ? liveCtx.currentTime : when;
    if (e.t.kit) drum(live, e.s.in, e.t.kit, m, t0, vel); else voice(live, e.s.in, INSTRUMENTS[e.t.inst], m, t0, dur == null ? .3 : dur, vel);
  }
  function hold(spec, m, vel) {
    const e = stripFor(spec);
    if (e.t.kit) { drum(live, e.s.in, e.t.kit, m, liveCtx.currentTime, vel); return () => {}; }
    return voice(live, e.s.in, INSTRUMENTS[e.t.inst], m, liveCtx.currentTime, null, vel);
  }

  const SoundCard = {
    version: VERSION, load, render, note, hold, unlockOnFirstInput,
    setEchoTempo(bpm, kind) { context(); setEcho(live, bpm, kind); },
    get context() { return context(); },
    get output() { context(); return live.master; },
    instruments: Object.entries(INSTRUMENTS).map(([id, v]) => ({ id, label: v.label, group: v.group })),
    kits: Object.entries(KITS).map(([id, label]) => ({ id, label })),
  };
  if (typeof module === 'object' && module.exports) module.exports = SoundCard;
  root.SoundCard = SoundCard;
})(typeof window !== 'undefined' ? window : globalThis);
