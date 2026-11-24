import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  SRGBColorSpace,
} from 'three';
import { cameraPlanarBasis } from './camera-basis.js';
import { PARKED, SPECS } from './config.js';
import { createHuman, poseHuman } from './people.js';
import { clamp, clampWorld, damp, resolveCircle } from './utils.js';

const CAR_COLORS = [0xf4f4f4, 0xc5ccd6, 0xc0392b, 0x1f4e89, 0x1e7a46, 0x2c2c2c, 0xd4782a, 0xf2c14e];
const glassMat = new MeshPhysicalMaterial({
  color: 0xb7d7ea,
  metalness: 0,
  roughness: 0.06,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
  transparent: true,
  opacity: 0.45,
  envMapIntensity: 1.4,
  depthWrite: false,
});
const rubber = new MeshLambertMaterial({ color: 0x1a1a1a });
const dark = new MeshLambertMaterial({ color: 0x1c1c1c });
const chrome = new MeshPhysicalMaterial({ color: 0xd5dbe3, metalness: 0.85, roughness: 0.22 });
const stripeMat = new MeshLambertMaterial({ color: 0x0c8a45 });
const tailMat = new MeshLambertMaterial({ color: 0x6a1010, emissive: 0xff2a2a, emissiveIntensity: 0.45 });
const beamGeo = new BoxGeometry(0.42, 0.16, 3.4);
const beamMat = new MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.22, depthWrite: false });

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

