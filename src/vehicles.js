import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';
import { cameraPlanarBasis } from './camera-basis.js';
import { PARKED, SPECS } from './config.js';
import { createHuman, poseHuman } from './people.js';
import { clamp, clampWorld, damp, resolveCircle } from './utils.js';

const CAR_COLORS = [0xf4f4f4, 0xc5ccd6, 0xc0392b, 0x1f4e89, 0x1e7a46, 0x2c2c2c, 0xd4782a, 0xf2c14e];
const glassMat = new MeshPhongMaterial({
  color: 0x9ec9e0,
  transparent: true,
  opacity: 0.45,
  shininess: 80,
  specular: 0xffffff,
  depthWrite: false,
});
const rubber = new MeshLambertMaterial({ color: 0x1a1a1a });
const dark = new MeshLambertMaterial({ color: 0x222222 });
const tailMat = new MeshLambertMaterial({ color: 0x6a1010, emissive: 0xff2a2a, emissiveIntensity: 0.45 });

let barMat = null;

function plateMaterial(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 48);
  ctx.fillStyle = fg;
  ctx.font = '700 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 26);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return new MeshLambertMaterial({ map: tex });
}

const plates = {
  suv: null,
  zem: null,
  car: null,
  police: null,
};

function plateFor(type) {
  if (!plates[type]) {
    if (type === 'suv') plates[type] = plateMaterial('COT 229', '#f4f1ea', '#1a1a1a');
    else if (type === 'zem') plates[type] = plateMaterial('ZEM', '#f5c400', '#1a1a1a');
    else if (type === 'police') plates[type] = plateMaterial('POLICE', '#123a8a', '#ffffff');
    else plates[type] = plateMaterial('RB', '#f4f1ea', '#1a1a1a');
  }
  return plates[type];
}

function addWheel(parent, x, y, z, radius, width, front) {
  const pivot = new Group();
  pivot.position.set(x, y, z);
  const geo = new CylinderGeometry(radius, radius, width, 8);
  geo.rotateZ(Math.PI / 2);
  const mesh = new Mesh(geo, rubber);
  pivot.add(mesh);
  parent.add(pivot);
  return { pivot, mesh, front };
}

