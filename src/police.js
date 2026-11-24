import {
  BoxGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
} from 'three';
import { ROAD_XS, ROAD_ZS } from './config.js';

const OFFICERS = 3;

function roadGap(x, z) {
  let best = Infinity;
  for (let i = 0; i < ROAD_XS.length; i += 1) best = Math.min(best, Math.abs(x - ROAD_XS[i]));
  for (let i = 0; i < ROAD_ZS.length; i += 1) best = Math.min(best, Math.abs(z - ROAD_ZS[i]));
  return best;
}

function makeOfficer() {
  const group = new Group();
  const cloth = new MeshLambertMaterial({ color: 0x1d4e89 });
  const skin = new MeshLambertMaterial({ color: 0x8d5524 });
  const body = new Mesh(new BoxGeometry(0.46, 0.7, 0.28), cloth);
  body.position.y = 0.95;
  const head = new Mesh(new BoxGeometry(0.28, 0.28, 0.28), skin);
  head.position.y = 1.5;
  group.add(body, head);
  group.visible = false;
  return group;
}

export function createPolice(scene) {
  const officers = [];
  for (let i = 0; i < OFFICERS; i += 1) {
    const mesh = makeOfficer();
    scene.add(mesh);
    officers.push({ mesh, x: 0, z: 0, active: false, catchT: 0 });
  }
  const search = { x: 0, z: 0, r: 48, show: false };
  let hidden = 0;
  let slip = 0;
  let seen = false;

  return {
    search,
    slip(seconds) { slip = Math.max(slip, seconds); },
    update(dt, game, traffic) {
      slip = Math.max(0, slip - dt);
      const stars = game.wanted;
      const player = game.player;
      const px = player.vehicle ? player.vehicle.pos.x : player.pos.x;
      const pz = player.vehicle ? player.vehicle.pos.z : player.pos.z;
      if (stars <= 0) {
        search.show = false;
        hidden = 0;
        game.escaping = false;
        for (const officer of officers) officer.mesh.visible = false;
        return false;
      }
      const alley = roadGap(px, pz) > 11;
      const changed = slip > 0;
      let closeCop = false;
      for (const vehicle of traffic.list) {
        if (!vehicle.police || vehicle.dead || vehicle.leaving) continue;
        const d = Math.hypot(vehicle.pos.x - px, vehicle.pos.z - pz);
        if (d < 24) closeCop = true;
      }
      const spotted = !alley && !changed && closeCop;
      if (spotted || search.x === 0) {
        search.x = px;
        search.z = pz;
        hidden = 0;
        seen = true;
        game.escaping = false;
      }
      search.r = 34 + stars * 12;
      search.show = true;
      const outside = Math.hypot(px - search.x, pz - search.z) > search.r;
      if ((outside || alley || changed) && !closeCop) hidden += dt;
      else hidden = 0;
      game.escaping = hidden > 2.2 && seen;
      if (hidden > 5.2) {
        game.wanted = Math.max(0, game.wanted - 1);
        hidden = 0;
        if (game.wanted === 0) {
          search.show = false;
          game.escaping = false;
          return 'clear';
        }
      }
      const need = stars >= 4 ? 2 : stars >= 2 ? 1 : 0;
      for (let i = 0; i < officers.length; i += 1) {
        const officer = officers[i];
        officer.mesh.visible = i < need;
        officer.active = i < need;
        if (!officer.active) continue;
        if (officer.x === 0 && officer.z === 0) {
          officer.x = px + 18 + i * 6;
          officer.z = pz - 10;
        }
        const dx = px - officer.x;
        const dz = pz - officer.z;
        const dist = Math.hypot(dx, dz) || 1;
        const step = Math.min(6.2, dist) * dt;
        officer.x += (dx / dist) * step;
        officer.z += (dz / dist) * step;
        officer.mesh.position.set(officer.x, 0, officer.z);
        officer.mesh.rotation.y = Math.atan2(dx, dz);
        if (dist < 1.55 && !player.vehicle) officer.catchT += dt;
        else officer.catchT = Math.max(0, officer.catchT - dt);
        if (officer.catchT > 0.65) return 'caught';
      }
      return false;
    },
  };
}
