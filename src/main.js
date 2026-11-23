import './style.css';
import {
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createAudio } from './audio.js';
import { createCameraRig } from './camera.js';
import {
  CYCLE_SECONDS,
  SPAWN,
  SPECS,
  START_MONEY,
  detectQuality,
  hourFromCycle,
} from './config.js';
import { createCity } from './city.js';
import { createInput } from './input.js';
import { createLighting } from './lighting.js';
import { createMissions } from './missions.js';
import { createIbrahim, createPedestrians, updatePeds, updatePlayer } from './people.js';
import { createUi } from './ui.js';
import { formatFCFA, resolveCircle } from './utils.js';
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
const refs = {};
const scene = new Scene();
const camera = new PerspectiveCamera(68, 1, 0.18, 1200);
const renderer = new WebGLRenderer({
  antialias: quality.antialias,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.outputColorSpace = SRGBColorSpace;
renderer.setPixelRatio(quality.pixelRatio);
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const lighting = createLighting(scene, refs, quality);
const city = createCity(scene, refs, quality);
const traffic = createTraffic(scene, city.graph, quality, Math.random);
const ibrahim = createIbrahim(quality.shadows);
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
};
ibrahim.position.set(player.pos.x, 0, player.pos.z);
ibrahim.rotation.y = player.yaw;

const peds = createPedestrians(scene, city.paths, quality.peds, Math.random, quality.shadows);
const missions = createMissions(scene);
const input = createInput();
const audio = createAudio();
const ui = createUi();
const rig = createCameraRig(camera);
rig.state.yaw = SPAWN.yaw;

const focus = new Vector3();
const game = {
  money: START_MONEY,
  wanted: 0,
  player,
  missions,
  vehicles: traffic.list,
  hour: hourFromCycle(0.08),
  nearVehicle: null,
  toast: '',
  toastUntil: 0,
  radio: RADIO[0],
};

let cycle = 0.08;
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
let last = performance.now();

function resize() {
  const width = window.innerWidth;
  const height = Math.max(1, window.innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
}
resize();
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

function toast(text) {
  game.toast = text;
  game.toastUntil = performance.now() + 3400;
}

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
  const target = game.wanted >= 4 ? 2 : game.wanted > 0 ? 1 : 0;
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
  game.wanted = 0;
  wantedCool = 0;
  for (let i = traffic.list.length - 1; i >= 0; i -= 1) {
    const vehicle = traffic.list[i];
    if (!vehicle.police) continue;
    scene.remove(vehicle.mesh);
    traffic.list.splice(i, 1);
  }
  const text = bustFine > 0
    ? `Amende de ${formatFCFA(bustFine)}. La police te lâche sur la plage.`
    : 'Pas de quoi payer l\'amende. La police te lâche quand même.';
  document.getElementById('bust-text').textContent = text;
  document.getElementById('bust').classList.remove('hidden');
  audio.blip('bad');
}

function finishBust() {
  if (player.vehicle) traffic.exit(player, city.collision);
  player.pos.x = SPAWN.x;
  player.pos.y = 0;
  player.pos.z = SPAWN.z;
  player.yaw = SPAWN.yaw;
  player.vy = 0;
  player.mesh.position.set(SPAWN.x, 0, SPAWN.z);
  player.mesh.rotation.set(0, SPAWN.yaw, 0);
  rig.state.yaw = SPAWN.yaw;
  rig.snap();
  busting = false;
  document.getElementById('bust').classList.add('hidden');
  toast('Ibrahim est relâché à Fidjrossè.');
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
  cinema += dt * 0.12;
  const fx = SPAWN.x + 8;
  const fz = SPAWN.z + 2;
  camera.position.set(fx - Math.sin(cinema) * 16, 7.2, fz - Math.cos(cinema) * 12);
  camera.lookAt(fx + 12, 1.6, fz + 8);
}

document.getElementById('play').addEventListener('click', () => {
  started = true;
  document.getElementById('start').classList.add('hidden');
  document.getElementById('play').blur();
  audio.resume();
  rig.state.yaw = player.yaw;
  rig.snap();
});
document.getElementById('resume').addEventListener('click', () => {
  paused = false;
  document.getElementById('pause').classList.add('hidden');
});

function frame(now) {
  const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
  last = now;
  const time = now / 1000;
  const sample = input.sample();
  const edges = input.consume();
  const look = input.consumeLook();

  if (!started) {
    cycle = (cycle + dt / CYCLE_SECONDS) % 1;
    game.hour = hourFromCycle(cycle);
    focus.set(SPAWN.x, 0, SPAWN.z);
    lighting.update(dt, game.hour, focus, camera);
    animateWorld(dt, time);
    cinematic(dt);
    renderer.render(scene, camera);
    document.getElementById('loader').classList.add('hidden');
    requestAnimationFrame(frame);
    return;
  }

  if (edges.pause && !busting) {
    paused = !paused;
    document.getElementById('pause').classList.toggle('hidden', !paused);
  }
  if (paused) {
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return;
  }
  if (busting) {
    bustTimer += dt;
    animateWorld(dt, time);
    lighting.update(dt, game.hour, focus, camera);
    if (bustTimer > 2.7) finishBust();
    ui.update(game, camera);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return;
  }

  cycle = (cycle + dt / CYCLE_SECONDS) % 1;
  game.hour = hourFromCycle(cycle);
  rig.addLook(look.x, look.y);

  if (edges.enter) {
    if (player.vehicle) traffic.exit(player, city.collision);
    else {
      const near = traffic.nearestEnterable(player.pos);
      if (near) traffic.enter(player, near);
    }
  }
  if (edges.horn && player.vehicle) {
    horn(player.vehicle);
    audio.horn();
  }

  updatePlayer(player, dt, {
    ...sample,
    jump: edges.jump && !player.vehicle,
  }, city.collision, rig.state.yaw);
  pushOutOfCars();

  const driveInput = {
    forward: sample.forward,
    right: sample.right,
    handbrake: Boolean(player.vehicle) && (sample.space || sample.runHeld),
  };
  updateVehicles(traffic, dt, driveInput, player, city.collision, refs.nightHead || 0, {
    onCrash(other, speed) {
      if (other?.police) addWanted('Tu as percuté la police.');
      else if (speed > 9) addWanted(other ? 'Accident. Des témoins ont appelé la police.' : 'Tu as embouti quelque chose.');
    },
  });
  if (player.vehicle) {
    player.pos.x = player.vehicle.pos.x;
    player.pos.z = player.vehicle.pos.z;
    player.pos.y = 0;
    player.yaw = player.vehicle.yaw;
  }

  updatePeds(peds, dt, player, city.paths, () => addWanted('Tu as renversé un piéton.'));

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

  if (game.wanted > 0) {
    wantedCool += dt;
    if (wantedCool > 18) {
      game.wanted -= 1;
      wantedCool = 0;
      if (game.wanted === 0) toast('La police te perd de vue.');
    }
  }
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
  rig.update(dt, focus, face, moving, dist, city.collision);
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
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
