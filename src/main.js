import './style.css';
import '@fontsource/oswald/latin-700.css';
import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createAudio } from './audio.js';
import { createCameraRig } from './camera.js';
import {
  CYCLE_SECONDS,
  COMMISSARIAT,
  SPAWN,
  SPECS,
  START_MONEY,
  detectQuality,
  hourFromCycle,
} from './config.js';
import { createCity } from './city.js';
import { createGps } from './gps.js';
import { createInput } from './input.js';
import { createLighting } from './lighting.js';
import { beginCombat, resolveCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createPolice } from './police.js';
import { setupPwa } from './pwa.js';
import { createStory } from './story.js';
import { createVoices } from './voices.js';
import faceUrl from './assets/ibrahim-face.jpg';
import humanUrl from './assets/human.glb?url';
import { createCrowd, createRiggedCharacter, loadHumanGltf } from './humanoid.js';
import { updatePeds, updatePlayer } from './people.js';
import { createUi } from './ui.js';
import { damp, formatFCFA, resolveCircle } from './utils.js';
import { createTraffic, horn, updateVehicles } from './vehicles.js';

const RADIO = [
  'Radio Cotonou — le soleil se couche sur la Marina.',
  'Le trafic est dense vers Dantokpa. Un zem passe mieux.',
  'Ce soir à Fidjrossè, la mer est calme.',
  'Rappel : à Cotonou, on roule à droite.',
  'Le port est ouvert, les camions aussi.',
  'Haie Vive, la voie est libre.',
  'Un client VIP paie mieux. Conduis proprement.',
];

const quality = detectQuality();
const savedTier = localStorage.getItem('cotonou-tier');
quality.tier = savedTier === 'haute' || savedTier === 'moyenne' || savedTier === 'basse'
  ? savedTier
  : (quality.mobile ? 'moyenne' : 'haute');
quality.shadows = quality.tier === 'haute';
quality.pixelRatio = Math.min(window.devicePixelRatio || 1, pixelCap());
const refs = {};
refs.grade = localStorage.getItem('cotonou-grade') === 'sunset' ? 'sunset' : 'day';

function pixelCap() {
  if (quality.tier === 'basse') return 1;
  if (quality.tier === 'haute') return quality.mobile ? 1.35 : 1.5;
  return quality.mobile ? 1.15 : 1.25;
}
const scene = new Scene();
const camera = new PerspectiveCamera(68, 1, 0.18, 1200);
const renderer = new WebGLRenderer({
  antialias: quality.antialias,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
const pmrem = new PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = quality.tier === 'basse' ? null : envTex;
pmrem.dispose();
let composer = null;

function present() {
  if (quality.tier !== 'haute') {
    renderer.render(scene, camera);
    return;
  }
  if (!composer) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 0.16, 0.38, 0.88));
    composer.addPass(new OutputPass());
  }
  composer.render();
}
renderer.setPixelRatio(quality.pixelRatio);
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.domElement.style.touchAction = 'none';
document.getElementById('app').appendChild(renderer.domElement);

const lighting = createLighting(scene, refs, quality);

function loadBrightness() {
  const saved = Number(localStorage.getItem('cotonou-brightness'));
  return Number.isFinite(saved) && saved >= 0.65 && saved <= 1.8 ? saved : 1.25;
}

function applyBrightness(value) {
  const next = Math.min(1.8, Math.max(0.65, Number(value) || 1.25));
  renderer.toneMappingExposure = next;
  refs.brightness = next;
  localStorage.setItem('cotonou-brightness', String(next));
  return next;
}

