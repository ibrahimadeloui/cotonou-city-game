const LINES = {
  cava: 'Ça va ?',
  doucement: 'Doucement !',
  yovo: 'Yovo !',
  ahnon: 'Ah non !',
  mikudo: 'Mi kudo.',
  zem: 'Monte, on file à Dantokpa.',
  port: 'Le port nous attend.',
  marche: 'Dantokpa, attention aux étals.',
  police: 'La police ! File !',
  patron: 'Tu cherches le patron ?',
  vendeur: 'Protège l\'étal, hein.',
  course: 'La Route des Pêches, vite !',
  hopital: 'L\'hôpital te relève. Doucement.',
  finale: 'Bienvenue à la Marina.',
};

const IDLE = ['cava', 'yovo', 'mikudo', 'doucement'];

const clips = import.meta.glob('./assets/voices/*.wav', { eager: true, query: '?url', import: 'default' });

function clipUrl(id) {
  return clips[`./assets/voices/${id}.wav`];
}

export function createVoices() {
  const bubble = document.getElementById('speech');
  let hideAt = 0;
  let cool = 2.5;
  const players = new Map();

  function show(id) {
    const text = LINES[id];
    if (!text || !bubble) return;
    bubble.textContent = text;
    bubble.classList.add('on');
    hideAt = performance.now() + 2600;
  }

  function say(id) {
    if (!LINES[id]) return;
    show(id);
    const url = clipUrl(id);
    if (url) {
      let audio = players.get(id);
      if (!audio) {
        audio = new Audio(url);
        audio.preload = 'auto';
        players.set(id, audio);
      }
      audio.currentTime = 0;
      audio.play().catch(() => speak(LINES[id]));
      return;
    }
    speak(LINES[id]);
  }

  function speak(text) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'fr-FR';
      utter.rate = 1.05;
      synth.cancel();
      synth.speak(utter);
    } catch {
      /* le sous-titre reste affiché */
    }
  }

  return {
    say,
    tick(dt, player, peds) {
      if (bubble && performance.now() > hideAt) bubble.classList.remove('on');
      cool -= dt;
      if (cool > 0 || player.vehicle) return;
      let nearest = Infinity;
      for (const ped of peds) {
        if (ped.down || !ped.mesh.visible) continue;
        const dist = Math.hypot(ped.pos.x - player.pos.x, ped.pos.z - player.pos.z);
        if (dist < nearest) nearest = dist;
      }
      if (nearest < 3.4) {
        say(IDLE[Math.floor(Math.random() * IDLE.length)]);
        cool = 9;
      }
    },
  };
}
