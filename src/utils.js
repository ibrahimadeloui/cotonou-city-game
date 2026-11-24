import { BoxGeometry, BufferAttribute, BufferGeometry, Color } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAP } from './config.js';

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function dampAngle(a, b, lambda, dt) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * (1 - Math.exp(-lambda * dt));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatFCFA(n) {
  return `${new Intl.NumberFormat('fr-FR').format(Math.max(0, Math.round(n)))}\u00a0FCFA`;
}

export function formatMeters(m) {
  if (m >= 1000) {
    return `${(m / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\u00a0km`;
  }
  return `${Math.round(m)}\u00a0m`;
}

export function formatHour(hour) {
  const wrapped = ((hour % 24) + 24) % 24;
  const h = Math.floor(wrapped);
  const m = Math.floor((wrapped - h) * 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function paint(geom, color) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const col = new Color(color);
  const count = g.getAttribute('position').count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new BufferAttribute(arr, 3));
  if (g !== geom) geom.dispose();
  return g;
}

export function coloredBox(w, h, d, x, y, z, color, yaw = 0) {
  const g = new BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv');
  const su = Math.max(w, d) / 2.4;
  const sv = Math.max(h, 0.35) / 2.4;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  if (yaw) g.rotateY(yaw);
  g.translate(x, y, z);
  return paint(g, color);
}

export function mergeColored(geoms) {
  if (!geoms.length) return new BufferGeometry();
  const merged = mergeGeometries(geoms, false);
  for (const g of geoms) g.dispose();
  return merged;
}

export function resolveCircle(x, z, radius, boxes) {
  let cx = x;
  let cz = z;
  let hit = false;
  const r2 = radius * radius;
  for (let iter = 0; iter < 2; iter += 1) {
    for (let i = 0; i < boxes.length; i += 1) {
      const b = boxes[i];
      const qx = clamp(cx, b.minX, b.maxX);
      const qz = clamp(cz, b.minZ, b.maxZ);
      let dx = cx - qx;
      let dz = cz - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r2) continue;
      hit = true;
      if (d2 < 1e-8) {
        const left = cx - b.minX;
        const right = b.maxX - cx;
        const south = cz - b.minZ;
        const north = b.maxZ - cz;
        const m = Math.min(left, right, south, north);
        if (m === left) cx = b.minX - radius;
        else if (m === right) cx = b.maxX + radius;
        else if (m === south) cz = b.minZ - radius;
        else cz = b.maxZ + radius;
      } else {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        cx += dx * push;
        cz += dz * push;
      }
    }
  }
  return { x: cx, z: cz, hit };
}

export function pointBlocked(x, z, radius, boxes) {
  const r2 = radius * radius;
  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i];
    const qx = clamp(x, b.minX, b.maxX);
    const qz = clamp(z, b.minZ, b.maxZ);
    const dx = x - qx;
    const dz = z - qz;
    if (dx * dx + dz * dz < r2) return true;
  }
  return false;
}

export function clampWorld(x, z, vehicle) {
  const minZ = vehicle ? 18 : MAP.minZ;
  let clamped = false;
  if (x < MAP.minX) {
    x = MAP.minX;
    clamped = true;
  } else if (x > MAP.maxX) {
    x = MAP.maxX;
    clamped = true;
  }
  if (z < minZ) {
    z = minZ;
    clamped = true;
  } else if (z > MAP.maxZ) {
    z = MAP.maxZ;
    clamped = true;
  }
  return { x, z, clamped };
}

export function addBox(list, x, z, w, d) {
  list.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}