function addBox(parent, w, h, d, x, y, z, material, cast = true) {
  const mesh = new Mesh(new BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  parent.add(mesh);
  return mesh;
}

function addWheel(parent, x, y, z, radius, width, front) {
  const pivot = new Group();
  pivot.position.set(x, y, z);
  const spin = new Group();
  const tireGeo = new CylinderGeometry(radius, radius, width, 12);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new Mesh(tireGeo, rubber);
  tire.castShadow = true;
  const rimGeo = new CylinderGeometry(radius * 0.58, radius * 0.58, width * 1.05, 10);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new Mesh(rimGeo, chrome);
  const hubGeo = new CylinderGeometry(radius * 0.22, radius * 0.22, width * 1.12, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new Mesh(hubGeo, dark);
  spin.add(tire, rim, hub);
  pivot.add(spin);
  parent.add(pivot);
  return { pivot, mesh: spin, front };
}

function addLights(group, xs, y, frontZ, rearZ, headMat, size) {
  let count = 0;
  for (const x of xs) {
    const lamp = new Mesh(new BoxGeometry(size[0], size[1], size[2]), headMat);
    lamp.position.set(x, y, frontZ);
    group.add(lamp);
    const tail = new Mesh(new BoxGeometry(size[0], size[1] * 0.8, 0.06), tailMat);
    tail.position.set(x, y - 0.02, rearZ);
    group.add(tail);
    count += 1;
  }
  return count;
}

function addBeam(group, y, z) {
  const beam = new Mesh(beamGeo, beamMat);
  beam.position.set(0, y, z);
  beam.visible = false;
  group.add(beam);
  return beam;
}

function buildMesh(type, color) {
  const group = new Group();
  const paint = new MeshPhysicalMaterial({
    color,
    metalness: type === 'zem' ? 0.28 : 0.62,
    roughness: type === 'zem' ? 0.34 : 0.18,
    clearcoat: type === 'zem' ? 0.35 : 0.85,
    clearcoatRoughness: type === 'zem' ? 0.28 : 0.12,
    envMapIntensity: type === 'zem' ? 0.9 : 1.25,
  });
  const wheels = [];
  const headMat = new MeshLambertMaterial({ color: 0xfff6d8, emissive: 0xfff1c4, emissiveIntensity: 0 });
  let lights = 0;
  let beam = null;

  if (type === 'zem') {
    addBox(group, 0.16, 0.08, 1.55, 0, 0.58, 0.05, dark);
    addBox(group, 0.42, 0.22, 0.7, 0, 0.7, -0.05, paint);
    addBox(group, 0.36, 0.16, 0.38, 0, 0.78, 0.42, paint);
    addBox(group, 0.34, 0.08, 0.42, 0, 0.96, -0.18, dark);
    addBox(group, 0.08, 0.42, 0.08, 0, 0.78, 0.72, chrome, false);
    addBox(group, 0.5, 0.05, 0.08, 0, 1.02, 0.7, dark);
    addBox(group, 0.5, 0.04, 0.22, 0, 0.5, 0.78, dark);
    addBox(group, 0.46, 0.05, 0.28, 0, 0.52, -0.72, dark);
    addBox(group, 0.08, 0.16, 0.1, -0.28, 1.05, 0.15, chrome, false);
    addBox(group, 0.08, 0.16, 0.1, 0.28, 1.05, 0.15, chrome, false);
    wheels.push(addWheel(group, 0, 0.34, 0.72, 0.32, 0.12, true));
    wheels.push(addWheel(group, 0, 0.34, -0.68, 0.32, 0.14, false));
    const lamp = new Mesh(new BoxGeometry(0.16, 0.12, 0.08), headMat);
    lamp.position.set(0, 0.72, 0.92);
    group.add(lamp);
    lights = 1;
    const tag = new Mesh(new BoxGeometry(0.32, 0.16, 0.02), plateFor('zem'));
    tag.position.set(0, 0.62, -0.9);
    group.add(tag);
    beam = addBeam(group, 0.7, 2.3);
  } else if (type === 'suv') {
    addBox(group, 1.92, 0.28, 4.55, 0, 0.48, 0, dark, false);
    addBox(group, 1.86, 0.46, 4.35, 0, 0.78, 0.02, paint);
    addBox(group, 1.72, 0.22, 1.35, 0, 1.02, 1.15, paint);
    const hood = addBox(group, 1.7, 0.12, 1.15, 0, 1.08, 1.2, paint);
    hood.rotation.x = -0.08;
    addBox(group, 1.78, 0.62, 2.15, 0, 1.38, -0.28, paint);
    const glass = new Mesh(new BoxGeometry(1.64, 0.48, 1.95), glassMat);
    glass.position.set(0, 1.42, -0.22);
    group.add(glass);
    addBox(group, 1.7, 0.06, 2.05, 0, 1.74, -0.25, dark, false);
    addBox(group, 1.9, 0.16, 0.16, 0, 0.52, 2.28, chrome, false);
    addBox(group, 1.9, 0.16, 0.16, 0, 0.52, -2.28, chrome, false);
    addBox(group, 0.08, 0.14, 0.22, -0.98, 1.22, 0.55, chrome, false);
    addBox(group, 0.08, 0.14, 0.22, 0.98, 1.22, 0.55, chrome, false);
    const spots = [[-0.92, 0.36, 1.48], [0.92, 0.36, 1.48], [-0.92, 0.36, -1.48], [0.92, 0.36, -1.48]];
    spots.forEach((p, i) => wheels.push(addWheel(group, p[0], p[1], p[2], 0.36, 0.26, i < 2)));
    lights = addLights(group, [-0.62, 0.62], 0.72, 2.22, -2.24, headMat, [0.32, 0.14, 0.08]);
    const tag = new Mesh(new BoxGeometry(0.46, 0.18, 0.04), plateFor('suv'));
    tag.position.set(0, 0.48, -2.32);
    group.add(tag);
    beam = addBeam(group, 0.72, 3.7);
  } else {
    addBox(group, 1.78, 0.22, 4.35, 0, 0.4, 0, dark, false);
    addBox(group, 1.72, 0.36, 4.15, 0, 0.62, 0.02, paint);
    const hood = addBox(group, 1.58, 0.1, 1.15, 0, 0.86, 1.15, paint);
    hood.rotation.x = -0.1;
    addBox(group, 1.48, 0.16, 0.7, 0, 0.78, -1.45, paint);
    addBox(group, 1.62, 0.48, 1.85, 0, 1.05, -0.2, paint);
    const glass = new Mesh(new BoxGeometry(1.48, 0.38, 1.7), glassMat);
    glass.position.set(0, 1.08, -0.18);
    group.add(glass);
    addBox(group, 1.8, 0.14, 0.12, 0, 0.42, 2.12, chrome, false);
    addBox(group, 1.8, 0.14, 0.12, 0, 0.42, -2.12, chrome, false);
    addBox(group, 0.07, 0.12, 0.18, -0.9, 0.98, 0.42, chrome, false);
    addBox(group, 0.07, 0.12, 0.18, 0.9, 0.98, 0.42, chrome, false);
    if (type !== 'police') {
      addBox(group, 1.74, 0.1, 4.2, 0, 0.72, 0, stripeMat, false);
    }
    const spots = [[-0.82, 0.32, 1.35], [0.82, 0.32, 1.35], [-0.82, 0.32, -1.32], [0.82, 0.32, -1.32]];
    spots.forEach((p, i) => wheels.push(addWheel(group, p[0], p[1], p[2], 0.32, 0.22, i < 2)));
    lights = addLights(group, [-0.58, 0.58], 0.58, 2.12, -2.14, headMat, [0.28, 0.12, 0.07]);
    if (type === 'police') {
      if (!barMat) {
        barMat = new MeshLambertMaterial({ color: 0x88bbff, emissive: 0x2244ff, emissiveIntensity: 1 });
      }
      const bar = new Mesh(new BoxGeometry(0.9, 0.12, 0.28), barMat);
      bar.position.set(0, 1.38, -0.15);
      group.add(bar);
      addBox(group, 1.76, 0.08, 4.2, 0, 0.84, 0, new MeshLambertMaterial({ color: 0x1d4e9e }), false);
    }
    const tag = new Mesh(new BoxGeometry(0.42, 0.16, 0.03), plateFor(type));
    tag.position.set(0, 0.4, -2.16);
    group.add(tag);
    beam = addBeam(group, 0.58, 3.5);
  }

  return { group, wheels, headMat, lights, beam };
}

function makeVehicle(type, x, z, yaw, traffic, color) {
  const built = buildMesh(type, color);
  const vehicle = {
    type,
    mesh: built.group,
    wheels: built.wheels,
    headMat: built.headMat,
    lights: built.lights,
    beam: built.beam,
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
  if (type === 'zem') {
    vehicle.rider = createHuman({
      skin: 0x7a4630,
      shirt: 0xf2c14e,
      pants: 0x243044,
      hair: 0x140e0c,
      scale: 0.82,
    });
    poseHuman(vehicle.rider, 0, 'sit');
    const seat = SEAT.zem;
    vehicle.rider.position.set(seat.x, seat.y, seat.z);
    vehicle.rider.scale.setScalar(seat.s);
    vehicle.mesh.add(vehicle.rider);
  }
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
    const color = type === 'zem' || rand() < 0.72 ? 0xf5c400 : CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
    const vehicle = makeVehicle(type, from.x, from.z, 0, true, color);
    vehicle.from = from;
    vehicle.to = to;
    vehicle.progress = rand();
    vehicle.cruise = type === 'zem' ? 11 : 9.5;
    if (type !== 'zem' && rand() < 0.75) {
      vehicle.rider = createHuman({
        skin: 0x7a4630,
        shirt: 0x1f6feb,
        pants: 0x243044,
        hair: 0x140e0c,
        scale: 0.75,
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
    const side = seat.x >= 0 ? 1 : -1;
    const door = { x: seat.x + side * 0.95, y: 0.02, z: seat.z };
    player.mesh.position.set(door.x, door.y, door.z);
    player.mesh.rotation.set(0, side > 0 ? -1.2 : 1.2, 0);
    player.mesh.scale.setScalar(1);
    player.board = {
      t: 0,
      dur: 0.6,
      kind: 'in',
      from: door,
      to: { x: seat.x, y: seat.y, z: seat.z },
      s: seat.s,
    };
    if (vehicle.rider) vehicle.rider.visible = false;
    poseHuman(player.mesh, 0, 'walk');
  }

  function exit(player, collision) {
    const vehicle = player.vehicle;
    if (!vehicle) return;
    const spot = exitSpot(vehicle, collision);
    const rx = Math.cos(vehicle.yaw);
    const rz = -Math.sin(vehicle.yaw);
    const door = {
      x: vehicle.pos.x + rx * 1.15,
      y: 0.02,
      z: vehicle.pos.z + rz * 1.15,
    };
    scene.add(player.mesh);
    player.mesh.scale.setScalar(1);
    player.pos.x = spot.x;
    player.pos.z = spot.z;
    player.pos.y = 0;
    player.yaw = vehicle.yaw;
    player.vy = 0;
    player.vehicle = null;
    vehicle.controlled = false;
    player.board = {
      t: 0,
      dur: 0.6,
      kind: 'out',
      from: door,
      to: { x: spot.x, y: 0, z: spot.z },
    };
    player.mesh.position.set(door.x, door.y, door.z);
    player.mesh.rotation.set(0, player.yaw, 0);
    poseHuman(player.mesh, 0, 'walk');
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
  if (blocked && Math.random() < dt * 0.35) vehicle.hornT = 0.28;
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
  const night = nightHead > 0.35 ? nightHead : 0;
  vehicle.headMat.emissiveIntensity = night * 2.4 + (vehicle.hornT > 0 ? 1.6 : 0);
  if (vehicle.beam) vehicle.beam.visible = night > 0.4;
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
  tailMat.emissiveIntensity = 0.2 + (nightHead || 0) * 1.8;
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
