import {
  CanvasTexture,
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import { ROAD_XS, ROAD_ZS } from './config.js';

const route = [];
const cum = [];
const CHEVRONS = 22;
const SPACING = 4.2;
const AHEAD = 78;
const dummyPos = new Vector3();
const dummyQuat = new Quaternion();
const dummyScale = new Vector3();
const dummyMatrix = new Matrix4();
const upAxis = new Vector3(0, 1, 0);

function push(x, z) {
  const last = route[route.length - 1];
  if (last && Math.hypot(last.x - x, last.z - z) < 0.8) return;
  route.push({ x, z });
}

function nearestIndex(list, value) {
  let best = 0;
  let bestD = Math.abs(value - list[0]);
  for (let i = 1; i < list.length; i += 1) {
    const d = Math.abs(value - list[i]);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/** Le bout de la flèche est vers -Z du plan. On ajoute π pour qu'il suive le chemin. */
export function chevronForward(pathYaw) {
  const meshYaw = pathYaw + Math.PI;
  return { x: -Math.sin(meshYaw), z: -Math.cos(meshYaw) };
}

export function pathHeading(ax, az, bx, bz) {
  return Math.atan2(bx - ax, bz - az);
}

function astarNodes(ax, az, bx, bz) {
  const xs = ROAD_XS;
  const zs = ROAD_ZS;
  const start = [nearestIndex(xs, ax), nearestIndex(zs, az)];
  const goal = [nearestIndex(xs, bx), nearestIndex(zs, bz)];
  const key = (ix, iz) => `${ix},${iz}`;
  const gScore = new Map([[key(start[0], start[1]), 0]]);
  const came = new Map();
  const open = [start];
  const heuristic = (ix, iz) => Math.abs(xs[ix] - xs[goal[0]]) + Math.abs(zs[iz] - zs[goal[1]]);
  while (open.length) {
    open.sort((a, b) => (gScore.get(key(a[0], a[1])) + heuristic(a[0], a[1]))
      - (gScore.get(key(b[0], b[1])) + heuristic(b[0], b[1])));
    const [ix, iz] = open.shift();
    if (ix === goal[0] && iz === goal[1]) break;
    const next = [];
    if (ix > 0) next.push([ix - 1, iz]);
    if (ix < xs.length - 1) next.push([ix + 1, iz]);
    if (iz > 0) next.push([ix, iz - 1]);
    if (iz < zs.length - 1) next.push([ix, iz + 1]);
    for (const node of next) {
      const step = Math.hypot(xs[node[0]] - xs[ix], zs[node[1]] - zs[iz]);
      const score = gScore.get(key(ix, iz)) + step;
      if (score + 0.01 >= (gScore.get(key(node[0], node[1])) ?? Infinity)) continue;
      gScore.set(key(node[0], node[1]), score);
      came.set(key(node[0], node[1]), [ix, iz]);
      if (!open.some((item) => item[0] === node[0] && item[1] === node[1])) open.push(node);
    }
  }
  const path = [];
  let cursor = goal;
  const seen = new Set();
  while (cursor && !seen.has(key(cursor[0], cursor[1]))) {
    seen.add(key(cursor[0], cursor[1]));
    path.push({ x: xs[cursor[0]], z: zs[cursor[1]] });
    cursor = came.get(key(cursor[0], cursor[1]));
  }
  path.reverse();
  return path;
}

export function gridRoute(ax, az, bx, bz) {
  route.length = 0;
  push(ax, az);
  for (const point of astarNodes(ax, az, bx, bz)) push(point.x, point.z);
  push(bx, bz);
  return route;
}

function chevronTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffe14a';
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.lineTo(60, 42);
  ctx.lineTo(46, 42);
  ctx.lineTo(32, 24);
  ctx.lineTo(18, 42);
  ctx.lineTo(4, 42);
  ctx.closePath();
  ctx.fill();
  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

function buildLengths() {
  cum.length = 0;
  cum.push(0);
  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1];
    const b = route[i];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  return cum[cum.length - 1] || 0;
}

function poseAt(distance, out) {
  const total = cum[cum.length - 1] || 0;
  const d = Math.max(0, Math.min(total - 0.01, distance));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i += 1;
  const a = route[i - 1];
  const b = route[i];
  const span = (cum[i] - cum[i - 1]) || 1;
  const t = (d - cum[i - 1]) / span;
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  out.yaw = Math.atan2(b.x - a.x, b.z - a.z);
  return out;
}

export function createGps(scene) {
  const arrow = new Group();
  const head = new Mesh(
    new ConeGeometry(0.55, 1.5, 5),
    new MeshBasicMaterial({ color: 0xffe14a }),
  );
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.4;
  arrow.add(head);
  arrow.visible = false;
  scene.add(arrow);

  const chevronGeo = new PlaneGeometry(1.7, 2.5);
  chevronGeo.rotateX(-Math.PI / 2);
  const chevrons = new InstancedMesh(
    chevronGeo,
    new MeshBasicMaterial({
      map: chevronTexture(),
      transparent: true,
      depthWrite: false,
      color: 0xffe14a,
    }),
    CHEVRONS,
  );
  chevrons.frustumCulled = false;
  chevrons.count = 0;
  scene.add(chevrons);
  const cursor = { x: 0, z: 0, yaw: 0 };

  return {
    route,
    count: 0,
    update(player, target, time) {
      if (!target) {
        arrow.visible = false;
        chevrons.count = 0;
        route.length = 0;
        this.count = 0;
        return;
      }
      gridRoute(player.pos.x, player.pos.z, target.x, target.z);
      arrow.visible = true;
      arrow.position.set(player.pos.x, 3.35, player.pos.z);
      arrow.lookAt(target.x, 3.35, target.z);
      const total = buildLengths();
      let closest = 0;
      let closestD = Infinity;
      for (let d = 0; d <= total; d += 2) {
        poseAt(d, cursor);
        const dist = Math.hypot(cursor.x - player.pos.x, cursor.z - player.pos.z);
        if (dist < closestD) {
          closestD = dist;
          closest = d;
        }
      }
      const scroll = (time * 7) % SPACING;
      let shown = 0;
      for (let n = 0; n < CHEVRONS; n += 1) {
        const along = closest + 5 + n * SPACING + scroll;
        if (along > closest + AHEAD || along >= total) break;
        poseAt(along, cursor);
        const fromPlayer = Math.hypot(cursor.x - player.pos.x, cursor.z - player.pos.z);
        const fade = fromPlayer < 5 ? 0.001 : Math.min(1, (fromPlayer - 5) / 6);
        dummyPos.set(cursor.x, 0.26, cursor.z);
        dummyQuat.setFromAxisAngle(upAxis, cursor.yaw + Math.PI);
        dummyScale.set(fade, fade, fade);
        dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
        chevrons.setMatrixAt(n, dummyMatrix);
        shown += 1;
      }
      chevrons.count = shown;
      chevrons.instanceMatrix.needsUpdate = true;
      this.count = shown;
      this.waypoint = shown ? { x: cursor.x, z: cursor.z } : { x: target.x, z: target.z };
    },
    chevronDot() {
      if (route.length < 2) return 1;
      let worst = 1;
      for (let i = 1; i < route.length; i += 1) {
        const a = route[i - 1];
        const b = route[i];
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const yaw = pathHeading(a.x, a.z, b.x, b.z);
        const fwd = chevronForward(yaw);
        worst = Math.min(worst, (fwd.x * (b.x - a.x) + fwd.z * (b.z - a.z)) / len);
      }
      return worst;
    },
  };
}
