import assert from 'node:assert/strict';
import { chevronForward, gridRoute, pathHeading } from './gps.js';

const route = gridRoute(-160, 40, 20, 180);
assert.ok(route.length >= 3, 'le chemin a des points');
for (let i = 1; i < route.length; i += 1) {
  const a = route[i - 1];
  const b = route[i];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len < 0.5) continue;
  const yaw = pathHeading(a.x, a.z, b.x, b.z);
  const fwd = chevronForward(yaw);
  const dot = (fwd.x * (b.x - a.x) + fwd.z * (b.z - a.z)) / len;
  assert.ok(dot > 0.9, `chevron à l'envers sur le tronçon ${i} (${dot})`);
}
console.log('gps ok', route.length, 'points');