applyBrightness(loadBrightness());
const city = createCity(scene, refs, quality);
const traffic = createTraffic(scene, city.graph, quality, Math.random);
async function startGame() {
const humanGltf = await loadHumanGltf(humanUrl);
const ibrahim = createRiggedCharacter(humanGltf, {
  player: true,
  faceUrl,
  shadows: quality.shadows,
});
scene.add(ibrahim);
const player = {
  mesh: ibrahim,
  pos: { x: SPAWN.x, y: 0, z: SPAWN.z },
  yaw: SPAWN.yaw,
  vy: 0,
  grounded: true,
  phase: 0,
  vehicle: null,
  moving: false,
  speed: 0,
  hp: 100,
  hpMax: 100,
  attackT: 0,
  dodgeT: 0,
  invuln: 0,
  punches: 0,
  dodges: 0,
};
ibrahim.position.set(player.pos.x, 0, player.pos.z);
ibrahim.rotation.y = player.yaw;

const crowd = createCrowd(scene, city.paths, quality, Math.random, humanGltf);
const peds = crowd.peds;
const DENSITIES = [
  { value: 1, label: 'Foule dense' },
  { value: 0.7, label: 'Foule moyenne' },
  { value: 0.45, label: 'Foule légère' },
];
let densityIndex = quality.mobile ? 1 : 0;
peds.density = DENSITIES[densityIndex].value;
const densityButton = document.getElementById('btn-density');
if (densityButton) densityButton.textContent = DENSITIES[densityIndex].label;
const missions = createMissions(scene);
const story = createStory(missions);
const gps = createGps(scene);
const policeForce = createPolice(scene);
const voices = createVoices();
const input = createInput();
input.setActions({
  play() {
    if (started) return;
    started = true;
    document.getElementById('start').classList.add('hidden');
    document.getElementById('play').blur();
    audio.resume();
    rig.state.yaw = player.yaw;
    rig.snap();
    if (!story.done()) story.openBrief();
    note('play');
  },
  resume() {
    paused = false;
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('resume').blur();
    note('resume');
  },
  outfit() {
    waxOutfit = !waxOutfit;
    ibrahim.userData.setOutfit(waxOutfit);
    const button = document.getElementById('btn-outfit');
    if (button) button.textContent = waxOutfit ? 'Tenue wax' : 'Tenue ville';
    note('outfit');
  },
  density() {
    densityIndex = (densityIndex + 1) % DENSITIES.length;
    peds.density = DENSITIES[densityIndex].value;
    const button = document.getElementById('btn-density');
    if (button) button.textContent = DENSITIES[densityIndex].label;
    note('density');
  },
  steer() {
    game.steerMode = game.steerMode === 'buttons' ? 'stick' : 'buttons';
    localStorage.setItem('cotonou-steer', game.steerMode);
    const button = document.getElementById('btn-steer-mode');
    if (button) button.textContent = game.steerMode === 'buttons' ? 'Direction : boutons' : 'Direction : joystick';
    note('steer');
  },
});
const audio = createAudio();
const ui = createUi();
const rig = createCameraRig(camera);
rig.state.yaw = SPAWN.yaw;

const focus = new Vector3();
const game = {
  money: story.save?.money ?? START_MONEY,
  wanted: 0,
  player,
  missions,
  vehicles: traffic.list,
  hour: hourFromCycle(0.2),
  nearVehicle: null,
  toast: '',
  toastUntil: 0,
  radio: RADIO[0],
  search: policeForce.search,
  route: gps.route,
  escaping: false,
  steerMode: localStorage.getItem('cotonou-steer') === 'buttons' ? 'buttons' : 'stick',
};
{
  const steerButton = document.getElementById('btn-steer-mode');
  if (steerButton) steerButton.textContent = game.steerMode === 'buttons' ? 'Direction : boutons' : 'Direction : joystick';
}

function applyTier(id) {
  if (id === 'haute' || id === 'moyenne' || id === 'basse') quality.tier = id;
  quality.shadows = quality.tier === 'haute';
  renderer.shadowMap.enabled = quality.shadows;
  if (refs.sun) {
    refs.sun.castShadow = quality.shadows;
    const size = quality.tier === 'haute' ? 1024 : 512;
    if (refs.sun.shadow.mapSize.x !== size) {
      refs.sun.shadow.mapSize.set(size, size);
      if (refs.sun.shadow.map) {
        refs.sun.shadow.map.dispose();
        refs.sun.shadow.map = null;
      }
    }
    refs.sun.shadow.radius = quality.tier === 'haute' ? 2.5 : 1;
  }
  scene.environment = quality.tier === 'basse' ? null : envTex;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap()));
  if (quality.tier === 'basse') peds.density = 0.45;
  const button = document.getElementById('btn-tier');
  if (button) {
    button.textContent = quality.tier === 'haute' ? 'Qualité : haute' : quality.tier === 'basse' ? 'Qualité : basse' : 'Qualité : moyenne';
  }
  localStorage.setItem('cotonou-tier', quality.tier);
}

function applyGrade(next) {
  refs.grade = next === 'sunset' ? 'sunset' : 'day';
  const button = document.getElementById('btn-grade');
  if (button) button.textContent = refs.grade === 'sunset' ? 'Lumière : coucher de soleil' : 'Lumière : jour';
  localStorage.setItem('cotonou-grade', refs.grade);
}

