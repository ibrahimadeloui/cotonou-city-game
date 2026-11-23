import { BoxGeometry, Group, Mesh, MeshLambertMaterial } from 'three';
import { RUN_SPEED, WALK_SPEED } from './config.js';
import { clamp, clampWorld, dampAngle, resolveCircle } from './utils.js';

const materials = new Map();

function mat(color) {
  const key = typeof color === 'number' ? color.toString(16) : String(color);
  if (!materials.has(key)) materials.set(key, new MeshLambertMaterial({ color }));
  return materials.get(key);
}

export function createHuman({ skin, shirt, pants, hair, dress = false, shadows = false, scale = 1 }) {
  const g = new Group();
  const skinM = mat(skin);
  const shirtM = mat(shirt);
  const pantsM = mat(dress ? shirt : pants);
  const hairM = mat(hair);
  const shoeM = mat(0x1b1b1b);

  const torso = new Mesh(new BoxGeometry(0.42, 0.5, 0.22), shirtM);
  torso.position.y = 0.98;
  torso.castShadow = shadows;

  const hips = new Mesh(new BoxGeometry(0.4, 0.22, 0.22), pantsM);
  hips.position.y = 0.62;

  function leg(x) {
    const pivot = new Group();
    pivot.position.set(x, 0.5, 0);
    const limb = new Mesh(new BoxGeometry(0.15, 0.42, 0.16), pantsM);
    limb.position.y = -0.21;
    const shoe = new Mesh(new BoxGeometry(0.16, 0.08, 0.22), shoeM);
    shoe.position.set(0, -0.44, 0.03);
    pivot.add(limb, shoe);
    return pivot;
  }
  function arm(x) {
    const pivot = new Group();
    pivot.position.set(x, 1.16, 0);
    const limb = new Mesh(new BoxGeometry(0.12, 0.42, 0.12), skinM);
    limb.position.y = -0.2;
    pivot.add(limb);
    return pivot;
  }

  const legL = leg(-0.1);
  const legR = leg(0.1);
  const armL = arm(-0.3);
  const armR = arm(0.3);
  const head = new Mesh(new BoxGeometry(0.26, 0.28, 0.26), skinM);
  head.position.y = 1.4;
  head.castShadow = shadows;
  const hairMesh = new Mesh(new BoxGeometry(0.28, 0.1, 0.28), hairM);
  hairMesh.position.y = 1.56;

  g.add(torso, hips, legL, legR, armL, armR, head, hairMesh);
  if (dress) {
    const skirt = new Mesh(new BoxGeometry(0.52, 0.32, 0.34), shirtM);
    skirt.position.y = 0.58;
    g.add(skirt);
  }
  g.userData.limbs = { legL, legR, armL, armR };
  g.scale.setScalar(scale);
  return g;
}

export function poseHuman(group, phase, mode) {
  const { legL, legR, armL, armR } = group.userData.limbs;
  if (mode === 'sit') {
    legL.rotation.x = -1.35;
    legR.rotation.x = -1.35;
    armL.rotation.x = -0.5;
    armR.rotation.x = -0.35;
    armL.rotation.z = 0.2;
    armR.rotation.z = -0.25;
    return;
  }
  const amp = mode === 'run' ? 0.95 : mode === 'walk' ? 0.65 : 0;
  const s = Math.sin(phase);
  legL.rotation.x = s * amp;
  legR.rotation.x = -s * amp;
  armL.rotation.x = -s * amp * 0.7;
  armR.rotation.x = s * amp * 0.7;
  armL.rotation.z = 0.05;
  armR.rotation.z = -0.05;
}

const SKINS = [0x8d5524, 0x6b3a22, 0x4a2918, 0xc68642, 0x7a4a30, 0x5c3317];
const TOPS = [0xe23d3d, 0x1f6feb, 0xf2c14e, 0xf4f4f4, 0x0e8f62, 0x6b3fa0, 0xff8c42, 0x123c8a, 0xf47bb5];
const PANTS = [0x222833, 0x3b2a1a, 0x1d3b2a, 0x4a3040, 0x1e3a5f];

export function createIbrahim(shadows) {
  const mesh = createHuman({
    skin: 0x7a4630,
    shirt: 0xf4f1ea,
    pants: 0x243044,
    hair: 0x140e0c,
    shadows,
    scale: 1.08,
  });
  const band = new Mesh(new BoxGeometry(0.13, 0.05, 0.14), mat(0x009e49));
  band.position.set(0, -0.08, 0);
  mesh.userData.limbs.armL.add(band);
  const gold = new Mesh(new BoxGeometry(0.13, 0.035, 0.14), mat(0xfcd116));
  gold.position.set(0, -0.13, 0);
  mesh.userData.limbs.armL.add(gold);
  return mesh;
}

