import { cameraPlanarBasis } from './camera-basis.js';
import { poseHuman } from './people.js';

const HOSPITAL = { x: -45, z: 88 };

export function beginCombat(player, input, cameraYaw, dt) {
  player.hp = player.hp ?? 100;
  player.hpMax = 100;
  // undefined <= 0 vaut false : sans cette init, le premier coup ne part jamais.
  player.attackT = Number.isFinite(player.attackT) ? player.attackT : 0;
  player.dodgeT = Number.isFinite(player.dodgeT) ? player.dodgeT : 0;
  player.invuln = Number.isFinite(player.invuln) ? player.invuln : 0;
  if (player.invuln > 0) player.invuln -= dt;
  if (player.dodgeT > 0) player.dodgeT -= dt;
  if (player.attackT > 0) player.attackT -= dt;
  if (player.vehicle) return;
  if (input.dodge && player.dodgeT <= 0) {
    player.attackT = 0;
    player.dodgeT = 0.34;
    player.invuln = 0.42;
    const basis = cameraPlanarBasis(cameraYaw);
    const side = input.right < -0.2 ? -1 : 1;
    player.pos.x += basis.rightX * 1.7 * side;
    player.pos.z += basis.rightZ * 1.7 * side;
    player.dodges = (player.dodges || 0) + 1;
    if (navigator.vibrate) navigator.vibrate(10);
  }
  if (input.punch && player.attackT <= 0 && player.dodgeT <= 0) {
    player.yaw = cameraYaw;
    player.idle = 0;
    player.combo = ((player.combo || 0) + 1) % 2;
    player.attackKind = player.combo === 1 ? 'punch' : 'kick';
    player.attackT = player.attackKind === 'punch' ? 0.48 : 0.4;
    player.attackHit = true;
    player.punches = (player.punches || 0) + 1;
    if (navigator.vibrate) navigator.vibrate(15);
  }
}

export function resolveCombat(dt, player, peds, hooks) {
  if (player.attackHit && !player.vehicle) {
    player.attackHit = false;
    const reach = 1.7;
    const faceX = Math.sin(player.yaw);
    const faceZ = Math.cos(player.yaw);
    let hit = null;
    let best = reach;
    for (const ped of peds) {
      if (ped.down) continue;
      const dx = ped.pos.x - player.pos.x;
      const dz = ped.pos.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      if (!ped.mesh.visible && dist > 2.2) continue;
      if (dist > best) continue;
      const dot = (dx * faceX + dz * faceZ) / (dist || 1);
      if (dot < 0.2) continue;
      best = dist;
      hit = ped;
    }
    if (hit) {
      hit.hp -= player.attackKind === 'kick' ? 16 : 12;
      hit.stun = 0.35;
      hit.cool = Math.max(hit.cool || 0, 0.2);
      if (hit.temper === 'calm') hit.temper = 'flee';
      hooks.say('ahnon');
      hooks.onAttack();
      if (hit.hp <= 0) {
        hit.down = true;
        hit.timer = 0;
        hit.mesh.userData.tickAnim?.('death', 0.016);
      }
    }
  }

  let foe = null;
  for (const ped of peds) {
    if (!ped.hpMax) continue;
    if (ped.down) continue;
    ped.cool = Math.max(0, (ped.cool || 0) - dt);
    ped.stun = Math.max(0, (ped.stun || 0) - dt);
    const dx = player.pos.x - ped.pos.x;
    const dz = player.pos.z - ped.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const aggro = ped.boss ? 36 : ped.temper === 'fight' ? 14 : 0;
    if (ped.temper === 'flee' && dist < 7 && !player.vehicle) {
      ped.pos.x -= (dx / dist) * 2.2 * dt;
      ped.pos.z -= (dz / dist) * 2.2 * dt;
      ped.yaw = Math.atan2(-dx, -dz);
      ped.mesh.position.set(ped.pos.x, 0, ped.pos.z);
      ped.mesh.rotation.y = ped.yaw;
      if (ped.mesh.visible) poseHuman(ped.mesh, ped.phase || 0, 'run', dt);
      continue;
    }
    if (aggro && dist < aggro && ped.stun <= 0) {
      ped.mesh.visible = true;
      if (dist > 1.15) {
        const step = (ped.boss ? 2.1 : 1.7) * dt;
        ped.pos.x += (dx / dist) * step;
        ped.pos.z += (dz / dist) * step;
        ped.yaw = Math.atan2(dx, dz);
        ped.mesh.position.set(ped.pos.x, 0, ped.pos.z);
        ped.mesh.rotation.y = ped.yaw;
        poseHuman(ped.mesh, ped.phase || 0, 'walk', dt);
      } else if (!player.vehicle && player.invuln <= 0 && ped.cool <= 0) {
        ped.cool = ped.boss ? 0.7 : 0.95;
        player.hp -= ped.boss ? 10 : 7;
        poseHuman(ped.mesh, ped.phase || 0, 'punch', dt);
        hooks.say(ped.boss ? 'patron' : 'ahnon');
        if (navigator.vibrate) navigator.vibrate(12);
      }
      if (dist < 22) foe = { name: ped.name || (ped.boss ? 'Adversaire' : 'Passant'), hp: ped.hp, max: ped.hpMax };
    }
  }

  if (player.hp <= 0) {
    player.hp = player.hpMax;
    player.invuln = 1.2;
    player.pos.x = HOSPITAL.x;
    player.pos.z = HOSPITAL.z;
    player.pos.y = 0;
    player.mesh.position.set(HOSPITAL.x, 0, HOSPITAL.z);
    hooks.onHospital();
    hooks.say('hopital');
  }
  return foe;
}