function buildMesh(type, color) {
  const group = new Group();
  const paint = new MeshStandardMaterial({
    color,
    metalness: type === 'zem' ? 0.28 : 0.74,
    roughness: type === 'zem' ? 0.42 : 0.2,
    envMapIntensity: type === 'zem' ? 0.7 : 1.15,
  });
  const wheels = [];
  const headMat = new MeshLambertMaterial({ color: 0xfff6d8, emissive: 0xfff1c4, emissiveIntensity: 0 });

  if (type === 'zem') {
    const board = new Mesh(new BoxGeometry(0.42, 0.1, 1.7), paint);
    board.position.y = 0.62;
    const body = new Mesh(new BoxGeometry(0.5, 0.36, 1.15), paint);
    body.position.set(0, 0.78, 0.15);
    body.castShadow = true;
    const seat = new Mesh(new BoxGeometry(0.4, 0.1, 0.42), dark);
    seat.position.set(0, 1.0, -0.15);
    const bar = new Mesh(new BoxGeometry(0.46, 0.06, 0.12), dark);
    bar.position.set(0, 0.92, 0.62);
    group.add(board, body, seat, bar);
    wheels.push(addWheel(group, 0, 0.32, 0.62, 0.3, 0.14, true));
    wheels.push(addWheel(group, 0, 0.32, -0.62, 0.3, 0.14, false));
    const lamp = new Mesh(new BoxGeometry(0.12, 0.1, 0.08), headMat);
    lamp.position.set(0, 0.78, 0.78);
    group.add(lamp);
    const tag = new Mesh(new BoxGeometry(0.32, 0.16, 0.02), plateFor('zem'));
    tag.position.set(0, 0.7, -0.86);
    group.add(tag);
  } else if (type === 'suv') {
    const lower = new Mesh(new BoxGeometry(2.05, 0.8, 4.7), paint);
    lower.position.y = 0.72;
    lower.castShadow = true;
    const cabin = new Mesh(new BoxGeometry(1.9, 0.78, 2.45), paint);
    cabin.position.set(0, 1.42, -0.15);
    cabin.castShadow = true;
    const glass = new Mesh(new BoxGeometry(1.72, 0.58, 2.2), glassMat);
    glass.position.set(0, 1.46, -0.12);
    const rear = new Mesh(new BoxGeometry(1.35, 0.4, 0.06), glassMat);
    rear.position.set(0, 1.46, -1.4);
    const rail = new Mesh(new BoxGeometry(1.75, 0.07, 2.15), dark);
    rail.position.set(0, 1.86, -0.15);
    group.add(lower, cabin, glass, rear, rail);
    const spots = [[-0.98, 0.38, 1.45], [0.98, 0.38, 1.45], [-0.98, 0.38, -1.45], [0.98, 0.38, -1.45]];
    spots.forEach((p, i) => wheels.push(addWheel(group, p[0], p[1], p[2], 0.38, 0.28, i < 2)));
    for (const x of [-0.7, 0.7]) {
      const lamp = new Mesh(new BoxGeometry(0.28, 0.16, 0.08), headMat);
      lamp.position.set(x, 0.78, 2.36);
      group.add(lamp);
      const tail = new Mesh(new BoxGeometry(0.28, 0.14, 0.06), tailMat);
      tail.position.set(x, 0.78, -2.36);
      group.add(tail);
    }
    const tag = new Mesh(new BoxGeometry(0.46, 0.2, 0.04), plateFor('suv'));
    tag.position.set(0, 0.55, -2.38);
    group.add(tag);
  } else {
    const lower = new Mesh(new BoxGeometry(1.85, 0.55, 4.25), paint);
    lower.position.y = 0.55;
    lower.castShadow = true;
    const cabin = new Mesh(new BoxGeometry(1.7, 0.55, 2.05), paint);
    cabin.position.set(0, 1.02, -0.15);
    const glass = new Mesh(new BoxGeometry(1.55, 0.42, 1.85), glassMat);
    glass.position.set(0, 1.05, -0.12);
    group.add(lower, cabin, glass);
    const spots = [[-0.88, 0.32, 1.3], [0.88, 0.32, 1.3], [-0.88, 0.32, -1.3], [0.88, 0.32, -1.3]];
    spots.forEach((p, i) => wheels.push(addWheel(group, p[0], p[1], p[2], 0.32, 0.24, i < 2)));
    for (const x of [-0.62, 0.62]) {
      const lamp = new Mesh(new BoxGeometry(0.24, 0.12, 0.06), headMat);
      lamp.position.set(x, 0.62, 2.14);
      group.add(lamp);
      const tail = new Mesh(new BoxGeometry(0.24, 0.12, 0.05), tailMat);
      tail.position.set(x, 0.58, -2.14);
      group.add(tail);
    }
    if (type === 'police') {
      if (!barMat) {
        barMat = new MeshLambertMaterial({ color: 0x88bbff, emissive: 0x2244ff, emissiveIntensity: 1 });
      }
      const bar = new Mesh(new BoxGeometry(0.9, 0.14, 0.28), barMat);
      bar.position.set(0, 1.4, -0.1);
      group.add(bar);
      const stripe = new Mesh(new BoxGeometry(1.86, 0.08, 4.26), new MeshLambertMaterial({ color: 0x1d4e9e }));
      stripe.position.y = 0.86;
      group.add(stripe);
    }
    const tag = new Mesh(new BoxGeometry(0.42, 0.18, 0.04), plateFor(type));
    tag.position.set(0, 0.42, -2.15);
    group.add(tag);
  }

  return { group, wheels, headMat };
}