applyTier(quality.tier);
applyGrade(refs.grade);
document.getElementById('btn-tier')?.addEventListener('click', () => {
  const order = ['haute', 'moyenne', 'basse'];
  applyTier(order[(order.indexOf(quality.tier) + 1) % order.length]);
});
document.getElementById('btn-grade')?.addEventListener('click', () => {
  applyGrade(refs.grade === 'sunset' ? 'day' : 'sunset');
});
const joySizeInput = document.getElementById('joy-size');
const savedJoy = Number(localStorage.getItem('cotonou-joy'));
const joySize = Number.isFinite(savedJoy) && savedJoy >= 80 ? savedJoy : 96;
if (joySizeInput) joySizeInput.value = String(joySize);
input.setJoySize(joySize);
joySizeInput?.addEventListener('input', (event) => input.setJoySize(event.target.value));

let cycle = 0.2;
const fps = { t: 0, n: 0, level: 1, hide: 140 };
let driveThrottle = 0;
let boostTank = 1;
let started = false;
let paused = false;
let busting = false;
let bustTimer = 0;
let bustFine = 0;
let wantedCool = 0;
let lastCrime = 0;
let bumpCool = 0;
let radioAt = 0;
let cinema = 0.6;
let waxOutfit = true;
let selfieUntil = 0;
let last = performance.now();

