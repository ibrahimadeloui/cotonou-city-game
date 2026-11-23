import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
} from 'three';
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
  const body = group.userData.body;
  if (mode === 'sit') {
    legL.rotation.x = -1.35;
    legR.rotation.x = -1.35;
    armL.rotation.x = -0.5;
    armR.rotation.x = -0.35;
    armL.rotation.z = 0.2;
    armR.rotation.z = -0.25;
    if (body) {
      body.rotation.z = 0;
      body.position.y = 0;
    }
    return;
  }
  const amp = mode === 'run' ? 1 : mode === 'walk' ? 0.7 : 0;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  legL.rotation.x = s * amp;
  legR.rotation.x = -s * amp;
  armL.rotation.x = -s * amp * 0.85;
  armR.rotation.x = s * amp * 0.85;
  armL.rotation.z = 0.08 + c * amp * 0.05;
  armR.rotation.z = -0.08 - c * amp * 0.05;
  if (body) {
    body.rotation.z = c * amp * 0.05;
    body.position.y = Math.abs(s) * amp * 0.03;
  }
}

const SKINS = [0x8d5524, 0x6b3a22, 0x4a2918, 0xc68642, 0x7a4a30, 0x5c3317];
const TOPS = [0xe23d3d, 0x1f6feb, 0xf2c14e, 0xf4f4f4, 0x0e8f62, 0x6b3fa0, 0xff8c42, 0x123c8a, 0xf47bb5];
const PANTS = [0x222833, 0x3b2a1a, 0x1d3b2a, 0x4a3040, 0x1e3a5f];

function waxTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f0b429';
  ctx.fillRect(0, 0, 128, 128);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1a100c';
  ctx.fillStyle = '#b11f2a';
  const shapes = [
    [[4, 8], [48, 0], [62, 46], [28, 78], [0, 52]],
    [[70, 6], [128, 18], [120, 70], [78, 58]],
    [[0, 88], [36, 74], [54, 128], [0, 128]],
    [[64, 78], [112, 70], [128, 120], [72, 128]],
  ];
  for (const pts of shapes) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function createIbrahim(shadows, faceUrl) {
  const g = new Group();
  const skin = new MeshPhongMaterial({ color: 0x8a5536, shininess: 10, specular: 0x3a2014 });
  const hairM = new MeshLambertMaterial({ color: 0x16110e });
  const fadeM = new MeshLambertMaterial({ color: 0x3a2c24 });
  const pantsM = new MeshLambertMaterial({ color: 0x2c241c });
  const shoeM = new MeshLambertMaterial({ color: 0x141414 });
  const waxMat = new MeshLambertMaterial({ map: waxTexture() });
  const streetMat = new MeshLambertMaterial({ color: 0xf3f0e8 });

  const faceTex = new TextureLoader().load(faceUrl);
  faceTex.colorSpace = SRGBColorSpace;
  faceTex.anisotropy = 4;
  const faceMat = new MeshLambertMaterial({ map: faceTex });

  const body = new Group();

  function leg(x) {
    const pivot = new Group();
    pivot.position.set(x, 0.5, 0);
    const limb = new Mesh(new BoxGeometry(0.15, 0.42, 0.16), pantsM);
    limb.position.y = -0.21;
    limb.castShadow = shadows;
    const shoe = new Mesh(new BoxGeometry(0.16, 0.08, 0.24), shoeM);
    shoe.position.set(0, -0.44, 0.03);
    pivot.add(limb, shoe);
    return pivot;
  }
  function arm(x, sign) {
    const pivot = new Group();
    pivot.position.set(x, 1.2, 0);
    const limb = new Mesh(new BoxGeometry(0.12, 0.46, 0.12), skin);
    limb.position.y = -0.22;
    limb.castShadow = shadows;
    pivot.add(limb);
    pivot.rotation.z = sign * 0.08;
    return pivot;
  }

  const legL = leg(-0.11);
  const legR = leg(0.11);
  const armL = arm(-0.34, -1);
  const armR = arm(0.34, 1);

  const hips = new Mesh(new BoxGeometry(0.42, 0.2, 0.24), pantsM);
  hips.position.y = 0.62;
  const torso = new Mesh(new BoxGeometry(0.52, 0.56, 0.26), waxMat);
  torso.position.y = 1.02;
  torso.castShadow = shadows;
  const collar = new Mesh(new BoxGeometry(0.28, 0.08, 0.28), waxMat);
  collar.position.set(0, 1.32, 0);

  const head = new Group();
  head.position.y = 1.48;
  const skull = new Mesh(new BoxGeometry(0.3, 0.34, 0.28), skin);
  skull.castShadow = shadows;
  const face = new Mesh(new PlaneGeometry(0.29, 0.33), faceMat);
  face.position.z = 0.145;
  const hairTop = new Mesh(new BoxGeometry(0.3, 0.06, 0.2), hairM);
  hairTop.position.set(0, 0.18, -0.04);
  const fade = new Mesh(new BoxGeometry(0.302, 0.08, 0.16), fadeM);
  fade.position.set(0, 0.1, -0.06);
  const templeL = new Mesh(new BoxGeometry(0.012, 0.012, 0.14), hairM);
  templeL.position.set(-0.15, 0.03, 0.02);
  const templeR = templeL.clone();
  templeR.position.x = 0.15;

  head.add(skull, face, hairTop, fade, templeL, templeR);
  body.add(hips, torso, collar, armL, armR, head);
  g.add(body, legL, legR);
  g.userData.limbs = { legL, legR, armL, armR };
  g.userData.body = body;
  g.userData.setOutfit = (wax) => {
    torso.material = wax ? waxMat : streetMat;
    collar.material = wax ? waxMat : streetMat;
  };
  return g;
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
    player.idle = 0;
    player.yaw = dampAngle(player.yaw, Math.atan2(mx, mz), 10, dt);
    player.pos.x += mx * speed * water * dt;
    player.pos.z += mz * speed * water * dt;
    player.moving = true;
    player.speed = speed * water;
    player.phase += dt * speed * (run ? 2.6 : 2.15);
  } else {
    player.moving = false;
    player.speed = 0;
    player.idle = (player.idle || 0) + dt;
    if (player.idle > 1.1) player.yaw = dampAngle(player.yaw, cameraYaw + Math.PI, 5.5, dt);
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