function makeVehicle(type, x, z, yaw, traffic, color) {
  const built = buildMesh(type, color);
  const vehicle = {
    type,
    mesh: built.group,
    wheels: built.wheels,
    headMat: built.headMat,
    pos: { x, z, y: 0 },
    yaw,
    speed: 0,
    steer: 0,
    steerVisual: 0,
    ai: traffic,
    traffic,
    controlled: false,
    police: type === 'police',
    leaving: false,
    offroad: false,
    from: null,
    to: null,
    progress: 0,
    radius: SPECS[type].radius,
    rider: null,
    hornT: 0,
    dead: false,
  };
  built.group.position.set(x, 0, z);
  built.group.rotation.y = yaw;
  return vehicle;
}

const SEAT = {
  suv: { x: -0.46, y: 0.22, z: 0.05, s: 0.82 },
  car: { x: -0.38, y: 0.18, z: 0.02, s: 0.78 },
  zem: { x: 0, y: 0.46, z: -0.12, s: 0.86 },
  police: { x: -0.38, y: 0.18, z: 0.02, s: 0.78 },
};

export function createTraffic(scene, graph, quality, rand) {
  const list = [];
  for (const parked of PARKED) {
    const color = parked.type === 'suv' ? 0x141416 : 0xf5c400;
    const vehicle = makeVehicle(parked.type, parked.x, parked.z, parked.yaw, false, color);
    scene.add(vehicle.mesh);
    list.push(vehicle);
  }

  const used = new Set();
  const nodes = graph.nodes;
  for (let i = 0; i < quality.traffic; i += 1) {
    let from = nodes[Math.floor(rand() * nodes.length)];
    let to = from.neighbors[Math.floor(rand() * from.neighbors.length)];
    let guard = 0;
    while (used.has(`${from.x},${from.z},${to.x},${to.z}`) && guard < 20) {
      from = nodes[Math.floor(rand() * nodes.length)];
      to = from.neighbors[Math.floor(rand() * from.neighbors.length)];
      guard += 1;
    }
    used.add(`${from.x},${from.z},${to.x},${to.z}`);
    const type = rand() < 0.48 ? 'zem' : 'car';
    const color = type === 'zem' ? 0xf5c400 : CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
    const vehicle = makeVehicle(type, from.x, from.z, 0, true, color);
    vehicle.from = from;
    vehicle.to = to;
    vehicle.progress = rand();
    vehicle.cruise = type === 'zem' ? 11 : 9.5;
    if (rand() < 0.75) {
      vehicle.rider = createHuman({
        skin: 0x7a4630,
        shirt: type === 'zem' ? 0xf2c14e : 0x1f6feb,
        pants: 0x243044,
        hair: 0x140e0c,
        scale: type === 'zem' ? 0.82 : 0.75,
      });
      poseHuman(vehicle.rider, 0, 'sit');
      const seat = SEAT[type];
      vehicle.rider.position.set(seat.x, seat.y, seat.z);
      vehicle.rider.scale.setScalar(seat.s);
      vehicle.mesh.add(vehicle.rider);
    }
    scene.add(vehicle.mesh);
    list.push(vehicle);
  }

  function spawnPolice(player) {
    let best = null;
    let bestScore = -1;
    for (const node of nodes) {
      const d = Math.hypot(node.x - player.pos.x, node.z - player.pos.z);
      if (d < 55 || d > 130) continue;
      const score = d + rand() * 8;
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }
    if (!best) best = nodes[0];
    const vehicle = makeVehicle('police', best.x, best.z, 0, true, 0xf7f7f7);
    vehicle.from = best;
    vehicle.to = best.neighbors[0];
    vehicle.progress = 0;
    vehicle.cruise = 16;
    vehicle.police = true;
    scene.add(vehicle.mesh);
    list.push(vehicle);
  }

  return { list, spawnPolice, nearestEnterable, enter, exit };

  function nearestEnterable(pos) {
    let best = null;
    let bestD = Infinity;
    for (const vehicle of list) {
      if (vehicle.police || vehicle.controlled || vehicle.dead) continue;
      const d = Math.hypot(vehicle.pos.x - pos.x, vehicle.pos.z - pos.z);
      if (d < SPECS[vehicle.type].reach && d < bestD) {
        best = vehicle;
        bestD = d;
      }
    }
    return best;
  }

  function enter(player, vehicle) {
    player.vehicle = vehicle;
    vehicle.controlled = true;
    vehicle.ai = false;
    vehicle.mesh.add(player.mesh);
    const seat = SEAT[vehicle.type];
    player.mesh.position.set(seat.x, seat.y, seat.z);
    player.mesh.rotation.set(0, 0, 0);
    player.mesh.scale.setScalar(seat.s);
    if (vehicle.rider) vehicle.rider.visible = false;
    poseHuman(player.mesh, 0, 'sit');
  }

  function exit(player, collision) {
    const vehicle = player.vehicle;
    if (!vehicle) return;
    const spot = exitSpot(vehicle, collision);
    scene.add(player.mesh);
    player.mesh.scale.setScalar(1);
    player.pos.x = spot.x;
    player.pos.z = spot.z;
    player.pos.y = 0;
    player.yaw = vehicle.yaw;
    player.vy = 0;
    player.vehicle = null;
    vehicle.controlled = false;
    player.mesh.position.set(spot.x, 0, spot.z);
    player.mesh.rotation.set(0, player.yaw, 0);
    poseHuman(player.mesh, 0, 'idle');
    if (vehicle.rider) vehicle.rider.visible = true;
    if (vehicle.traffic) {
      vehicle.ai = true;
      snapToGraph(vehicle, graph);
    }
  }
}

