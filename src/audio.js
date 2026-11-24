export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let oceanGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let marketGain = null;
  let musicA = null;
  let musicB = null;
  let musicGain = null;
  let motoOsc = null;
  let motoGain = null;
  let ready = false;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    try { engineOsc.start(); } catch { /* WebKit sans sortie audio */ }

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const of = ctx.createBiquadFilter();
    of.type = 'lowpass';
    of.frequency.value = 500;
    oceanGain = ctx.createGain();
    oceanGain.gain.value = 0;
    noise.connect(of);
    of.connect(oceanGain);
    oceanGain.connect(ctx.destination);
    try { noise.start(); } catch { /* silence */ }

    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 540;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 900;
    sirenOsc.connect(sf);
    sf.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    try { sirenOsc.start(); } catch { /* silence */ }

    const crowd = ctx.createBufferSource();
    crowd.buffer = buffer;
    crowd.loop = true;
    const crowdFilter = ctx.createBiquadFilter();
    crowdFilter.type = 'bandpass';
    crowdFilter.frequency.value = 900;
    crowdFilter.Q.value = 0.7;
    marketGain = ctx.createGain();
    marketGain.gain.value = 0;
    crowd.connect(crowdFilter);
    crowdFilter.connect(marketGain);
    marketGain.connect(ctx.destination);
    try { crowd.start(); } catch { /* silence */ }

    musicA = ctx.createOscillator();
    musicB = ctx.createOscillator();
    musicA.type = 'triangle';
    musicB.type = 'sine';
    musicA.frequency.value = 196;
    musicB.frequency.value = 247;
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicA.connect(musicGain);
    musicB.connect(musicGain);
    musicGain.connect(ctx.destination);
    try { musicA.start(); musicB.start(); } catch { /* silence */ }

    motoOsc = ctx.createOscillator();
    motoOsc.type = 'sawtooth';
    motoOsc.frequency.value = 90;
    const motoFilter = ctx.createBiquadFilter();
    motoFilter.type = 'lowpass';
    motoFilter.frequency.value = 420;
    motoGain = ctx.createGain();
    motoGain.gain.value = 0;
    motoOsc.connect(motoFilter);
    motoFilter.connect(motoGain);
    motoGain.connect(ctx.destination);
    try { motoOsc.start(); } catch { /* silence */ }
    ready = true;
  }

  function tone(freq, dur = 0.22, type = 'sine', gain = 0.05) {
    if (!ready) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    try {
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      /* silence */
    }
  }

  return {
    resume() {
      try {
        ensure();
        if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
      } catch {
        ready = false;
      }
    },
    update({ driving, speed, maxSpeed, nearOcean, wanted, time, x = 0, z = 0, vehicles = [] }) {
      if (!ready) return;
      const now = ctx.currentTime;
      const eg = driving ? 0.018 + (Math.abs(speed) / Math.max(1, maxSpeed)) * 0.035 : 0;
      engineGain.gain.setTargetAtTime(eg, now, 0.08);
      if (driving) engineOsc.frequency.setTargetAtTime(46 + Math.abs(speed) * 5.5, now, 0.08);
      oceanGain.gain.setTargetAtTime(nearOcean ? 0.02 : 0.004, now, 0.3);
      sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.01 : 0, now, 0.1);
      if (wanted > 0) {
        sirenOsc.frequency.setTargetAtTime(Math.sin(time * 9) > 0 ? 680 : 480, now, 0.05);
      }
      const market = Math.max(0, 1 - Math.hypot(x, z - 134) / 42);
      marketGain.gain.setTargetAtTime(market * market * 0.045, now, 0.2);
      const maquis = Math.max(0, 1 - Math.hypot(x + 148, z - 28) / 28);
      const wobble = 0.7 + Math.sin(time * 1.7) * 0.3;
      musicGain.gain.setTargetAtTime(maquis * maquis * 0.02 * wobble, now, 0.15);
      let moto = 0;
      let hz = 90;
      for (const vehicle of vehicles) {
        if (vehicle.dead || vehicle.type !== 'zem' || vehicle.controlled) continue;
        const d = Math.hypot(vehicle.pos.x - x, vehicle.pos.z - z);
        const hear = Math.max(0, 1 - d / 36) * Math.min(1, Math.abs(vehicle.speed) / 8);
        if (hear > moto) {
          moto = hear;
          hz = 70 + Math.abs(vehicle.speed) * 7;
        }
        if (vehicle.hornT > 0.2 && !vehicle.hornSound) {
          vehicle.hornSound = true;
          tone(vehicle.type === 'zem' ? 320 : 190, 0.15, 'square', 0.012 + hear * 0.02);
        }
        if (vehicle.hornT <= 0) vehicle.hornSound = false;
      }
      motoGain.gain.setTargetAtTime(moto * 0.03, now, 0.08);
      motoOsc.frequency.setTargetAtTime(hz, now, 0.08);
    },
    blip(kind) {
      if (kind === 'cash') {
        tone(520, 0.12);
        setTimeout(() => tone(780, 0.18), 90);
      } else if (kind === 'pick') tone(440, 0.12);
      else if (kind === 'bad') tone(140, 0.28, 'sawtooth', 0.04);
      else tone(360, 0.1);
    },
    horn() {
      tone(220, 0.18, 'square', 0.03);
      setTimeout(() => tone(185, 0.22, 'square', 0.03), 160);
    },
  };
}