export function updatePlayer(player, dt, input, collision, cameraYaw) {
  if (player.vehicle) {
    poseHuman(player.mesh, 0, 'sit');
    return;
  }

  const faceX = Math.sin(cameraYaw);
  const faceZ = Math.cos(cameraYaw);
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);
  let mx = faceX * input.forward + rightX * input.right;
  let mz = faceZ * input.forward + rightZ * input.right;
  const mag = Math.hypot(mx, mz);
  const run = input.run || (input.analog && mag > 0.9);
  if (mag > 0.08) {
    mx /= mag;
    mz /= mag;
    const speed = run ? RUN_SPEED : WALK_SPEED;
    const water = player.pos.z < 16 ? 0.55 : 1;
    player.yaw = dampAngle(player.yaw, Math.atan2(mx, mz), 10, dt);
    player.pos.x += mx * speed * water * dt;
    player.pos.z += mz * speed * water * dt;
    player.moving = true;
    player.speed = speed * water;
    player.phase += dt * speed * 2.1;
  } else {
    player.moving = false;
    player.speed = 0;
  }

  if (player.grounded && input.jump) player.vy = 5.4;
  player.vy -= 16 * dt;
  player.pos.y += player.vy * dt;
  if (player.pos.y <= 0) {
    player.pos.y = 0;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  const resolved = resolveCircle(player.pos.x, player.pos.z, 0.38, collision);
  player.pos.x = resolved.x;
  player.pos.z = resolved.z;
  const bounded = clampWorld(player.pos.x, player.pos.z, false);
  player.pos.x = bounded.x;
  player.pos.z = bounded.z;

  player.mesh.position.set(player.pos.x, player.pos.y, player.pos.z);
  player.mesh.rotation.set(0, player.yaw, 0);
  const mode = player.moving ? (run ? 'run' : 'walk') : 'idle';
  poseHuman(player.mesh, player.phase, mode);
}

export function createPedestrians(scene, paths, count, rand, shadows) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const dress = rand() < 0.42;
    const mesh = createHuman({
      skin: SKINS[Math.floor(rand() * SKINS.length)],
      shirt: TOPS[Math.floor(rand() * TOPS.length)],
      pants: PANTS[Math.floor(rand() * PANTS.length)],
      hair: rand() < 0.5 ? 0x140e0c : 0x2a2118,
      dress,
      shadows,
      scale: 0.92 + rand() * 0.16,
    });
    const path = paths[Math.floor(rand() * paths.length)];
    const ped = {
      mesh,
      path,
      t: rand(),
      dir: rand() < 0.5 ? 1 : -1,
      speed: 1.05 + rand() * 0.7,
      phase: rand() * 6,
      down: false,
      timer: 0,
      yaw: 0,
      pos: { x: 0, z: 0 },
    };
    placeOnPath(ped);
    scene.add(mesh);
    peds.push(ped);
  }
  return peds;
}

function placeOnPath(ped) {
  const { a, b } = ped.path;
  ped.pos.x = a.x + (b.x - a.x) * ped.t;
  ped.pos.z = a.z + (b.z - a.z) * ped.t;
}

export function updatePeds(peds, dt, player, paths, onHit) {
  const vehicle = player.vehicle;
  for (let i = 0; i < peds.length; i += 1) {
    const ped = peds[i];
    if (ped.down) {
      ped.timer += dt;
      ped.mesh.rotation.set(-Math.PI / 2, ped.yaw, 0);
      ped.mesh.position.set(ped.pos.x, 0.32, ped.pos.z);
      if (ped.timer > 5) {
        ped.down = false;
        ped.timer = 0;
        ped.path = paths[Math.floor(Math.random() * paths.length)];
        ped.t = Math.random();
        placeOnPath(ped);
      }
      continue;
    }
    const { a, b } = ped.path;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    ped.t += ped.dir * (ped.speed * dt) / len;
    if (ped.t > 1 || ped.t < 0) {
      ped.dir *= -1;
      ped.t = clamp(ped.t, 0, 1);
    }
    placeOnPath(ped);
    ped.yaw = Math.atan2((b.x - a.x) * ped.dir, (b.z - a.z) * ped.dir);
    ped.phase += dt * ped.speed * 2.4;
    ped.mesh.position.set(ped.pos.x, 0, ped.pos.z);
    ped.mesh.rotation.set(0, ped.yaw, 0);
    poseHuman(ped.mesh, ped.phase, 'walk');

    if (!vehicle) continue;
    const d = Math.hypot(vehicle.pos.x - ped.pos.x, vehicle.pos.z - ped.pos.z);
    if (d < vehicle.radius + 0.45 && Math.abs(vehicle.speed) > 6) {
      ped.down = true;
      ped.timer = 0;
      ped.pos.x += Math.sin(vehicle.yaw) * 1.4;
      ped.pos.z += Math.cos(vehicle.yaw) * 1.4;
      onHit();
    }
  }
}