function exitSpot(vehicle, collision) {
  const rx = Math.cos(vehicle.yaw);
  const rz = -Math.sin(vehicle.yaw);
  const fx = Math.sin(vehicle.yaw);
  const fz = Math.cos(vehicle.yaw);
  const options = [
    [rx * 2.1, rz * 2.1],
    [-rx * 2.1, -rz * 2.1],
    [-fx * 3.2, -fz * 3.2],
  ];
  for (const [ox, oz] of options) {
    const x = vehicle.pos.x + ox;
    const z = vehicle.pos.z + oz;
    const resolved = resolveCircle(x, z, 0.4, collision);
    if (Math.hypot(resolved.x - x, resolved.z - z) < 0.4) return resolved;
  }
  return { x: vehicle.pos.x - fx * 3.2, z: vehicle.pos.z - fz * 3.2 };
}

function snapToGraph(vehicle, graph) {
  let best = graph.nodes[0];
  let bestD = Infinity;
  for (const node of graph.nodes) {
    const d = (node.x - vehicle.pos.x) ** 2 + (node.z - vehicle.pos.z) ** 2;
    if (d < bestD) {
      best = node;
      bestD = d;
    }
  }
  vehicle.from = best;
  vehicle.to = best.neighbors[0];
  vehicle.progress = 0;
  vehicle.offroad = false;
}

function laneFor(from, to) {
  const horizontal = Math.abs(from.z - to.z) < 0.01;
  if (horizontal && Math.abs(from.z - 56) < 0.01) return 3.35;
  return 2.25;
}

