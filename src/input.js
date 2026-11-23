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
  let analog = false;
  let runHeld = false;
  let enterQueued = false;
  let hornQueued = false;
  let pauseQueued = false;
  let jumpQueued = false;
  let lookDx = 0;
  let lookDy = 0;

  const actions = {
    play: null,
    resume: null,
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
    stick.style.transform = 'translate(0px, 0px)';
    joystick.classList.remove('active');
    joystick.style.left = '';
    joystick.style.top = '';
    joystick.style.bottom = '';
  }

  function releaseAll() {
    downCodes.clear();
    downKeys.clear();
    pointers.clear();
    joyX = 0;
    joyY = 0;
    analog = false;
    runHeld = false;
    lookDx = 0;
    lookDy = 0;
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
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyQ', 'KeyE', 'KeyH', 'KeyP', 'Space', 'Escape',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(code)
      || ['w', 'a', 's', 'd', 'z', 'q', 'e', 'h', 'p', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)
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

  function placeJoystick(clientX, clientY) {
    const size = joystick.offsetWidth || 160;
    const pad = 8;
    const left = Math.max(pad, Math.min(window.innerWidth - size - pad, clientX - size / 2));
    const top = Math.max(pad, Math.min(window.innerHeight - size - pad, clientY - size / 2));
    joystick.style.left = `${left}px`;
    joystick.style.top = `${top}px`;
    joystick.style.bottom = 'auto';
  }

  function updateJoy(pointer) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = pointer.x - cx;
    const dy = pointer.y - cy;
    const max = rect.width * 0.38;
    const mag = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(mag, max);
    const nx = (dx / mag) * (clamped / max);
    const ny = -((dy / mag) * (clamped / max));
    const strength = Math.hypot(nx, ny);
    if (strength < 0.16) {
      joyX = 0;
      joyY = 0;
    } else {
      joyX = nx;
      joyY = ny;
    }
    analog = true;
    joystick.classList.add('active');
    stick.style.transform = `translate(${(dx / mag) * clamped}px, ${(dy / mag) * clamped}px)`;
  }

  function syncRun() {
    runHeld = [...pointers.values()].some((pointer) => pointer.kind === 'run');
  }

  function releasePointer(id) {
    const pointer = pointers.get(id);
    if (!pointer) return;
    pointers.delete(id);
    if (pointer.button) pointer.button.classList.remove('held');
    if (pointer.kind === 'joy' && ![...pointers.values()].some((item) => item.kind === 'joy')) {
      joyX = 0;
      joyY = 0;
      analog = false;
      resetStickVisual();
    }
    if (pointer.kind === 'look') {
      /* le delta déjà accumulé sera lu par consumeLook */
    }
    syncRun();
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
    return null;
  }

  function blocked(target) {
    return Boolean(target?.closest?.('#start .card, #pause .card, #bust .card, #loader, a, input, textarea'));
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
    if (button) button.classList.add('held');
    if (kind === 'joy-pad') placeJoystick(event.clientX, event.clientY);
    const record = { kind: kind === 'joy-pad' ? 'joy' : kind, x: event.clientX, y: event.clientY, button };
    pointers.set(event.pointerId, record);
    if (record.kind === 'joy') updateJoy(record);
    if (kind === 'run') syncRun();
    if (kind === 'vehicle') enterQueued = true;
    if (kind === 'horn') hornQueued = true;
    if (kind === 'pause') pauseQueued = true;
    if (kind === 'play') actions.play?.();
    if (kind === 'resume') actions.resume?.();
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
  window.addEventListener('lostpointercapture', endPointer);

  window.addEventListener('contextmenu', (event) => event.preventDefault());

  for (const button of [...Object.values(buttons), playBtn, resumeBtn]) {
    button.addEventListener('keydown', (event) => event.preventDefault());
  }

  return {
    setActions(next) {
      actions.play = next.play;
      actions.resume = next.resume;
    },
    sample() {
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
        run: shift || runHeld,
        analog,
        space: downCodes.has('Space') || downKeys.has(' '),
        runHeld,
      };
    },
    consume() {
      const edges = {
        enter: enterQueued,
        horn: hornQueued,
        pause: pauseQueued,
        jump: jumpQueued,
      };
      enterQueued = false;
      hornQueued = false;
      pauseQueued = false;
      jumpQueued = false;
      return edges;
    },
    consumeLook() {
      const look = { x: lookDx, y: lookDy };
      lookDx = 0;
      lookDy = 0;
      return look;
    },
  };
}
