import assert from 'node:assert/strict';
import { cameraPlanarBasis } from './camera-basis.js';
import { turnToward } from './utils.js';

function crossForwardUp(basis) {
  return { x: -basis.forwardZ, z: basis.forwardX };
}

const spawn = cameraPlanarBasis(Math.PI / 2);
assert.ok(spawn.forwardX > 0.9 && Math.abs(spawn.forwardZ) < 1e-9, 'spawn looks +X');
assert.ok(Math.abs(spawn.rightX) < 1e-9 && spawn.rightZ > 0.9, 'spawn screen-right is +Z');

const north = cameraPlanarBasis(0);
assert.ok(Math.abs(north.forwardX) < 1e-9 && north.forwardZ > 0.9, 'yaw 0 looks +Z');
assert.ok(north.rightX < -0.9 && Math.abs(north.rightZ) < 1e-9, 'yaw 0 screen-right is -X');

for (const yaw of [0, 0.4, Math.PI / 2, 2.2, -1.1]) {
  const basis = cameraPlanarBasis(yaw);
  const right = crossForwardUp(basis);
  assert.ok(Math.abs(basis.rightX - right.x) < 1e-9 && Math.abs(basis.rightZ - right.z) < 1e-9);
  const leftX = basis.forwardZ;
  const leftZ = -basis.forwardX;
  assert.ok(Math.hypot(basis.rightX - leftX, basis.rightZ - leftZ) > 1.5);
  const mx = basis.forwardX * 0 + basis.rightX * 1;
  const mz = basis.forwardZ * 0 + basis.rightZ * 1;
  assert.equal(mx, basis.rightX);
  assert.equal(mz, basis.rightZ);
}

function steerToward(vehicleYaw, wishX, wishZ) {
  let desired = Math.atan2(wishX, wishZ);
  let diff = Math.atan2(Math.sin(desired - vehicleYaw), Math.cos(desired - vehicleYaw));
  if (Math.abs(diff) > Math.PI * 0.55) {
    desired += Math.PI;
    diff = Math.atan2(Math.sin(desired - vehicleYaw), Math.cos(desired - vehicleYaw));
  }
  return Math.max(-1, Math.min(1, diff / 0.65));
}

const facing = Math.PI / 2;
const basis = cameraPlanarBasis(facing);
assert.ok(steerToward(facing, basis.rightX, basis.rightZ) < 0, 'stick right steers toward screen-right');
assert.ok(steerToward(facing, -basis.rightX, -basis.rightZ) > 0, 'stick left steers toward screen-left');
assert.ok(Math.abs(steerToward(facing, basis.forwardX, basis.forwardZ)) < 0.05, 'stick up does not steer');

let yaw = 0;
let peak = 0;
let first = 0;
for (let i = 0; i < 30; i += 1) {
  const next = turnToward(yaw, Math.PI - 0.01, 8.5, 1 / 60);
  const step = Math.abs(Math.atan2(Math.sin(next - yaw), Math.cos(next - yaw)));
  if (i === 0) first = step;
  peak = Math.max(peak, step);
  yaw = next;
}
assert.ok(peak <= 8.5 / 60 + 1e-6, 'la rotation dépasse le plafond');
assert.ok(first < 0.2, 'un demi-tour se fait en une frame');
assert.ok(yaw > 2, 'la rotation n’avance pas');

console.log('camera basis ok');