function drivePlayer(vehicle, dt, input, collision, onCrash) {
  const spec = SPECS[vehicle.type];
  const handbrake = input.handbrake;
  const basis = Number.isFinite(input.cameraYaw) ? cameraPlanarBasis(input.cameraYaw) : null;
  let throttle = input.forward;
  let steer = input.right;
  if (basis && !handbrake) {
    const wishX = basis.forwardX * input.forward + basis.rightX * input.right;
    const wishZ = basis.forwardZ * input.forward + basis.rightZ * input.right;
    const mag = Math.min(1, Math.hypot(wishX, wishZ));
    throttle = 0;
    steer = 0;
    if (mag > 0.05) {
      let desired = Math.atan2(wishX, wishZ);
      let diff = Math.atan2(Math.sin(desired - vehicle.yaw), Math.cos(desired - vehicle.yaw));
      if (Math.abs(diff) > Math.PI * 0.55) {
        desired += Math.PI;
        diff = Math.atan2(Math.sin(desired - vehicle.yaw), Math.cos(desired - vehicle.yaw));
        throttle = -mag;
      } else {
        throttle = mag;
      }
      steer = clamp(diff / 1.15, -1, 1);
    }
  }
  if (handbrake && basis) {
    // Augmenter le yaw déplace le nez vers la gauche de l'écran quand
    // la voiture regarde comme la caméra. On inverse pour que stick
    // droite = tourner vers la droite de l'écran.
    const noseX = Math.cos(vehicle.yaw);
    const noseZ = -Math.sin(vehicle.yaw);
    const towardRight = noseX * basis.rightX + noseZ * basis.rightZ;
    steer = input.right * (towardRight >= 0 ? 1 : -1);
  }
  let { speed } = vehicle;
  vehicle.steer = damp(vehicle.steer || 0, steer, handbrake ? 8 : 4.8, dt);
  const applied = vehicle.steer;
  if (handbrake) {
    speed = damp(speed, 0, 3.4, dt);
    vehicle.yaw += applied * spec.turn * 0.85 * dt;
  } else {
    const sign = speed >= -0.15 ? 1 : -1;
    const speed01 = clamp(Math.abs(speed) / Math.max(6, spec.max), 0, 1);
    const rate = spec.turn * (0.62 - 0.28 * speed01);
    vehicle.yaw += applied * rate * sign * dt;
    let target = throttle > 0.05 ? spec.max * throttle : throttle < -0.05 ? -spec.reverse * -throttle : 0;
    if (input.nitro && target > 0) target *= vehicle.type === 'zem' ? 1.35 : 1.45;
    const response = Math.abs(throttle) > 0.05 ? (vehicle.type === 'zem' ? 7.2 : 4.6) : (vehicle.type === 'zem' ? 3.2 : 2.2);
    speed = damp(speed, target, response * (input.nitro ? 1.35 : 1), dt);
  }
  vehicle.steerVisual = vehicle.steer || 0;
  const before = speed;
  let nx = vehicle.pos.x + Math.sin(vehicle.yaw) * speed * dt;
  let nz = vehicle.pos.z + Math.cos(vehicle.yaw) * speed * dt;
  const resolved = resolveCircle(nx, nz, spec.radius, collision);
  if (resolved.hit) {
    speed *= 0.32;
    if (Math.abs(before) > 8) onCrash(null, Math.abs(before));
  }
  const bounded = clampWorld(resolved.x, resolved.z, true);
  if (bounded.clamped) speed *= -0.12;
  vehicle.pos.x = bounded.x;
  vehicle.pos.z = bounded.z;
  vehicle.speed = speed;
}

function ahead(vehicle, tx, tz, dist, side) {
  const dx = tx - vehicle.pos.x;
  const dz = tz - vehicle.pos.z;
  const fx = Math.sin(vehicle.yaw);
  const fz = Math.cos(vehicle.yaw);
  const along = dx * fx + dz * fz;
  const lateral = Math.abs(dx * fz - dz * fx);
  return along > 0 && along < dist && lateral < side;
}

