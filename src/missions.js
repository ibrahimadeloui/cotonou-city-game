import {
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  RingGeometry,
} from 'three';
import { PLACES } from './config.js';
import { mulberry32 } from './utils.js';

export function createMissions(scene) {
  const rand = mulberry32(0xbe110);
  const diamondMat = new MeshLambertMaterial({ color: 0xffd45a, emissive: 0xffd45a, emissiveIntensity: 0.95 });
  const beamMat = new MeshBasicMaterial({
    color: 0xffd45a,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: DoubleSide,
  });
  const ringMat = new MeshBasicMaterial({
    color: 0xffd45a,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: DoubleSide,
  });
  const diamond = new Mesh(new OctahedronGeometry(0.55), diamondMat);
  diamond.position.y = 3.2;
  const beam = new Mesh(new CylinderGeometry(0.12, 0.42, 3.2, 6, 1, true), beamMat);
  beam.position.y = 1.6;
  const ring = new Mesh(new RingGeometry(0.75, 1.05, 20), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  const group = new Group();
  group.add(diamond, beam, ring);
  group.visible = false;
  scene.add(group);

  const state = { active: null, cooldown: 3.2, jobs: 0 };

  function rollMission() {
    let from = PLACES[Math.floor(rand() * PLACES.length)];
    let to = PLACES[Math.floor(rand() * PLACES.length)];
    let guard = 0;
    while (to.id === from.id && guard < 8) {
      to = PLACES[Math.floor(rand() * PLACES.length)];
      guard += 1;
    }
    const roll = rand();
    const kind = roll < 0.55 ? 'taxi' : roll < 0.85 ? 'livraison' : 'vip';
    const dist = Math.hypot(from.x - to.x, from.z - to.z);
    const pay = Math.round((1400 + dist * 16) / 50) * 50;
    state.active = { kind, a: from, b: to, pay, phase: 'pickup', dirty: false };
    group.visible = true;
  }

  return {
    state,
    target() {
      if (!state.active) return null;
      return state.active.phase === 'pickup' ? state.active.a : state.active.b;
    },
    lock(mission) {
      state.locked = true;
      state.active = mission;
    },
    unlock() {
      state.locked = false;
      state.active = null;
      state.cooldown = 3;
      group.visible = false;
    },
    update(dt, player, hooks) {
      const mission = state.active;
      if (state.locked && mission) {
        const point = mission.a;
        group.visible = true;
        group.position.set(point.x, 0, point.z);
        diamond.position.y = 3.15 + Math.sin(performance.now() / 280) * 0.28;
        diamond.rotation.y += dt * 1.4;
        return;
      }
      if (!mission) {
        state.cooldown -= dt;
        group.visible = false;
        if (state.cooldown <= 0) {
          rollMission();
          hooks.onNew(state.active);
        }
        return;
      }
      const point = mission.phase === 'pickup' ? mission.a : mission.b;
      group.position.set(point.x, 0, point.z);
      diamond.position.y = 3.15 + Math.sin(performance.now() / 280) * 0.28;
      diamond.rotation.y += dt * 1.4;
      const color = mission.phase === 'pickup' ? 0xffd45a : 0x3dd68c;
      diamondMat.color.setHex(color);
      diamondMat.emissive.setHex(color);
      beamMat.color.setHex(color);
      ringMat.color.setHex(color);
      const speed = player.vehicle ? Math.abs(player.vehicle.speed) : player.speed;
      const dist = Math.hypot(player.pos.x - point.x, player.pos.z - point.z);
      if (dist < 4.4 && speed < 7.5) {
        if (mission.phase === 'pickup') {
          mission.phase = 'drop';
          hooks.onPickup(mission);
        } else {
          const tip = mission.dirty ? 0 : Math.round((mission.pay * 0.15) / 50) * 50;
          const done = mission;
          state.jobs += 1;
          state.active = null;
          state.cooldown = 4.2;
          group.visible = false;
          hooks.onComplete(done, tip);
        }
      }
    },
  };
}

export function missionTitle(mission) {
  if (!mission) return 'Disponible';
  if (mission.storyTitle) return mission.storyTitle;
  if (mission.kind === 'livraison') return 'Livraison';
  if (mission.kind === 'vip') return 'Client VIP';
  return 'Course';
}

export function missionBody(mission) {
  if (!mission) return 'Une course va s\'afficher ici.';
  if (mission.storyBody) return mission.storyBody;
  if (mission.phase === 'pickup') {
    if (mission.kind === 'livraison') return `Récupère le colis — ${mission.a.name}`;
    if (mission.kind === 'vip') return `Client VIP — ${mission.a.name}`;
    return `Client en attente — ${mission.a.name}`;
  }
  if (mission.kind === 'livraison') return `Livre le colis — ${mission.b.name}`;
  return `Dépose le client — ${mission.b.name}`;
}