function resize() {
  const width = window.innerWidth;
  const height = Math.max(1, window.innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  composer?.setSize(width, height);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
}
resize();
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

if (story.save) missions.state.jobs = story.save.jobs;
document.getElementById('brief-go')?.addEventListener('click', () => {
  story.begin();
  note('brief');
});
document.getElementById('result-ok')?.addEventListener('click', () => {
  story.accept();
  note('result');
});
document.getElementById('result-retry')?.addEventListener('click', () => {
  story.retry();
  note('retry');
});
document.getElementById('brightness')?.addEventListener('input', (event) => {
  applyBrightness(event.target.value);
  note('brightness');
});
const brightnessInput = document.getElementById('brightness');
if (brightnessInput) brightnessInput.value = String(renderer.toneMappingExposure);
setupPwa(toast);

function toast(text) {
  game.toast = text;
  game.toastUntil = performance.now() + 3400;
}

story.setHooks({
  toast,
  say(id) { voices.say(id); },
  reward(pay) {
    game.money += pay;
    missions.state.jobs += 1;
    audio.blip('cash');
    story.persist(game.money, missions.state.jobs);
  },
  setWanted(level) {
    game.wanted = level;
    wantedCool = 0;
  },
  persist() {
    story.persist(game.money, missions.state.jobs);
  },
});

function addWanted(reason) {
  const now = performance.now();
  if (now - lastCrime < 1100) return;
  lastCrime = now;
  game.wanted = Math.min(5, game.wanted + 1);
  wantedCool = 0;
  if (missions.state.active) missions.state.active.dirty = true;
  ui.flash();
  toast(reason);
  audio.blip('bad');
  if (navigator.vibrate) navigator.vibrate(35);
}

function pushOutOfCars() {
  if (player.vehicle) return;
  for (const vehicle of traffic.list) {
    const reach = vehicle.type === 'zem' ? 1.2 : vehicle.type === 'suv' ? 2.5 : 2.2;
    const dx = player.pos.x - vehicle.pos.x;
    const dz = player.pos.z - vehicle.pos.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const min = 0.5 + reach;
    if (dist < min) {
      player.pos.x += (dx / dist) * (min - dist);
      player.pos.z += (dz / dist) * (min - dist);
    }
  }
  const resolved = resolveCircle(player.pos.x, player.pos.z, 0.38, city.collision);
  player.pos.x = resolved.x;
  player.pos.z = resolved.z;
  player.mesh.position.x = player.pos.x;
  player.mesh.position.z = player.pos.z;
}

function syncPolice() {
  const target = Math.min(3, game.wanted);
  const cops = traffic.list.filter((vehicle) => vehicle.police && !vehicle.dead);
  if (game.wanted === 0) {
    for (const cop of cops) cop.leaving = true;
    return;
  }
  if (cops.filter((cop) => !cop.leaving).length < target) traffic.spawnPolice(player);
}

function startBust() {
  busting = true;
  bustTimer = 0;
  bustFine = Math.min(game.money, Math.max(game.money > 0 ? 400 : 0, Math.round((game.money * 0.28) / 50) * 50));
  game.money -= bustFine;
  story.noteBust();
  game.wanted = 0;
  wantedCool = 0;
  for (let i = traffic.list.length - 1; i >= 0; i -= 1) {
    const vehicle = traffic.list[i];
    if (!vehicle.police) continue;
    scene.remove(vehicle.mesh);
    traffic.list.splice(i, 1);
  }
  const text = bustFine > 0
    ? `Arrêté. Amende de ${formatFCFA(bustFine)}. Direction le commissariat.`
    : 'Arrêté. Pas de quoi payer. Le commissariat te relâche.';
  document.getElementById('bust-text').textContent = text;
  document.getElementById('bust').classList.remove('hidden');
  audio.blip('bad');
}

function finishBust() {
  if (player.vehicle) traffic.exit(player, city.collision);
  player.pos.x = COMMISSARIAT.x;
  player.pos.y = 0;
  player.pos.z = COMMISSARIAT.z;
  player.yaw = COMMISSARIAT.yaw;
  player.vy = 0;
  player.mesh.position.set(COMMISSARIAT.x, 0, COMMISSARIAT.z);
  player.mesh.rotation.set(0, COMMISSARIAT.yaw, 0);
  rig.state.yaw = COMMISSARIAT.yaw;
  rig.snap();
  busting = false;
  document.getElementById('bust').classList.add('hidden');
  toast('Ibrahim sort du commissariat.');
  story.afterBust();
  story.persist(game.money, missions.state.jobs);
}

function animateWorld(dt, time) {
  for (const boat of city.boats) {
    const data = boat.userData;
    boat.position.y = data.baseY + Math.sin(time * data.sp + data.ph) * 0.12;
    boat.rotation.z = Math.sin(time * 0.6 + data.ph) * 0.04;
  }
  for (const flag of city.flags) {
    flag.rotation.y = Math.sin(time * 2.1 + flag.userData.ph) * 0.2;
  }
  for (const cloud of city.clouds) {
    cloud.position.x += dt * cloud.userData.spd;
    if (cloud.position.x > 340) cloud.position.x = -340;
  }
}

function cinematic(dt) {
  cinema += dt * 0.35;
  const sway = Math.sin(cinema) * 0.4;
  const face = SPAWN.yaw + sway;
  camera.position.set(
    SPAWN.x + Math.sin(face) * 2.2,
    1.58,
    SPAWN.z + Math.cos(face) * 2.2,
  );
  camera.lookAt(SPAWN.x, 1.48, SPAWN.z);
}

const actionLog = [];
function note(name) {
  actionLog.push(name);
  if (actionLog.length > 60) actionLog.shift();
}
window.__cotonou = {
  get x() { return player.pos.x; },
  get z() { return player.pos.z; },
  get vehicle() { return Boolean(player.vehicle); },
  get paused() { return paused; },
  get started() { return started; },
  get punches() { return player.punches || 0; },
  get dodges() { return player.dodges || 0; },
  get hp() { return player.hp; },
  get exposure() { return renderer.toneMappingExposure; },
  get actions() { return actionLog.slice(); },
  get runHeld() { return input.held().run; },
  get yaw() { return player.yaw; },
  get maxYawStep() { return player.maxYawStep || 0; },
  resetYawStep() { player.maxYawStep = 0; },
  knob() { return input.knob(); },
  nearest() {
    let best = null;
    let bestD = Infinity;
    for (const ped of peds) {
      if (ped.down) continue;
      const dist = Math.hypot(ped.pos.x - player.pos.x, ped.pos.z - player.pos.z);
      if (dist < bestD) {
        best = ped;
        bestD = dist;
      }
    }
    if (!best) return null;
    return { hp: best.hp, x: best.pos.x, z: best.pos.z, d: bestD };
  },
  focusNearest() {
    const near = this.nearest();
    if (!near) return null;
    let best = null;
    let bestD = Infinity;
    for (const ped of peds) {
      const dist = Math.hypot(ped.pos.x - near.x, ped.pos.z - near.z);
      if (dist < bestD) {
        best = ped;
        bestD = dist;
      }
    }
    best.behavior = 'idle';
    best.speed = 0;
    best.down = false;
    best.temper = 'calm';
    if (!Number.isFinite(best.hp)) best.hp = best.hpMax || 28;
    const fx = Math.sin(rig.state.yaw);
    const fz = Math.cos(rig.state.yaw);
    best.pos.x = player.pos.x + fx * 1.15;
    best.pos.z = player.pos.z + fz * 1.15;
    best.mesh.position.set(best.pos.x, 0, best.pos.z);
    best.mesh.visible = true;
    player.yaw = rig.state.yaw;
    player.mesh.rotation.y = player.yaw;
    player.focusPed = best;
    return best.hp;
  },
  focusHp() {
    return player.focusPed ? player.focusPed.hp : null;
  },
  focusState() {
    const ped = player.focusPed;
    if (!ped) return null;
    return {
      hp: ped.hp,
      dx: ped.pos.x - player.pos.x,
      dz: ped.pos.z - player.pos.z,
      yaw: player.yaw,
      down: ped.down,
      visible: ped.mesh.visible,
      punches: player.punches || 0,
    };
  },
  stand(x, z, yaw) {
    player.pos.x = x;
    player.pos.z = z;
    player.pos.y = 0;
    player.yaw = yaw;
    player.mesh.position.set(x, 0, z);
    player.mesh.rotation.y = yaw;
  },
  missionKind() { return story.current()?.kind || ''; },
  missionVehicle() { return story.current()?.vehicle || ''; },
  knockBoss() { return story.knockBoss(); },
  setStars(n) { game.wanted = n; },
  setSteer(mode) {
    game.steerMode = mode === 'buttons' ? 'buttons' : 'stick';
    localStorage.setItem('cotonou-steer', game.steerMode);
  },
  enterType(type) {
    let best = null;
    let bestD = Infinity;
    for (const vehicle of traffic.list) {
      if (vehicle.type !== type || vehicle.police || vehicle.controlled || vehicle.dead) continue;
      const d = Math.hypot(vehicle.pos.x - player.pos.x, vehicle.pos.z - player.pos.z);
      if (d < bestD) {
        best = vehicle;
        bestD = d;
      }
    }
    if (!best) return false;
    this.stand(best.pos.x + 1.6, best.pos.z, best.yaw || 0);
    traffic.enter(player, best);
    if (player.vehicle) player.vehicle.speed = 0;
    return Boolean(player.vehicle);
  },
  chevrons() { return gps.count || 0; },
  speedKmh() { return player.vehicle ? Math.abs(player.vehicle.speed) * 3.6 : 0; },
  gotoGoal() {
    const goal = missions.target();
    if (!goal) return false;
    if (player.vehicle) {
      player.vehicle.pos.x = goal.x;
      player.vehicle.pos.z = goal.z;
      player.vehicle.speed = 0;
      player.pos.x = goal.x;
      player.pos.z = goal.z;
      return true;
    }
    this.stand(goal.x, goal.z, 0);
    return true;
  },
};

function tuneQuality(level) {
  fps.level = level;
  const cap = level <= 0 ? 1 : level === 1 ? Math.min(1.25, pixelCap()) : pixelCap();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  if (quality.tier !== 'basse') peds.density = level <= 0 ? 0.45 : DENSITIES[densityIndex].value;
  fps.hide = level <= 0 ? 70 : level === 1 ? 120 : 170;
}

function frame(now) {
  const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
  last = now;
  const time = now / 1000;
  const sample = input.sample(dt);
  const edges = input.consume();
  const look = input.consumeLook();

  if (!started) {
    cycle = (cycle + dt / CYCLE_SECONDS) % 1;
    game.hour = hourFromCycle(cycle);
    focus.set(SPAWN.x, 0, SPAWN.z);
    lighting.update(dt, game.hour, focus, camera);
    animateWorld(dt, time);
    cinematic(dt);
    present();
    document.getElementById('loader').classList.add('hidden');
    requestAnimationFrame(frame);
    return;
  }

  if (edges.outfit) {
    waxOutfit = !waxOutfit;
    ibrahim.userData.setOutfit(waxOutfit);
    const button = document.getElementById('btn-outfit');
    if (button) button.textContent = waxOutfit ? 'Tenue wax' : 'Tenue ville';
  }
  if (edges.selfie) {
    selfieUntil = performance.now() + 4800;
    toast('Selfie.');
    note('selfie');
  }
  if (edges.pause && !busting) {
    paused = !paused;
    document.getElementById('pause').classList.toggle('hidden', !paused);
    note('pause');
  }
  if (paused || story.holding()) {
    present();
    requestAnimationFrame(frame);
    return;
  }
  if (busting) {
    bustTimer += dt;
    animateWorld(dt, time);
    lighting.update(dt, game.hour, focus, camera);
    if (bustTimer > 2.7) finishBust();
    ui.update(game, camera);
    present();
    requestAnimationFrame(frame);
    return;
  }

  fps.t += dt;
  fps.n += 1;
  if (fps.t >= 1.4) {
    const rate = fps.n / fps.t;
    fps.t = 0;
    fps.n = 0;
    if (rate < 50 && fps.level > 0) tuneQuality(fps.level - 1);
    else if (rate > 58 && fps.level < 2) tuneQuality(fps.level + 1);
  }
  cycle = (cycle + dt / CYCLE_SECONDS) % 1;
  game.hour = hourFromCycle(cycle);
  rig.addLook(look.x, look.y);

  if (edges.jump && !player.vehicle) note('jump');
  if (edges.cam || (edges.punch && player.vehicle)) {
    rig.cycleCam();
    note('camera');
  }
  if (edges.punch && !player.vehicle) note('punch');
  if (edges.dodge) note('dodge');
  if (edges.enter) {
    selfieUntil = 0;
    if (player.vehicle) {
      traffic.exit(player, city.collision);
      note('exit');
    } else {
      const near = traffic.nearestEnterable(player.pos);
      if (near) {
        traffic.enter(player, near);
        policeForce.slip(3.5);
        note('enter');
      }
    }
  }
  if (edges.horn) {
    audio.horn();
    if (player.vehicle) horn(player.vehicle);
    note('horn');
  }

  beginCombat(player, {
    ...sample,
    punch: edges.punch && !player.vehicle,
    dodge: edges.dodge && !player.vehicle,
  }, rig.state.yaw, dt);
  updatePlayer(player, dt, {
    ...sample,
    jump: edges.jump && !player.vehicle,
  }, city.collision, rig.state.yaw);
  pushOutOfCars();

  const driving = Boolean(player.vehicle);
  const gas = sample.gas || sample.keyForward > 0;
  const brake = sample.brake || sample.keyForward < 0;
  const aim = gas && !brake ? 1 : brake && !gas ? -1 : 0;
  driveThrottle = damp(driveThrottle, driving ? aim : 0, aim === 0 ? 6 : 3.4, dt);
  if (driving && (sample.nitro || sample.run) && boostTank > 0.05 && driveThrottle > 0.15) {
    boostTank = Math.max(0, boostTank - dt * 0.4);
  } else {
    boostTank = Math.min(1, boostTank + dt * 0.16);
  }
  let steer = sample.keyRight;
  if (game.steerMode === 'buttons') {
    steer += (sample.steerRight ? 1 : 0) - (sample.steerLeft ? 1 : 0);
  } else {
    steer += sample.joyX;
  }
  steer = Math.max(-1, Math.min(1, steer));
  const driveInput = {
    forward: driving ? driveThrottle : sample.forward,
    right: driving ? steer : sample.right,
    handbrake: driving && (sample.hand || sample.space),
    nitro: driving && (sample.nitro || sample.run) && boostTank > 0.05 && driveThrottle > 0.15,
    cameraYaw: rig.state.yaw,
  };
  updateVehicles(traffic, dt, driveInput, player, city.collision, refs.nightHead || 0, {
    onCrash(other, speed) {
      if (other?.police) addWanted('Tu as percuté la police.');
      else if (speed > 9) addWanted(other ? 'Accident. Des témoins ont appelé la police.' : 'Tu as embouti quelque chose.');
    },
  }, { x: camera.position.x, z: camera.position.z, hide: fps.hide });
  if (player.vehicle) {
    player.pos.x = player.vehicle.pos.x;
    player.pos.z = player.vehicle.pos.z;
    player.pos.y = 0;
    player.yaw = player.vehicle.yaw;
  }

  updatePeds(peds, dt, player, city.paths, () => addWanted('Tu as renversé un piéton.'), camera, quality);
  crowd.updateLod(camera, peds.frame || 0);
  game.foe = resolveCombat(dt, player, peds, {
    say(id) { voices.say(id); },
    onAttack() { addWanted('Tu as frappé quelqu\'un. La police est prévenue.'); },
    onHospital() {
      game.money = Math.max(0, game.money - 500);
      story.persist(game.money, missions.state.jobs);
      toast('L\'hôpital de Cotonou te remet debout.');
      rig.state.yaw = player.yaw;
      rig.snap();
    },
  });
  voices.tick(dt, player, peds);
  if (!story.done()) story.update(dt, player, peds);
  gps.update(player, missions.target(), time);
  game.route = gps.route;

  bumpCool = Math.max(0, bumpCool - dt);
  if (!player.vehicle) {
    for (const vehicle of traffic.list) {
      if (!vehicle.ai || Math.abs(vehicle.speed) < 4) continue;
      const dist = Math.hypot(vehicle.pos.x - player.pos.x, vehicle.pos.z - player.pos.z);
      if (dist < vehicle.radius + 0.45) {
        player.pos.x += Math.sin(vehicle.yaw) * 0.7;
        player.pos.z += Math.cos(vehicle.yaw) * 0.7;
        player.mesh.position.x = player.pos.x;
        player.mesh.position.z = player.pos.z;
        if (bumpCool <= 0) {
          toast('Attention sur la chaussée !');
          bumpCool = 1.6;
        }
      }
    }
  }

  missions.update(dt, player, {
    onNew(mission) {
      const label = mission.kind === 'livraison' ? 'Livraison' : mission.kind === 'vip' ? 'Client VIP' : 'Nouvelle course';
      toast(`${label} : ${mission.a.name} → ${mission.b.name}.`);
      audio.blip('pick');
    },
    onPickup(mission) {
      toast(mission.kind === 'livraison'
        ? `Colis chargé. Direction ${mission.b.name}.`
        : `Client à bord. Direction ${mission.b.name}.`);
      audio.blip('pick');
    },
    onComplete(mission, tip) {
      game.money += mission.pay + tip;
      const paid = formatFCFA(mission.pay + tip);
      toast(tip > 0 ? `Payé ${paid}, pourboire inclus.` : `Payé ${paid}.`);
      audio.blip('cash');
      if (navigator.vibrate) navigator.vibrate(20);
    },
  });

  const policeEvent = policeForce.update(dt, game, traffic);
  if (policeEvent === 'clear') toast('Tu sors de la zone. La police te perd de vue.');
  if (policeEvent === 'caught') bustTimer = 2;
  syncPolice();

  let bustClose = false;
  for (const vehicle of traffic.list) {
    if (!vehicle.police || vehicle.leaving || vehicle.dead) continue;
    const dist = Math.hypot(vehicle.pos.x - player.pos.x, vehicle.pos.z - player.pos.z);
    if (dist < 3.3) bustClose = true;
  }
  if (bustClose) bustTimer += dt;
  else bustTimer = Math.max(0, bustTimer - dt * 0.35);
  if (game.wanted > 0 && bustTimer > 1.05) startBust();

  focus.set(player.pos.x, 0, player.pos.z);
  lighting.update(dt, game.hour, focus, camera);
  animateWorld(dt, time);

  const face = player.vehicle ? player.vehicle.yaw : player.yaw;
  const moving = player.vehicle ? Math.abs(player.vehicle.speed) > 0.8 : player.moving;
  const dist = player.vehicle ? SPECS[player.vehicle.type].cam : 6.5;
  rig.update(dt, focus, face, moving, dist, city.collision, performance.now() < selfieUntil && !player.vehicle, player.vehicle ? 4.2 : 2.4);
  const speedNow = player.vehicle ? Math.abs(player.vehicle.speed) : 0;
  const fov = 68 + Math.min(7, speedNow * 0.22);
  if (Math.abs(camera.fov - fov) > 0.15) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();
  }

  game.nearVehicle = player.vehicle ? null : traffic.nearestEnterable(player.pos);
  if (player.vehicle && time > radioAt) {
    game.radio = RADIO[Math.floor(Math.random() * RADIO.length)];
    radioAt = time + 7;
  }
  audio.update({
    driving: Boolean(player.vehicle),
    speed: speedNow,
    maxSpeed: player.vehicle ? SPECS[player.vehicle.type].max : 1,
    nearOcean: player.pos.z < 70,
    wanted: game.wanted,
    time,
  });
  ui.update(game, camera);
  present();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
}

startGame().catch((error) => {
  console.error(error);
  const loader = document.getElementById('loader');
  if (loader) loader.textContent = 'Le personnage n’a pas pu être chargé.';
});