function driveAI(vehicle, dt, player, list, collision) {
  const targetPos = player.vehicle ? player.vehicle.pos : player.pos;
  const dist = Math.hypot(targetPos.x - vehicle.pos.x, targetPos.z - vehicle.pos.z);
  if (vehicle.police && vehicle.leaving && dist > 110) {
    vehicle.dead = true;
    return;
  }
  if (vehicle.police && !vehicle.leaving && dist < 72) {
    vehicle.offroad = true;
    const desired = Math.atan2(targetPos.x - vehicle.pos.x, targetPos.z - vehicle.pos.z);
    vehicle.yaw = dampAngleSafe(vehicle.yaw, desired, 8, dt);
    vehicle.speed = damp(vehicle.speed, 22, 3.4, dt);
    let nx = vehicle.pos.x + Math.sin(vehicle.yaw) * vehicle.speed * dt;
    let nz = vehicle.pos.z + Math.cos(vehicle.yaw) * vehicle.speed * dt;
    const resolved = resolveCircle(nx, nz, vehicle.radius, collision);
    const bounded = clampWorld(resolved.x, resolved.z, true);
    vehicle.pos.x = bounded.x;
    vehicle.pos.z = bounded.z;
    if (resolved.hit) vehicle.speed *= 0.5;
    return;
  }
  if (vehicle.offroad) snapLoose(vehicle);
  if (!vehicle.to || !vehicle.from) return;
  const segLen = Math.hypot(vehicle.to.x - vehicle.from.x, vehicle.to.z - vehicle.from.z) || 1;
  const fx = (vehicle.to.x - vehicle.from.x) / segLen;
  const fz = (vehicle.to.z - vehicle.from.z) / segLen;
  vehicle.yaw = Math.atan2(fx, fz);
  let blocked = false;
  for (const other of list) {
    if (other !== vehicle && ahead(vehicle, other.pos.x, other.pos.z, 8, 2.3)) blocked = true;
  }
  if (player.vehicle && player.vehicle !== vehicle && ahead(vehicle, player.vehicle.pos.x, player.vehicle.pos.z, 9, 2.5)) {
    blocked = true;
  }
  if (!player.vehicle && ahead(vehicle, player.pos.x, player.pos.z, 6, 1.8)) blocked = true;
  const cruise = blocked ? 0 : vehicle.cruise;
  vehicle.speed = damp(vehicle.speed, cruise, blocked ? 3 : 1.6, dt);
  vehicle.progress += (vehicle.speed * dt) / segLen;
  if (vehicle.progress >= 1 || vehicle.speed < 0.05 && blocked && vehicle.progress > 0.92) {
    const previous = vehicle.from;
    vehicle.from = vehicle.to;
    const options = vehicle.from.neighbors.filter((node) => node !== previous);
    const pool = options.length ? options : [previous];
    if (vehicle.police && !vehicle.leaving) {
      vehicle.to = pool.reduce((best, node) => {
        const d1 = Math.hypot(node.x - targetPos.x, node.z - targetPos.z);
        const d2 = Math.hypot(best.x - targetPos.x, best.z - targetPos.z);
        return d1 < d2 ? node : best;
      }, pool[0]);
    } else if (vehicle.leaving) {
      vehicle.to = pool.reduce((best, node) => {
        const d1 = Math.hypot(node.x - targetPos.x, node.z - targetPos.z);
        const d2 = Math.hypot(best.x - targetPos.x, best.z - targetPos.z);
        return d1 > d2 ? node : best;
      }, pool[0]);
    } else {
      vehicle.to = pool[Math.floor(Math.random() * pool.length)];
    }
    vehicle.progress = 0;
  }
  const t = clamp(vehicle.progress, 0, 1);
  const lane = laneFor(vehicle.from, vehicle.to) * Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
  const rx = fz;
  const rz = -fx;
  vehicle.pos.x = vehicle.from.x + (vehicle.to.x - vehicle.from.x) * t + rx * lane;
  vehicle.pos.z = vehicle.from.z + (vehicle.to.z - vehicle.from.z) * t + rz * lane;
  if (!vehicle.police && vehicle.speed < 0.35) {
    vehicle.stuck = (vehicle.stuck || 0) + dt;
    if (vehicle.stuck > 2.8) {
      const far = vehicle.from.neighbors[0] || vehicle.to;
      vehicle.pos.x = far.x;
      vehicle.pos.z = far.z;
      vehicle.from = far;
      vehicle.to = far.neighbors[0];
      vehicle.progress = 0;
      vehicle.stuck = 0;
      vehicle.speed = vehicle.cruise;
    }
  } else {
    vehicle.stuck = 0;
  }
}

function snapLoose(vehicle) {
  vehicle.offroad = false;
  vehicle.progress = 0.5;
}

function dampAngleSafe(a, b, lambda, dt) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * (1 - Math.exp(-lambda * dt));
}

