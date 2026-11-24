/**
 * Contrôles clavier (AZERTY + QWERTY) et tactiles.
 * Les pointeurs sont suivis sur window : un doigt peut quitter le bouton
 * sans laisser l'action bloquée, et le joystick reste utilisable en même temps.
 */
export function createInput() {
  const downCodes = new Set();
  const downKeys = new Set();
  const pointers = new Map();

  let joyX = 0;
  let joyY = 0;
  let aimX = 0;
  let aimY = 0;
  let visX = 0;
  let visY = 0;
  let visAimX = 0;
  let visAimY = 0;
  let stickLive = false;
  let analog = false;
  let runHeld = false;
  let enterQueued = false;
  let hornQueued = false;
  let pauseQueued = false;
  let jumpQueued = false;
  let selfieQueued = false;
  let outfitQueued = false;
  let punchQueued = false;
  let dodgeQueued = false;
  let camQueued = false;
  let gasHeld = false;
  let brakeHeld = false;
  let handHeld = false;
  let nitroHeld = false;
  let steerLeft = false;
  let steerRight = false;
  let lookDx = 0;
  let lookDy = 0;

  const actions = {
    play: null,
    resume: null,
    outfit: null,
    density: null,
    steer: null,
  };

  const joystick = document.getElementById('joystick');
  const stick = document.getElementById('stick');
  const buttons = {
    run: document.getElementById('btn-run'),
    vehicle: document.getElementById('btn-vehicle'),
    horn: document.getElementById('btn-horn'),
    pause: document.getElementById('btn-pause'),
  };
  const playBtn = document.getElementById('play');
  const resumeBtn = document.getElementById('resume');

  function resetStickVisual() {
    aimX = 0;
    aimY = 0;
    joyX = 0;
    joyY = 0;
    visX = 0;
    visY = 0;
    visAimX = 0;
    visAimY = 0;
    stickLive = false;
    stick.style.transform = 'translate(0px, 0px)';
    joystick.classList.remove('active');
    joystick.style.left = '';
    joystick.style.top = '';
    joystick.style.bottom = '';
  }

  function buzz(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function ease(current, target, lambda, dt) {
    return current + (target - current) * (1 - Math.exp(-lambda * Math.max(0, dt)));
  }

  function tickStick(dt) {
    const step = Number.isFinite(dt) ? dt : 1 / 60;
    joyX = ease(joyX, aimX, 12, step);
    joyY = ease(joyY, aimY, 12, step);
    if (Math.hypot(joyX, joyY) < 0.012) {
      joyX = 0;
      joyY = 0;
    }
    visX = ease(visX, visAimX, 20, step);
    visY = ease(visY, visAimY, 20, step);
    if (!stickLive && Math.hypot(visX, visY) < 0.8) {
      visX = 0;
      visY = 0;
      joystick.classList.remove('active');
    }
    stick.style.transform = `translate(${visX.toFixed(2)}px, ${visY.toFixed(2)}px)`;
  }

  function releaseAll() {
    downCodes.clear();
    downKeys.clear();
    pointers.clear();
    analog = false;
    runHeld = false;
    lookDx = 0;
    lookDy = 0;
    selfieQueued = false;
    outfitQueued = false;
    resetStickVisual();
    for (const button of Object.values(buttons)) button.classList.remove('held');
    playBtn.classList.remove('held');
    resumeBtn.classList.remove('held');
  }

  function rememberKey(event, pressed) {
    if (event.code) {
      if (pressed) downCodes.add(event.code);
      else downCodes.delete(event.code);
    }
    if (event.key) {
      const key = event.key.toLowerCase();
      if (pressed) downKeys.add(key);
      else downKeys.delete(key);
    }
  }

  function handledKey(event) {
    const code = event.code || '';
    const key = (event.key || '').toLowerCase();
    return (
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyQ', 'KeyE', 'KeyH', 'KeyP', 'KeyC', 'KeyV', 'KeyF', 'KeyR', 'Space', 'Escape',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(code)
      || ['w', 'a', 's', 'd', 'z', 'q', 'e', 'h', 'p', 'c', 'v', 'f', 'r', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)
    );
  }

  window.addEventListener('keydown', (event) => {
    if (!handledKey(event)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (event.target?.closest?.('button, a, input, textarea')) event.target.blur?.();
    rememberKey(event, true);
    const code = event.code;
    const key = (event.key || '').toLowerCase();
    if (code === 'KeyE' || key === 'e') enterQueued = true;
    if (code === 'KeyH' || key === 'h') hornQueued = true;
    if (code === 'Space' || key === ' ') jumpQueued = true;
    if (code === 'Escape' || code === 'KeyP' || key === 'p' || key === 'escape') pauseQueued = true;
    if (code === 'KeyC' || key === 'c') selfieQueued = true;
    if (code === 'KeyV' || key === 'v') outfitQueued = true;
    if (code === 'KeyF' || key === 'f') punchQueued = true;
    if (code === 'KeyR' || key === 'r') dodgeQueued = true;
  });

  window.addEventListener('keyup', (event) => {
    if (handledKey(event)) event.preventDefault();
    rememberKey(event, false);
  });

  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });

  function has(codes, keys) {
    for (const code of codes) if (downCodes.has(code)) return true;
    for (const key of keys) if (downKeys.has(key)) return true;
    return false;
  }

  function joystickCenter() {
    const rect = joystick.getBoundingClientRect();
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      max: rect.width * 0.42,
    };
  }

  function updateJoy(pointer) {
    // Origine figée au premier contact. clientX vers la droite, clientY vers le bas.
    // joyX > 0 = bouton à droite, même signe que D. joyY > 0 = bouton vers le haut.
    // Ne pas inverser joyX : la droite écran est cameraPlanarBasis().right.
    const dx = pointer.x - pointer.cx;
    const dy = pointer.y - pointer.cy;
    const max = pointer.max || 40;
    const mag = Math.hypot(dx, dy);
    const clamped = Math.min(mag, max);
    const nx = mag > 0 ? (dx / mag) * (clamped / max) : 0;
    const ny = mag > 0 ? -((dy / mag) * (clamped / max)) : 0;
    const strength = Math.hypot(nx, ny);
    const dead = 0.14;
    if (strength < dead) {
      aimX = 0;
      aimY = 0;
      analog = false;
    } else {
      const t = (strength - dead) / (1 - dead);
      const curved = t * t;
      aimX = (nx / strength) * curved;
      aimY = (ny / strength) * curved;
      analog = true;
    }
    visAimX = nx * max;
    visAimY = -ny * max;
    stickLive = true;
    joystick.classList.add('active');
  }

  function syncRun() {
    runHeld = [...pointers.values()].some((pointer) => pointer.kind === 'run');
  }

  function syncDrive() {
    const kinds = [...pointers.values()].map((pointer) => pointer.kind);
    gasHeld = kinds.includes('gas');
    brakeHeld = kinds.includes('brake');
    handHeld = kinds.includes('hand');
    nitroHeld = kinds.includes('nitro');
    steerLeft = kinds.includes('steerL');
    steerRight = kinds.includes('steerR');
  }

  function releasePointer(id) {
    const pointer = pointers.get(id);
    if (!pointer) return;
    pointers.delete(id);
    if (pointer.button) pointer.button.classList.remove('held');
    if (pointer.kind === 'joy' && ![...pointers.values()].some((item) => item.kind === 'joy')) {
      aimX = 0;
      aimY = 0;
      visAimX = 0;
      visAimY = 0;
      stickLive = false;
      analog = false;
    }
    if (pointer.kind === 'look') {
      /* le delta déjà accumulé sera lu par consumeLook */
    }
    syncRun();
    syncDrive();
  }

  function kindOf(target) {
    if (!target?.closest) return null;
    if (target.closest('#btn-run')) return 'run';
    if (target.closest('#btn-vehicle')) return 'vehicle';
    if (target.closest('#btn-horn')) return 'horn';
    if (target.closest('#btn-pause')) return 'pause';
    if (target.closest('#play')) return 'play';
    if (target.closest('#resume')) return 'resume';
    if (target.closest('#joystick')) return 'joy';
    if (target.closest('#joy-pad')) return 'joy-pad';
    if (target.closest('#avatar')) return 'selfie';
    if (target.closest('#btn-outfit')) return 'outfit';
    if (target.closest('#btn-density')) return 'density';
    if (target.closest('#btn-punch')) return 'punch';
    if (target.closest('#btn-dodge')) return 'dodge';
    if (target.closest('#btn-gas')) return 'gas';
    if (target.closest('#btn-brake')) return 'brake';
    if (target.closest('#btn-handbrake')) return 'hand';
    if (target.closest('#btn-nitro')) return 'nitro';
    if (target.closest('#btn-horn-drive')) return 'horn';
    if (target.closest('#btn-cam')) return 'cam';
    if (target.closest('#btn-exit')) return 'vehicle';
    if (target.closest('#btn-steer-left')) return 'steerL';
    if (target.closest('#btn-steer-right')) return 'steerR';
    if (target.closest('#btn-steer-mode')) return 'steer-mode';
    return null;
  }

  function blocked(target) {
    return Boolean(target?.closest?.('#start, #pause .card, #credits .card, #bust .card, #brief .card, #result .card, #install-hint, #loader, a, input, textarea'));
  }

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const kind = kindOf(event.target);
    if (!kind) {
      if (blocked(event.target)) return;
      if ([...pointers.values()].some((pointer) => pointer.kind === 'look')) return;
      event.preventDefault();
      pointers.set(event.pointerId, { kind: 'look', x: event.clientX, y: event.clientY });
      return;
    }
    event.preventDefault();
    const button = event.target.closest?.('button') || null;
    if (button) {
      button.classList.add('held');
      buzz(10);
    }
    const origin = (kind === 'joy' || kind === 'joy-pad')
      ? joystickCenter()
      : null;
    const record = {
      kind: kind === 'joy-pad' ? 'joy' : kind,
      x: event.clientX,
      y: event.clientY,
      cx: origin?.cx,
      cy: origin?.cy,
      max: origin?.max,
      button,
    };
    pointers.set(event.pointerId, record);
    if (record.kind === 'joy') updateJoy(record);
    if (kind === 'run') {
      syncRun();
      jumpQueued = true;
    }
    if (kind === 'vehicle') enterQueued = true;
    if (kind === 'horn') hornQueued = true;
    if (kind === 'pause') pauseQueued = true;
    if (kind === 'play') actions.play?.();
    if (kind === 'resume') actions.resume?.();
    if (kind === 'selfie') selfieQueued = true;
    if (kind === 'outfit') outfitQueued = true;
    if (kind === 'density') actions.density?.();
    if (kind === 'punch') punchQueued = true;
    if (kind === 'dodge') dodgeQueued = true;
    if (kind === 'cam') camQueued = true;
    if (kind === 'steer-mode') actions.steer?.();
    syncDrive();
  }, { passive: false });

  window.addEventListener('pointermove', (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    if (pointer.kind === 'joy' || pointer.kind === 'look') event.preventDefault();
    if (pointer.kind === 'look') {
      lookDx += event.clientX - pointer.x;
      lookDy += event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      return;
    }
    if (pointer.kind === 'joy') {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      updateJoy(pointer);
    }
  }, { passive: false });

  const endPointer = (event) => releasePointer(event.pointerId);
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);

  window.addEventListener('contextmenu', (event) => event.preventDefault());

  for (const button of [...Object.values(buttons), playBtn, resumeBtn, document.getElementById('btn-outfit'), document.getElementById('btn-density'), document.getElementById('btn-punch'), document.getElementById('btn-dodge')]) {
    button?.addEventListener('keydown', (event) => event.preventDefault());
  }

  return {
    setActions(next) {
      actions.play = next.play;
      actions.resume = next.resume;
      actions.outfit = next.outfit || null;
      actions.density = next.density || null;
      actions.steer = next.steer || null;
    },
    sample(dt) {
      tickStick(dt);
      const forward = (has(['KeyW', 'ArrowUp'], ['w', 'z', 'arrowup']) ? 1 : 0)
        - (has(['KeyS', 'ArrowDown'], ['s', 'arrowdown']) ? 1 : 0);
      const right = (has(['KeyD', 'ArrowRight'], ['d', 'arrowright']) ? 1 : 0)
        - (has(['KeyA', 'ArrowLeft', 'KeyQ'], ['a', 'q', 'arrowleft']) ? 1 : 0);
      let fx = forward + joyY;
      let rx = right + joyX;
      const mag = Math.hypot(fx, rx);
      if (mag > 1) {
        fx /= mag;
        rx /= mag;
      }
      const shift = downCodes.has('ShiftLeft') || downCodes.has('ShiftRight');
      return {
        forward: fx,
        right: rx,
        keyForward: forward,
        keyRight: right,
        joyX,
        joyY,
        run: shift || runHeld,
        analog,
        space: downCodes.has('Space') || downKeys.has(' '),
        runHeld,
        gas: gasHeld,
        brake: brakeHeld,
        hand: handHeld,
        nitro: nitroHeld,
        steerLeft,
        steerRight,
      };
    },
    consume() {
      const edges = {
        enter: enterQueued,
        horn: hornQueued,
        pause: pauseQueued,
        jump: jumpQueued,
        selfie: selfieQueued,
        outfit: outfitQueued,
        punch: punchQueued,
        dodge: dodgeQueued,
        cam: camQueued,
      };
      enterQueued = false;
      hornQueued = false;
      pauseQueued = false;
      jumpQueued = false;
      selfieQueued = false;
      outfitQueued = false;
      punchQueued = false;
      dodgeQueued = false;
      camQueued = false;
      return edges;
    },
    consumeLook() {
      const look = { x: lookDx, y: lookDy };
      lookDx = 0;
      lookDy = 0;
      return look;
    },
    held() {
      return { run: runHeld };
    },
    knob() {
      const rect = joystick.getBoundingClientRect();
      return {
        x: visX,
        y: visY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
      };
    },
    setJoySize(px) {
      const size = Math.max(80, Math.min(130, Math.round(px)));
      const knob = Math.round(size * 0.42);
      joystick.style.width = `${size}px`;
      joystick.style.height = `${size}px`;
      stick.style.width = `${knob}px`;
      stick.style.height = `${knob}px`;
      stick.style.marginLeft = `${-knob / 2}px`;
      stick.style.marginTop = `${-knob / 2}px`;
      localStorage.setItem('cotonou-joy', String(size));
    },
  };
}
