import {
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  ShaderMaterial,
  SphereGeometry,
  Mesh,
  Vector3,
} from 'three';
import { lerp } from './utils.js';

const KEYS = [
  key(0, '#243e6e', '#4d6ea3', '#2c446c', '#d5e4ff', '#9eb4d8', '#6d5b48', 0.62, 0.95, [0.2, 0.86, 0.2], 1, 0.75),
  key(5.5, '#4e86c4', '#ffd0a4', '#ffe0c0', '#ffe6c4', '#f2c8a4', '#8a6848', 1.15, 0.95, [0.55, 0.62, -0.18], 0.4, 0.2),
  key(7.5, '#6ec4f4', '#fff3d8', '#ffe8c4', '#fff6e0', '#fff1d6', '#c4a574', 2.05, 1.12, [0.7, 0.58, -0.18], 0.04, 0),
  key(10, '#8ad4ff', '#fffaf0', '#fff3dc', '#fffdf6', '#fff6e8', '#d8bc90', 2.45, 1.22, [0.28, 0.9, -0.16], 0, 0),
  key(13, '#7ecbff', '#fffef8', '#fff8ea', '#ffffff', '#fffaf2', '#e0c8a0', 2.55, 1.25, [0.02, 0.99, -0.1], 0, 0),
  key(16.4, '#ff8ec8', '#ff7a4a', '#ffd0a8', '#ffe0b0', '#ffc0d0', '#c48a6a', 2.05, 1.05, [-0.28, 0.62, -0.22], 0.08, 0.08),
  key(17.6, '#d24ad8', '#ff5c6a', '#7a3c9a', '#ffb0c8', '#e090c0', '#a07068', 1.65, 0.98, [-0.55, 0.38, -0.32], 0.25, 0.3),
  key(18.7, '#7a3cb8', '#ff4f88', '#4a2078', '#ffc0d8', '#c070b0', '#806058', 1.25, 0.92, [-0.72, 0.22, -0.4], 0.55, 0.55),
  key(19.8, '#3a2d78', '#ff6a8a', '#2a2458', '#ffd0c0', '#a080c0', '#6a5048', 0.85, 0.95, [-0.4, 0.18, -0.3], 0.9, 0.75),
  key(22, '#243e6e', '#4d6ea3', '#2c446c', '#d5e4ff', '#9eb4d8', '#6d5b48', 0.62, 0.95, [-0.08, 0.82, 0.18], 1, 0.75),
  key(24, '#243e6e', '#4d6ea3', '#2c446c', '#d5e4ff', '#9eb4d8', '#6d5b48', 0.62, 0.95, [0.2, 0.86, 0.2], 1, 0.75),
];

function key(h, top, hor, bot, light, amb, ground, sunI, ambI, sun, lamp, win) {
  return {
    h,
    top: new Color(top),
    hor: new Color(hor),
    bot: new Color(bot),
    light: new Color(light),
    amb: new Color(amb),
    ground: new Color(ground),
    sunI,
    ambI,
    sun: sun.slice(),
    lamp,
    win,
  };
}

const skyVertex = `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = `
  varying vec3 vDir;
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 bottomColor;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 col = mix(bottomColor, horizonColor, smoothstep(-0.22, 0.08, h));
    col = mix(col, topColor, smoothstep(0.0, 0.55, h));
    float sunDot = max(dot(dir, normalize(sunDir)), 0.0);
    col += sunColor * pow(sunDot, 90.0) * 1.6;
    col += sunColor * pow(sunDot, 7.0) * 0.38;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const tmp = new Vector3();
const sunTmp = new Vector3();
const lightDir = new Vector3();

function sample(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && h > KEYS[i + 1].h) i += 1;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h)));
  const s = t * t * (3 - 2 * t);
  return { a, b, s };
}

function mixColor(out, a, b, t) {
  out.copy(a).lerp(b, t);
  return out;
}

