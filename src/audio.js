export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let oceanGain = null;
  let sirenOsc = null;
  let sirenGain = null;
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
    engineOsc.start();

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
    noise.start();

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
    sirenOsc.start();
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
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  return {
    resume() {
      try {
        ensure();
        if (ctx && ctx.state !== 'running') ctx.resume();
      } catch {
        ready = false;
      }
    },
    update({ driving, speed, maxSpeed, nearOcean, wanted, time }) {
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
