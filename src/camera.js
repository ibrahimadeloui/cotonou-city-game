import { Vector3 } from 'three';
import { damp, dampAngle, pointBlocked } from './utils.js';

const desired = new Vector3();
const look = new Vector3();

export function createCameraRig(camera) {
  const state = { yaw: Math.PI / 2, pitch: 0.42, dist: 8, drag: 0, snap: true, camExtra: 0 };
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
    cycleCam() {
      state.camExtra = state.camExtra === 0 ? -2.2 : state.camExtra < 0 ? 3.4 : 0;
    },
    update(dt, target, faceYaw, moving, modeDist, collision, selfie, recenter) {
      state.drag -= dt;
      if (selfie && !state.wasSelfie) state.savedPitch = state.pitch;
      if (!selfie && state.wasSelfie && state.savedPitch != null) state.pitch = state.savedPitch;
      state.wasSelfie = selfie;
      if (selfie) {
        state.yaw = dampAngle(state.yaw, faceYaw + Math.PI, 14, dt);
        state.pitch = damp(state.pitch, 0.16, 12, dt);
      } else if (state.drag <= 0 && moving) {
        state.yaw = dampAngle(state.yaw, faceYaw, recenter || 2.5, dt);
      }
      state.dist = Math.max(4.2, (selfie ? 2.35 : modeDist) + (state.camExtra || 0));
      const dist = state.dist;
      const cp = Math.cos(state.pitch);
      const lookHeight = selfie ? 1.5 : 1.25;
      desired.set(
        target.x - Math.sin(state.yaw) * cp * dist,
        target.y + (selfie ? 1.15 : 1.2) + Math.sin(state.pitch) * dist * 0.72,
        target.z - Math.cos(state.yaw) * cp * dist,
      );
      pullCamera(target, desired, collision);
      look.set(
        target.x + Math.sin(state.yaw) * (selfie ? 0.15 : 1.1),
        target.y + lookHeight,
        target.z + Math.cos(state.yaw) * (selfie ? 0.15 : 1.1),
      );
      if (state.snap) {
        camera.position.copy(desired);
        state.snap = false;
      } else {
        const follow = 1 - Math.exp(-14 * dt);
        camera.position.lerp(desired, follow);
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
