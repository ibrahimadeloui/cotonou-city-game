import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { ROAD_XS, ROAD_ZS } from './config.js';

const route = [];
const linePositions = new Float32Array(96);

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

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(linePositions, 3));
  geometry.setDrawRange(0, 0);
  const line = new Line(geometry, new LineBasicMaterial({ color: 0xffd45a }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  return {
    route,
    update(player, target) {
      if (!target) {
        arrow.visible = false;
        line.visible = false;
        route.length = 0;
        return;
      }
      gridRoute(player.pos.x, player.pos.z, target.x, target.z);
      arrow.visible = true;
      arrow.position.set(player.pos.x, 3.35, player.pos.z);
      arrow.lookAt(target.x, 3.35, target.z);
      let count = 0;
      const max = linePositions.length / 3;
      for (let i = 0; i < route.length && count < max; i += 1) {
        linePositions[count * 3] = route[i].x;
        linePositions[count * 3 + 1] = 0.18;
        linePositions[count * 3 + 2] = route[i].z;
        count += 1;
      }
      geometry.setDrawRange(0, count);
      geometry.attributes.position.needsUpdate = true;
      line.visible = count > 1;
    },
  };
}
