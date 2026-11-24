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

function nearest(list, value) {
  let best = list[0];
  let bestD = Math.abs(value - best);
  for (let i = 1; i < list.length; i += 1) {
    const d = Math.abs(value - list[i]);
    if (d < bestD) {
      best = list[i];
      bestD = d;
    }
  }
  return best;
}

function push(x, z) {
  const last = route[route.length - 1];
  if (last && Math.hypot(last.x - x, last.z - z) < 0.8) return;
  route.push({ x, z });
}

export function gridRoute(ax, az, bx, bz) {
  route.length = 0;
  const sx = nearest(ROAD_XS, ax);
  const sz = nearest(ROAD_ZS, az);
  const ex = nearest(ROAD_XS, bx);
  const ez = nearest(ROAD_ZS, bz);
  push(ax, az);
  push(sx, sz);
  push(ex, sz);
  push(ex, ez);
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
        dummyQuat.setFromAxisAngle(upAxis, cursor.yaw);
        dummyScale.set(fade, fade, fade);
        dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
        chevrons.setMatrixAt(n, dummyMatrix);
        shown += 1;
      }
      chevrons.count = shown;
      chevrons.instanceMatrix.needsUpdate = true;
      this.count = shown;
    },
  };
}