export function createLighting(scene, refs, quality) {
  const hemi = new HemisphereLight(0xfff4e4, 0xc4a574, 1.15);
  scene.add(hemi);

  const sun = new DirectionalLight(0xfff2d4, 2.3);
  sun.position.set(-40, 30, -20);
  sun.castShadow = quality.shadows;
  sun.shadow.mapSize.set(quality.tier === 'haute' ? 1024 : 512, quality.tier === 'haute' ? 1024 : 512);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 180;
  const span = 58;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.08;
  sun.shadow.radius = quality.tier === 'haute' ? 2.5 : 1;
  scene.add(sun);
  scene.add(sun.target);

  const fog = new Fog(0xfff3dc, 170, 680);
  scene.fog = fog;

  const skyMat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new Color() },
      horizonColor: { value: new Color() },
      bottomColor: { value: new Color() },
      sunColor: { value: new Color() },
      sunDir: { value: new Vector3(0, 0.3, -1) },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
  });
  const sky = new Mesh(new SphereGeometry(900, 20, 14), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -2;
  scene.add(sky);

  refs.hemi = hemi;
  refs.sun = sun;
  refs.fog = fog;
  refs.sky = sky;
  refs.nightHead = 0;

  const top = new Color();
  const hor = new Color();
  const bot = new Color();
  const light = new Color();
  const amb = new Color();
  const ground = new Color();

  return {
    update(dt, hour, focus, camera) {
      const visualHour = refs.grade === 'sunset' ? 18.1 : hour;
      const { a, b, s } = sample(visualHour);
      mixColor(top, a.top, b.top, s);
      mixColor(hor, a.hor, b.hor, s);
      mixColor(bot, a.bot, b.bot, s);
      mixColor(light, a.light, b.light, s);
      mixColor(amb, a.amb, b.amb, s);
      mixColor(ground, a.ground, b.ground, s);
      sunTmp.set(
        lerp(a.sun[0], b.sun[0], s),
        lerp(a.sun[1], b.sun[1], s),
        lerp(a.sun[2], b.sun[2], s),
      ).normalize();

      skyMat.uniforms.topColor.value.copy(top);
      skyMat.uniforms.horizonColor.value.copy(hor);
      skyMat.uniforms.bottomColor.value.copy(bot);
      skyMat.uniforms.sunColor.value.copy(light);
      skyMat.uniforms.sunDir.value.copy(sunTmp);
      sky.position.copy(camera.position);

      const sunI = a.sunI + (b.sunI - a.sunI) * s;
      const ambI = a.ambI + (b.ambI - a.ambI) * s;
      const lamp = a.lamp + (b.lamp - a.lamp) * s;
      const win = a.win + (b.win - a.win) * s;

      if (sunTmp.y > 0.12) lightDir.copy(sunTmp);
      else lightDir.set(-sunTmp.x, 0.75, -sunTmp.z).normalize();

      tmp.copy(focus);
      sun.position.copy(tmp).addScaledVector(lightDir, 70);
      sun.target.position.copy(tmp);
      sun.color.copy(light);
      const gain = (refs.brightness ?? 1.25) / 1.25;
      sun.intensity = sunI * gain;
      hemi.color.copy(amb);
      hemi.groundColor.copy(ground);
      hemi.intensity = ambI * gain;
      fog.color.copy(hor);
      scene.background = hor;

      if (refs.windowMat) refs.windowMat.emissiveIntensity = win;
      if (refs.lampMat) refs.lampMat.emissiveIntensity = lamp;
      if (refs.cloudMat) {
        refs.cloudMat.color.copy(hor).lerp(new Color('#ffffff'), 0.55);
        refs.cloudMat.opacity = 0.28 + (1 - lamp) * 0.4;
      }
      refs.nightHead = Math.max(lamp, win * 0.85);

      if (refs.ocean) {
        refs.ocean.time.value += dt;
        refs.ocean.deepColor.value.set('#0c3a52').lerp(bot, 0.25);
        refs.ocean.shoreColor.value.copy(hor).lerp(new Color('#1f8ea0'), 0.45);
        refs.ocean.sunColor.value.copy(light);
        if (refs.ocean.skyColor) refs.ocean.skyColor.value.copy(top).lerp(hor, 0.35);
        if (refs.ocean.sunDir) refs.ocean.sunDir.value.copy(sunTmp);
        refs.ocean.fogColor.value.copy(hor);
        refs.ocean.fogNear.value = fog.near;
        refs.ocean.fogFar.value = fog.far;
      }
    },
  };
}
