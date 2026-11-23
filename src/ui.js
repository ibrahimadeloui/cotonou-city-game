import { Vector3 } from 'three';
import { PLACES, ROAD_XS, ROAD_ZS, districtAt } from './config.js';
import { formatFCFA, formatHour, formatMeters } from './utils.js';
import { missionBody, missionTitle } from './missions.js';

const point = new Vector3();
const cache = new Map();

function setText(id, text) {
  if (cache.get(id) === text) return;
  cache.set(id, text);
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function createUi() {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const arrow = document.getElementById('arrow');
  const flash = document.getElementById('flash');
  const wantedEl = document.getElementById('wanted');
  let flashUntil = 0;

  return {
    flash() {
      flash.classList.add('on');
      flashUntil = performance.now() + 280;
    },
    update(game, camera) {
      if (performance.now() > flashUntil) flash.classList.remove('on');
      setText('money', formatFCFA(game.money));
      setText('jobs', `Courses : ${game.missions.state.jobs}`);
      setText('clock', formatHour(game.hour));
      setText('district', districtAt(game.player.pos.x, game.player.pos.z));
      const mission = game.missions.state.active;
      setText('mission-kicker', missionTitle(mission));
      setText('mission-body', missionBody(mission));
      setText('mission-pay', mission ? `Gain ${formatFCFA(mission.pay)}` : 'Les clients paient en francs CFA');
      const target = game.missions.target();
      if (target) {
        const dist = Math.hypot(target.x - game.player.pos.x, target.z - game.player.pos.z);
        setText('mission-dist', formatMeters(dist));
      } else {
        setText('mission-dist', '');
      }
      const stars = `${'★'.repeat(game.wanted)}${'☆'.repeat(5 - game.wanted)}`;
      setText('stars', stars);
      wantedEl.classList.toggle('on', game.wanted > 0);

      const vehicle = game.player.vehicle;
      if (vehicle) {
        setText('speed', `${Math.round(Math.abs(vehicle.speed) * 3.6)} km/h`);
        setText('prompt', 'E  —  Descendre');
      } else {
        setText('speed', '');
        if (game.nearVehicle) {
          const label = game.nearVehicle.type === 'zem' ? 'le zemidjan' : game.nearVehicle.type === 'suv' ? 'le SUV' : 'la voiture';
          setText('prompt', `E  —  Monter dans ${label}`);
        } else {
          setText('prompt', '');
        }
      }
      setText('toast', game.toast && performance.now() < game.toastUntil ? game.toast : '');
      setText('radio', vehicle ? game.radio : '');
      document.getElementById('btn-run').textContent = vehicle ? 'Frein' : 'Courir';
      document.getElementById('btn-vehicle').textContent = vehicle ? 'Sortir' : 'Monter';
      drawMap(ctx, canvas.width, canvas.height, game);
      drawArrow(arrow, camera, target, mission);
    },
  };
}

function drawArrow(arrow, camera, target, mission) {
  if (!target) {
    arrow.style.display = 'none';
    return;
  }
  point.set(target.x, 2.2, target.z);
  point.project(camera);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const behind = point.z > 1;
  let x = (point.x * 0.5 + 0.5) * w;
  let y = (-point.y * 0.5 + 0.5) * h;
  if (behind) {
    x = w - x;
    y = h - y;
  }
  const margin = 54;
  const inside = !behind && x > margin && x < w - margin && y > margin && y < h - margin;
  if (inside) {
    arrow.style.display = 'none';
    return;
  }
  const cx = w / 2;
  const cy = h / 2;
  let dx = x - cx;
  let dy = y - cy;
  if (behind) {
    dx = -dx;
    dy = -dy;
  }
  const ang = Math.atan2(dy, dx);
  const rx = w / 2 - margin;
  const ry = h / 2 - margin;
  const tx = Math.abs(dx) > 0.001 ? rx / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 0.001 ? ry / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  arrow.style.display = 'block';
  arrow.style.left = `${cx + dx * t}px`;
  arrow.style.top = `${cy + dy * t}px`;
  arrow.style.transform = `translate(-50%, -50%) rotate(${ang}rad)`;
  arrow.className = mission && mission.phase === 'drop' ? 'drop' : 'pick';
}

function drawMap(ctx, w, h, game) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#184e66';
  ctx.fillRect(0, 0, w, h);
  const land = [
    world(-250, 10, w, h),
    world(250, 10, w, h),
    world(250, 360, w, h),
    world(-250, 360, w, h),
  ];
  ctx.beginPath();
  ctx.moveTo(land[0].x, land[0].y);
  for (let i = 1; i < land.length; i += 1) ctx.lineTo(land[i].x, land[i].y);
  ctx.closePath();
  ctx.fillStyle = '#e7d3a4';
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3c4450';
  ctx.lineCap = 'round';
  for (const z of ROAD_ZS) {
    const a = world(ROAD_XS[0], z, w, h);
    const b = world(ROAD_XS[ROAD_XS.length - 1], z, w, h);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#d7b15a';
  ctx.lineWidth = 3;
  const coastA = world(ROAD_XS[0], ROAD_ZS[0], w, h);
  const coastB = world(ROAD_XS[ROAD_XS.length - 1], ROAD_ZS[0], w, h);
  ctx.beginPath();
  ctx.moveTo(coastA.x, coastA.y);
  ctx.lineTo(coastB.x, coastB.y);
  ctx.stroke();
  ctx.strokeStyle = '#3c4450';
  ctx.lineWidth = 2;
  for (const x of ROAD_XS) {
    const a = world(x, ROAD_ZS[0], w, h);
    const b = world(x, ROAD_ZS[ROAD_ZS.length - 1], w, h);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (const place of PLACES) {
    const p = world(place.x, place.z, w, h);
    ctx.fillStyle = 'rgba(20, 30, 40, 0.35)';
    ctx.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
  }

  for (const vehicle of game.vehicles) {
    if (!vehicle.police || vehicle.dead) continue;
    const p = world(vehicle.pos.x, vehicle.pos.z, w, h);
    ctx.fillStyle = '#2f6fed';
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }

  const mission = game.missions.state.active;
  if (mission) {
    const pointA = mission.phase === 'pickup' ? mission.a : mission.b;
    const p = world(pointA.x, pointA.z, w, h);
    ctx.fillStyle = mission.phase === 'pickup' ? '#f0c14a' : '#3dd68c';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const player = world(game.player.pos.x, game.player.pos.z, w, h);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(game.player.yaw);
  ctx.fillStyle = '#fffaf2';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '10px sans-serif';
  ctx.fillText('N', w / 2 - 3, 12);
}

function world(x, z, w, h) {
  const minX = -250;
  const maxX = 250;
  const minZ = -40;
  const maxZ = 360;
  const nx = (x - minX) / (maxX - minX);
  const nz = (z - minZ) / (maxZ - minZ);
  return { x: nx * w, y: h - nz * h };
}
