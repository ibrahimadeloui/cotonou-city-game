const LINES = {
  cava: { speaker: 'Passant', text: 'Ça va ?' },
  doucement: { speaker: 'Passant', text: 'Doucement !' },
  yovo: { speaker: 'Passant', text: 'Yovo !', fon: 'Yovo.' },
  ahnon: { speaker: 'Passant', text: 'Ah non !' },
  mikudo: { speaker: 'Passant', text: 'Mi kudo.', fon: 'Mi kudo. — Je te salue.' },
  zem: { speaker: 'Koffi', text: 'Monte, on file à Dantokpa.' },
  port: { speaker: 'Client', text: 'Le port nous attend.' },
  marche: { speaker: 'Vendeuse', text: 'Dantokpa, attention aux étals.' },
  police: { speaker: 'Policier', text: 'La police ! File !' },
  patron: { speaker: 'Le patron', text: 'Tu cherches le patron ?' },
  vendeur: { speaker: 'L\'aîné', text: 'Protège l\'étal, hein.' },
  course: { speaker: 'Maman', text: 'La Route des Pêches, vite !' },
  hopital: { speaker: 'Infirmier', text: 'L\'hôpital te relève. Doucement.' },
  finale: { speaker: 'Koffi', text: 'Bienvenue à la Marina.' },
};

const IDLE = ['cava', 'yovo', 'mikudo', 'doucement'];

const clips = import.meta.glob('./assets/voices/*.wav', { eager: true, query: '?url', import: 'default' });

function clipUrl(id) {
  return clips[`./assets/voices/${id}.wav`];
}

export function createVoices(audio) {
  const box = document.getElementById('subtitle');
  const nameEl = document.getElementById('sub-name');
  const textEl = document.getElementById('sub-text');
  const fonEl = document.getElementById('sub-fon');
  const queue = [];
  let current = null;
  let held = false;
  let cool = 4;
  let frenchVoice = null;

  function pickVoice() {
    const synth = window.speechSynthesis;
    if (!synth) return null;
    const list = synth.getVoices?.() || [];
    frenchVoice = list.find((voice) => /fr[-_]FR/i.test(voice.lang) && /google|thomas|audrey|am[ée]lie|denise/i.test(voice.name))
      || list.find((voice) => /^fr/i.test(voice.lang))
      || null;
    return frenchVoice;
  }
  window.speechSynthesis?.addEventListener?.('voiceschanged', pickVoice);
  pickVoice();

  function show(line) {
    if (!box) return;
    if (nameEl) nameEl.textContent = line.speaker || 'Quelqu\'un';
    if (textEl) textEl.textContent = line.text || '';
    if (fonEl) {
      fonEl.textContent = line.fon || '';
      fonEl.hidden = !line.fon;
    }
    box.classList.remove('hidden');
    box.classList.add('on');
  }

  function hide() {
    box?.classList.remove('on');
    box?.classList.add('hidden');
    audio?.setTalking(false);
  }

  function finish() {
    current = null;
    if (queue.length) {
      play(queue.shift());
      return;
    }
    if (!held) hide();
  }

  function speak(line, done) {
    const synth = window.speechSynthesis;
    if (!synth || !line.text) return false;
    try {
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(line.text);
      utter.lang = 'fr-FR';
      utter.rate = 0.96;
      utter.pitch = 1;
      utter.volume = 1;
      if (!frenchVoice) pickVoice();
      if (frenchVoice) utter.voice = frenchVoice;
      utter.onend = done;
      utter.onerror = done;
      synth.speak(utter);
      return true;
    } catch {
      return false;
    }
  }

  function play(line) {
    current = line;
    if (line.hold) held = true;
    show(line);
    audio?.setTalking(true);
    const spoken = speak(line, finish);
    if (spoken) return;
    const url = line.id ? clipUrl(line.id) : '';
    if (url && audio?.playClip) {
      audio.playClip(url, { pan: line.pan || 0, onend: finish });
      return;
    }
    window.setTimeout(finish, 2200);
  }

  function enqueue(line) {
    if (!line?.text) return;
    if (current) queue.push(line);
    else play(line);
  }

  function say(id, pan = 0) {
    const line = LINES[id];
    if (!line) return;
    enqueue({ ...line, id, pan });
  }

  function sayLine(line) {
    if (!line?.text) return;
    enqueue(line);
  }

  function skip() {
    held = false;
    queue.length = 0;
    try { window.speechSynthesis?.cancel(); } catch { /* rien */ }
    audio?.stopClip?.();
    current = null;
    hide();
  }

  return {
    say,
    sayLine,
    skip,
    talking() { return Boolean(current) || queue.length > 0; },
    tick(dt, player, peds) {
      cool -= dt;
      if (cool > 0 || player.vehicle || current) return;
      let nearest = Infinity;
      let pan = 0;
      for (const ped of peds) {
        if (ped.down || !ped.mesh?.visible) continue;
        const dx = ped.pos.x - player.pos.x;
        const dz = ped.pos.z - player.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < nearest) {
          nearest = dist;
          pan = Math.max(-0.45, Math.min(0.45, dx / 14));
        }
      }
      if (nearest < 3.2) {
        say(IDLE[Math.floor(Math.random() * IDLE.length)], pan);
        cool = 11;
      }
    },
  };
}
