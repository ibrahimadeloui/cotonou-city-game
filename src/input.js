export function createInput() {
  const down = new Set();
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

  const joystick = document.getElementById('joystick');
  const stick = document.getElementById('stick');
  const btnRun = document.getElementById('btn-run');
  const btnVehicle = document.getElementById('btn-vehicle');
  const btnHorn = document.getElementById('btn-horn');
  const btnPause = document.getElementById('btn-pause');

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === 'KeyE') enterQueued = true;
    if (event.code === 'KeyH') hornQueued = true;
    if (event.code === 'Space') jumpQueued = true;
    if (event.code === 'Escape' || event.code === 'KeyP') pauseQueued = true;
  });
  window.addEventListener('keyup', (event) => down.delete(event.code));
  window.addEventListener('blur', () => {
    down.clear();
    runHeld = false;
    analog = false;
    joyX = 0;
    joyY = 0;
    resetStick();
  });

  let joyId = null;
  function joyVector(event) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const max = rect.width * 0.34;
    const mag = Math.hypot(dx, dy) || 1;
    const cl = Math.min(mag, max);
    joyX = (dx / mag) * (cl / max);
    joyY = -((dy / mag) * (cl / max));
    analog = true;
    stick.style.transform = `translate(${(dx / mag) * cl}px, ${(dy / mag) * cl}px)`;
  }
  function resetStick() {
    stick.style.transform = 'translate(0px, 0px)';
  }
  function endJoy(id) {
    if (id !== joyId) return;
    joyId = null;
    joyX = 0;
    joyY = 0;
    analog = false;
    resetStick();
  }

  joystick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    joyId = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    joyVector(event);
  });
  joystick.addEventListener('pointermove', (event) => {
    if (event.pointerId === joyId) joyVector(event);
  });
  joystick.addEventListener('pointerup', (event) => endJoy(event.pointerId));
  joystick.addEventListener('pointercancel', (event) => endJoy(event.pointerId));

  function holdButton(button, onDown, onUp) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.classList.add('held');
      button.setPointerCapture(event.pointerId);
      onDown();
    });
    const release = () => {
      button.classList.remove('held');
      if (onUp) onUp();
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('keydown', (event) => event.preventDefault());
  }
  holdButton(btnRun, () => { runHeld = true; }, () => { runHeld = false; });
  holdButton(btnVehicle, () => { enterQueued = true; });
  holdButton(btnHorn, () => { hornQueued = true; });
  holdButton(btnPause, () => { pauseQueued = true; });

  let lookId = null;
  let lastX = 0;
  let lastY = 0;
  function blocked(target) {
    return Boolean(target.closest?.('#touch, #start, #pause, #bust, button, a, #map-wrap'));
  }
  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (blocked(event.target)) return;
    if (joyId !== null && event.pointerId === joyId) return;
    lookId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointermove', (event) => {
    if (event.pointerId !== lookId) return;
    lookDx += event.clientX - lastX;
    lookDy += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  const endLook = (event) => {
    if (event.pointerId === lookId) lookId = null;
  };
  window.addEventListener('pointerup', endLook);
  window.addEventListener('pointercancel', endLook);

  window.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    sample() {
      const forwardKeys = (down.has('KeyW') || down.has('ArrowUp') ? 1 : 0)
        - (down.has('KeyS') || down.has('ArrowDown') ? 1 : 0);
      const rightKeys = (down.has('KeyD') || down.has('ArrowRight') ? 1 : 0)
        - (down.has('KeyA') || down.has('ArrowLeft') ? 1 : 0);
      let forward = forwardKeys + joyY;
      let right = rightKeys + joyX;
      const mag = Math.hypot(forward, right);
      if (mag > 1) {
        forward /= mag;
        right /= mag;
      }
      return {
        forward,
        right,
        run: down.has('ShiftLeft') || down.has('ShiftRight') || runHeld,
        analog,
        space: down.has('Space'),
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
