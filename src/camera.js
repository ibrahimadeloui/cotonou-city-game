import { Vector3 } from 'three';
import { damp, dampAngle, pointBlocked } from './utils.js';

const desired = new Vector3();
const look = new Vector3();

export function createCameraRig(camera) {
  const state = { yaw: Math.PI / 2, pitch: 0.42, dist: 8, drag: 0, snap: true };
  return {
    state,
    addLook(dx, dy) {
      if (dx === 0 && dy === 0) return;
      state.yaw += dx * 0.005;
      state.pitch = Math.max(0.18, Math.min(1.15, state.pitch + dy * 0.0032));
      state.drag = 0.9;
    },
    snap() {
      state.snap = true;
    },
    update(dt, target, faceYaw, moving, modeDist, collision) {
      state.drag -= dt;
      if (state.drag <= 0 && moving) state.yaw = dampAngle(state.yaw, faceYaw, 2.6, dt);
      state.dist = damp(state.dist, modeDist, 3, dt);
      const dist = state.dist;
      const cp = Math.cos(state.pitch);
      desired.set(
        target.x - Math.sin(state.yaw) * cp * dist,
        target.y + 1.2 + Math.sin(state.pitch) * dist * 0.72,
        target.z - Math.cos(state.yaw) * cp * dist,
      );
      pullCamera(target, desired, collision);
      look.set(
        target.x + Math.sin(state.yaw) * 1.1,
        target.y + 1.25,
        target.z + Math.cos(state.yaw) * 1.1,
      );
      if (state.snap) {
        camera.position.copy(desired);
        state.snap = false;
      } else {
        camera.position.lerp(desired, 1 - Math.exp(-dt * 10));
      }
      camera.lookAt(look);
    },
  };
}

function pullCamera(target, dest, boxes) {
  const dx = dest.x - target.x;
  const dz = dest.z - target.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.2) return;
  const steps = 10;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = target.x + dx * t;
    const z = target.z + dz * t;
    if (pointBlocked(x, z, 0.35, boxes)) {
      const keep = Math.max(0.18, (i - 1) / steps);
      dest.x = target.x + dx * keep;
      dest.z = target.z + dz * keep;
      return;
    }
  }
}