let sirenTime = 0;

function syncVisual(vehicle, dt, nightHead) {
  vehicle.mesh.position.set(vehicle.pos.x, 0, vehicle.pos.z);
  const lean = vehicle.type === 'zem' ? -vehicle.steerVisual * clamp(Math.abs(vehicle.speed) / 9, 0, 1) * 0.46 : 0;
  vehicle.mesh.rotation.set(lean * 0.15, vehicle.yaw, lean);
  const spin = vehicle.speed * dt * (vehicle.type === 'zem' ? 4.2 : 2.6);
  for (const wheel of vehicle.wheels) {
    wheel.mesh.rotation.x += spin;
    if (wheel.front) wheel.pivot.rotation.y = -vehicle.steerVisual * 0.35;
  }
  vehicle.hornT = Math.max(0, vehicle.hornT - dt);
  vehicle.headMat.emissiveIntensity = nightHead + (vehicle.hornT > 0 ? 1.3 : 0);
  if (vehicle.rider) vehicle.rider.visible = !vehicle.controlled;
}

function separatePlayer(vehicle, list, onCrash) {
  for (const other of list) {
    if (other === vehicle || other.dead) continue;
    const dx = vehicle.pos.x - other.pos.x;
    const dz = vehicle.pos.z - other.pos.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const min = vehicle.radius + other.radius;
    if (dist < min) {
      const push = (min - dist) / dist;
      vehicle.pos.x += dx * push;
      vehicle.pos.z += dz * push;
      if (Math.abs(vehicle.speed) > 7) onCrash(other, Math.abs(vehicle.speed));
      vehicle.speed *= 0.5;
    }
  }
}

export function updateVehicles(bundle, dt, input, player, collision, nightHead, hooks, view) {
  const { list } = bundle;
  sirenTime += dt;
  if (barMat) {
    const on = Math.sin(sirenTime * 10) > 0;
    barMat.emissive.setHex(on ? 0xff2244 : 0x2266ff);
    barMat.color.setHex(on ? 0xff99aa : 0x99ccff);
  }
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const vehicle = list[i];
    if (vehicle.dead) {
      vehicle.mesh.parent?.remove(vehicle.mesh);
      list.splice(i, 1);
      continue;
    }
    if (vehicle.controlled) drivePlayer(vehicle, dt, input, collision, hooks.onCrash);
    else if (vehicle.ai) driveAI(vehicle, dt, player, list, collision);
    else vehicle.speed = damp(vehicle.speed, 0, 1.6, dt);
    if (!vehicle.ai) {
      const nx = vehicle.pos.x + Math.sin(vehicle.yaw) * vehicle.speed * dt;
      const nz = vehicle.pos.z + Math.cos(vehicle.yaw) * vehicle.speed * dt;
      if (!vehicle.controlled) {
        const resolved = resolveCircle(nx, nz, vehicle.radius, collision);
        const bounded = clampWorld(resolved.x, resolved.z, true);
        vehicle.pos.x = bounded.x;
        vehicle.pos.z = bounded.z;
      }
    }
    const dx = vehicle.pos.x - (view?.x ?? player.pos.x);
    const dz = vehicle.pos.z - (view?.z ?? player.pos.z);
    const hide = view?.hide ?? 150;
    const far = !vehicle.controlled && (dx * dx + dz * dz) > hide * hide;
    vehicle.mesh.visible = !far;
    if (!far) syncVisual(vehicle, dt, nightHead);
  }
  if (player.vehicle) {
    separatePlayer(player.vehicle, list, hooks.onCrash);
    const resolved = resolveCircle(player.vehicle.pos.x, player.vehicle.pos.z, player.vehicle.radius, collision);
    const bounded = clampWorld(resolved.x, resolved.z, true);
    player.vehicle.pos.x = bounded.x;
    player.vehicle.pos.z = bounded.z;
    syncVisual(player.vehicle, dt, nightHead);
  }
}

export function horn(vehicle) {
  if (vehicle) vehicle.hornT = 0.28;
}
