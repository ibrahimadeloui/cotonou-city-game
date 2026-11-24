import {
  AnimationMixer,
  BufferAttribute,
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector2,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { PARKED, PLACES } from './config.js';

const SCALE = 0.355;
const FEET = 0.12;

const SKIN_TONES = [0x8d5524, 0x6b3a22, 0x4a2918, 0x7a4a30, 0xc68642, 0x5c3317, 0x3d2418];
const WAX = [0xc0392b, 0xf0b429, 0x0e8f62, 0x1f6feb, 0xf47bb5, 0xe8d5a3];
const TEES = [0xf4f4f4, 0x1f6feb, 0xf2c14e, 0xe23d3d, 0x123c8a];
const PANTS = [0x2a241c, 0x243044, 0x3d3428, 0x1d3b2a];

let waxMap;

function makeWax() {
  if (waxMap) return waxMap;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f0b429';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#b11f2a';
  ctx.strokeStyle = '#1a100c';
  ctx.lineWidth = 3;
  const shapes = [
    [[4, 8], [48, 0], [62, 46], [28, 78], [0, 52]],
    [[70, 6], [128, 18], [120, 70], [78, 58]],
    [[0, 88], [36, 74], [54, 128], [0, 128]],
    [[64, 78], [112, 70], [128, 120], [72, 128]],
  ];
  for (const pts of shapes) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  waxMap = new CanvasTexture(canvas);
  waxMap.wrapS = RepeatWrapping;
  waxMap.wrapT = RepeatWrapping;
  waxMap.colorSpace = SRGBColorSpace;
  return waxMap;
}

function tagRegions(gltf) {
  const mesh = gltf.scene.getObjectByProperty('isSkinnedMesh', true);
  const geo = mesh.geometry;
  if (geo.getAttribute('region')) return;
  const index = geo.attributes.skinIndex;
  const weight = geo.attributes.skinWeight;
  const names = mesh.skeleton.bones.map((bone) => bone.name);
  const region = new Float32Array(geo.attributes.position.count);
  for (let i = 0; i < region.length; i += 1) {
    let best = 0;
    let bestW = -1;
    for (let k = 0; k < 4; k += 1) {
      const w = weight.getComponent(i, k);
      if (w > bestW) {
        bestW = w;
        best = Math.round(index.getComponent(i, k));
      }
    }
    const name = names[best] || '';
    if (/Head|Neck/.test(name)) region[i] = 2;
    else if (/Foot|Toe/.test(name)) region[i] = -1;
    else if (/Spine|Arm|Hand|Shoulder/.test(name)) region[i] = 1;
    else region[i] = 0;
  }
  geo.setAttribute('region', new BufferAttribute(region, 1));
}

function applyHumanShader(material, { faceMap, player }) {
  material.skinning = true;
  material.map = makeWax();
  const headInv = new Matrix4();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.headInv = { value: headInv };
    shader.uniforms.faceMap = { value: faceMap || makeWax() };
    shader.uniforms.useFace = { value: player ? 1 : 0 };
    shader.uniforms.outfit = { value: 0 };
    shader.uniforms.skinTone = { value: new Color(0x7c4e36) };
    shader.uniforms.hairTone = { value: new Color(0x1a120c) };
    shader.uniforms.shirtA = { value: new Color(0xf0b429) };
    shader.uniforms.shirtB = { value: new Color(0x2a3140) };
    shader.uniforms.pantsA = { value: new Color(0x241c16) };
    shader.uniforms.pantsB = { value: new Color(0x3d3428) };
    shader.uniforms.shoeA = { value: new Color(0x1a1a1a) };
    shader.uniforms.shoeB = { value: new Color(0xe6e6ea) };
    shader.uniforms.robe = { value: 0 };
    shader.uniforms.faceScale = { value: new Vector2(78, 64) };
    shader.uniforms.faceShift = { value: new Vector2(0.46, 0.22) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float region;
varying float vRegion;
varying vec3 vHeadPos;
varying vec3 vHeadNrm;
varying vec3 vLocal;
uniform mat4 headInv;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
vec4 hw = modelMatrix * vec4(transformed, 1.0);
vHeadPos = (headInv * hw).xyz;
vHeadNrm = normalize(mat3(headInv) * mat3(modelMatrix) * transformedNormal);
vLocal = transformed;
vRegion = region;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vRegion;
varying vec3 vHeadPos;
varying vec3 vHeadNrm;
varying vec3 vLocal;
uniform sampler2D faceMap;
uniform float useFace;
uniform float outfit;
uniform vec3 skinTone;
uniform vec3 hairTone;
uniform vec3 shirtA;
uniform vec3 shirtB;
uniform vec3 pantsA;
uniform vec3 pantsB;
uniform vec3 shoeA;
uniform vec3 shoeB;
uniform float robe;
uniform vec2 faceScale;
uniform vec2 faceShift;
vec3 gLift;`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
gl_FragColor.rgb += gLift;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  gLift = vec3(0.0);
  vec3 col = skinTone;
  if (vRegion > 1.5) {
    vec2 uv = vec2(vHeadPos.x * faceScale.x + faceShift.x, vHeadPos.y * faceScale.y + faceShift.y);
    float oval = 1.0 - smoothstep(0.36, 0.55, length((uv - vec2(0.5, 0.48)) * vec2(1.02, 0.92)));
    float front = smoothstep(0.0, 0.45, vHeadNrm.z);
    float hair = smoothstep(0.62, 0.95, vHeadNrm.y);
    col = mix(skinTone, hairTone, hair);
    vec3 faceCol = texture2D(faceMap, clamp(uv, 0.001, 0.999)).rgb;
    float mask = oval * front * useFace * (1.0 - hair);
    col = mix(col, faceCol, mask);
    gLift = faceCol * mask * 0.16;
  } else if (vRegion > 0.5) {
    vec2 cell = floor(vLocal.xy * 95.0);
    float n = fract(sin(dot(cell, vec2(27.1, 91.7))) * 43758.5453);
    vec2 f = fract(vLocal.xy * 95.0);
    float edge = smoothstep(0.0, 0.12, min(f.x, f.y));
    vec3 printA = outfit < 0.5 ? vec3(0.78, 0.12, 0.1) : shirtB;
    vec3 printB = outfit < 0.5 ? vec3(0.95, 0.72, 0.16) : shirtB;
    col = mix(vec3(0.09, 0.05, 0.04), mix(printA, printB, step(0.48, n)), edge);
    float torso = 1.0 - smoothstep(0.01, 0.018, abs(vLocal.x));
    float tee = smoothstep(0.03, 0.038, vLocal.y) * (1.0 - smoothstep(0.048, 0.056, vLocal.y));
    if (outfit > 0.5) col = mix(shirtB, vec3(0.95), tee * torso);
  } else if (vRegion < -0.5) {
    col = outfit < 0.5 ? shoeA : shoeB;
  } else {
    col = robe > 0.5 ? shirtA : (outfit < 0.5 ? pantsA : pantsB);
  }
  diffuseColor.rgb = col;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
if (vRegion > 1.5) roughnessFactor = mix(0.42, 0.58, 1.0 - clamp(vHeadNrm.z, 0.0, 1.0));
else if (vRegion > 0.5) roughnessFactor = 0.74;
else roughnessFactor = 0.86;
`);
    shader.uniforms.outfit.value = material.userData.outfit || 0;
    shader.uniforms.robe.value = material.userData.robe || 0;
    const colors = material.userData.colors;
    if (colors) {
      shader.uniforms.skinTone.value.setHex(colors.skin);
      shader.uniforms.shirtA.value.setHex(colors.shirt);
      shader.uniforms.shirtB.value.setHex(colors.shirt);
      shader.uniforms.pantsA.value.setHex(colors.pants);
      shader.uniforms.pantsB.value.setHex(colors.pants);
      shader.uniforms.useFace.value = 0;
      shader.uniforms.robe.value = colors.robe ? 1 : 0;
    }
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => (player ? 'ibrahim' : 'crowd');
  return { headInv, material };
}

function clipBy(gltf, suffix) {
  return gltf.animations.find((clip) => clip.name.endsWith(suffix));
}

function loader() {
  const next = new GLTFLoader();
  next.setMeshoptDecoder(MeshoptDecoder);
  return next;
}

export function loadHumanGltf(url) {
  return new Promise((resolve, reject) => {
    loader().load(url, (gltf) => resolve(gltf), undefined, reject);
  });
}

const CAST = ['npc_zem', 'npc_vendor', 'npc_police', 'npc_student', 'npc_business', 'npc_elder'];

async function exists(url) {
  try {
    const response = await fetch(url);
    const type = response.headers.get('content-type') || '';
    return response.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

function modelBase() {
  const base = import.meta.env.BASE_URL || './';
  return `${base}models/characters/`;
}

export async function loadCast(quality) {
  if (MeshoptDecoder.ready) await MeshoptDecoder.ready;
  const base = modelBase();
  const phone = quality.tier !== 'haute';
  const dropInUrl = `${import.meta.env.BASE_URL || './'}models/ibrahim.glb`;
  const dropIn = await exists(dropInUrl);
  const playerUrl = dropIn
    ? dropInUrl
    : `${base}${phone ? 'ibrahim_1k.glb' : 'ibrahim.glb'}`;
  try {
    const player = await loadHumanGltf(playerUrl);
    player.userData.sourceUrl = playerUrl;
    const playerLod = await loadHumanGltf(`${base}lod/ibrahim_lod.glb`);
    const types = [];
    for (const id of CAST) {
      if (quality.tier === 'basse') {
        const full = await loadHumanGltf(`${base}lod/${id}_lod.glb`);
        full.userData.sourceUrl = `${base}lod/${id}_lod.glb`;
        types.push({ id, full, lod: null });
      } else {
        const full = await loadHumanGltf(`${base}${id}.glb`);
        const lod = await loadHumanGltf(`${base}lod/${id}_lod.glb`);
        full.userData.sourceUrl = `${base}${id}.glb`;
        types.push({ id, full, lod });
      }
    }
    return { player, playerLod, types, playerUrl };
  } catch (error) {
    const loaderEl = document.getElementById('loader');
    if (loaderEl) {
      loaderEl.classList.remove('hidden');
      loaderEl.textContent = `Personnage réaliste introuvable (${playerUrl}). ${error?.message || error}`;
    }
    console.error(error);
    throw error;
  }
}

function bindAnimations(root, model, gltf) {
  const mixer = new AnimationMixer(model);
  const actions = {};
  for (const name of ['Idle', 'Walk', 'Run', 'Jump', 'Death', 'Working', 'Punch']) {
    const clip = clipBy(gltf, name);
    if (!clip) continue;
    const action = mixer.clipAction(clip, model);
    if (name === 'Jump' || name === 'Death' || name === 'Punch') {
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(LoopRepeat, Infinity);
    }
    actions[name] = action;
  }
  if (actions.Punch) {
    const kick = mixer.clipAction(clipBy(gltf, 'Punch').clone(), model);
    kick.setLoop(LoopOnce, 1);
    kick.clampWhenFinished = true;
    kick.timeScale = 1.28;
    actions.Kick = kick;
  }
  if (!actions.Idle) throw new Error('Animation Idle absente du modèle');
  actions.Idle.play();
  root.userData.mixer = mixer;
  root.userData.actions = actions;
  root.userData.current = 'Idle';
  root.userData.tickAnim = (mode, dt) => {
    const map = {
      idle: 'Idle', walk: 'Walk', run: 'Run', jump: 'Jump', sit: 'Idle',
      death: 'Death', vendor: 'Working', punch: 'Punch', kick: 'Kick',
    };
    const nextName = map[mode] || 'Idle';
    const next = actions[nextName] || actions.Idle;
    if (root.userData.current !== nextName) {
      next.reset().fadeIn(0.22).play();
      const prev = actions[root.userData.current];
      if (prev && prev !== next) prev.fadeOut(0.22);
      root.userData.current = nextName;
    }
    const pace = root.userData.animScale || 1;
    if (nextName === 'Walk') next.timeScale = Math.max(0.8, Math.min(1.45, pace));
    if (nextName === 'Run') next.timeScale = Math.max(0.85, Math.min(1.35, pace));
    mixer.update(dt);
    if (mode === 'sit') {
      const left = model.getObjectByName('LeftUpLeg');
      const right = model.getObjectByName('RightUpLeg');
      if (left) left.rotation.x -= 1.05;
      if (right) right.rotation.x -= 1.05;
    }
    const head = model.getObjectByName('Head');
    const shader = root.userData.material?.userData.shader;
    if (head && shader) {
      head.updateWorldMatrix(true, false);
      shader.uniforms.headInv.value.copy(head.matrixWorld).invert();
    }
  };
}

export function createRiggedCharacter(gltf, { shadows = false } = {}) {
  const model = cloneSkinned(gltf.scene);
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.frustumCulled = false;
    obj.castShadow = shadows;
    obj.receiveShadow = true;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material) continue;
      material.skinning = true;
      if (material.map) material.map.anisotropy = 4;
    }
  });
  const inner = new Group();
  inner.scale.setScalar(SCALE);
  inner.position.y = -FEET;
  inner.add(model);
  const root = new Group();
  root.add(inner);
  bindAnimations(root, model, gltf);
  root.userData.setOutfit = () => {};
  root.userData.sourceUrl = gltf.userData?.sourceUrl || '';
  const skinned = model.getObjectByProperty('isSkinnedMesh', true);
  root.userData.meshName = skinned?.name || '';
  return root;
}

export function createActor(full, lod, options = {}) {
  const near = createRiggedCharacter(full, options);
  const far = lod ? createRiggedCharacter(lod, { shadows: false }) : null;
  if (!far) return near;
  const root = new Group();
  root.add(near, far);
  far.visible = false;
  root.userData.tickAnim = (mode, dt) => {
    const pace = root.userData.animScale || 1;
    near.userData.animScale = pace;
    far.userData.animScale = pace;
    near.userData.tickAnim(mode, dt);
    far.userData.tickAnim(mode, dt);
  };
  root.userData.setOutfit = (wax) => near.userData.setOutfit?.(wax);
  root.userData.sourceUrl = full.userData?.sourceUrl || near.userData.sourceUrl || '';
  root.userData.meshName = near.userData.meshName || '';
  root.userData.updateDistance = (dist) => {
    const useFar = dist > 25;
    near.visible = !useFar;
    far.visible = useFar;
  };
  return root;
}

function spot(x, z, yaw, behavior) {
  return { x, z, yaw, behavior };
}

export function createCrowd(scene, paths, quality, rand, cast) {
  const count = quality.crowd;
  const peds = [];
  const anchors = [
    ...PLACES.map((place) => ({ x: place.x, z: place.z })),
    ...PARKED.filter((car) => car.type === 'zem').map((car) => ({ x: car.x + 1.4, z: car.z + 1.2 })),
  ];
  const specs = [];
  anchors.forEach((anchor, index) => {
    const group = index % 5 === 0 ? 3 : 2;
    for (let k = 0; k < group; k += 1) {
      const ang = (k / group) * Math.PI * 2 + rand();
      specs.push(spot(
        anchor.x + Math.cos(ang) * (0.7 + rand()),
        anchor.z + Math.sin(ang) * (0.7 + rand()),
        ang + Math.PI,
        index % 4 === 0 ? 'vendor' : 'idle',
      ));
    }
  });
  while (specs.length < count) {
    const path = paths[Math.floor(rand() * paths.length)];
    const t = rand();
    specs.push({
      x: path.a.x + (path.b.x - path.a.x) * t,
      z: path.a.z + (path.b.z - path.a.z) * t,
      yaw: Math.atan2(path.b.x - path.a.x, path.b.z - path.a.z),
      behavior: 'walk',
      path,
      t,
    });
  }
  for (let i = 0; i < count; i += 1) {
    const spec = specs[i];
    const wax = rand() > 0.42;
    const robe = rand() < 0.3;
    const shirt = robe || wax ? WAX[Math.floor(rand() * WAX.length)] : TEES[Math.floor(rand() * TEES.length)];
    const colors = {
      skin: SKIN_TONES[Math.floor(rand() * SKIN_TONES.length)],
      shirt,
      pants: robe ? shirt : PANTS[Math.floor(rand() * PANTS.length)],
      robe,
    };
    const type = cast.types[i % cast.types.length];
    const mesh = createActor(type.full, type.lod, { shadows: false });
    mesh.scale.setScalar(0.94 + rand() * 0.12);
    mesh.position.set(spec.x, 0, spec.z);
    mesh.rotation.y = spec.yaw;
    scene.add(mesh);
    const path = spec.path || paths[i % paths.length];
    const temper = rand() < 0.12 ? 'fight' : rand() < 0.38 ? 'flee' : 'calm';
    const hp = temper === 'fight' ? 46 : 28;
    peds.push({
      mesh,
      path,
      t: spec.t ?? rand(),
      dir: rand() < 0.5 ? 1 : -1,
      speed: spec.behavior === 'walk' ? 0.9 + rand() * 0.6 : 0,
      phase: rand() * 6,
      down: false,
      timer: 0,
      yaw: spec.yaw,
      pos: { x: spec.x, z: spec.z },
      behavior: spec.behavior,
      slot: i,
      temper,
      hp,
      hpMax: hp,
      cool: 0,
      stun: 0,
      name: '',
    });
  }

  const impostorGeo = new SphereGeometry(0.28, 6, 5);
  impostorGeo.translate(0, 0.9, 0);
  const impostor = new InstancedMesh(
    impostorGeo,
    new MeshLambertMaterial({ color: 0xffffff }),
    quality.impostors,
  );
  impostor.instanceMatrix.setUsage(35048);
  impostor.frustumCulled = false;
  const dummy = new Matrix4();
  const color = new Color();
  const spots = [];
  for (let i = 0; i < quality.impostors; i += 1) {
    const path = paths[Math.floor(rand() * paths.length)];
    const t = rand();
    const x = path.a.x + (path.b.x - path.a.x) * t + (rand() - 0.5) * 1.5;
    const z = path.a.z + (path.b.z - path.a.z) * t + (rand() - 0.5) * 1.5;
    spots.push({ x, z, h: 0.85 + rand() * 0.25 });
    dummy.makeScale(spots[i].h, spots[i].h, spots[i].h);
    dummy.setPosition(x, 0, z);
    impostor.setMatrixAt(i, dummy);
    color.setHex(SKIN_TONES[i % SKIN_TONES.length]);
    impostor.setColorAt(i, color);
  }
  impostor.instanceMatrix.needsUpdate = true;
  if (impostor.instanceColor) impostor.instanceColor.needsUpdate = true;
  scene.add(impostor);

  return {
    peds,
    updateLod(camera, frame) {
      const hide = 70;
      for (const ped of peds) {
        const dist = Math.hypot(ped.pos.x - camera.position.x, ped.pos.z - camera.position.z);
        ped.mesh.userData.updateDistance?.(dist);
      }
      for (let i = 0; i < spots.length; i += 1) {
        const d = Math.hypot(spots[i].x - camera.position.x, spots[i].z - camera.position.z);
        const show = d > hide && d < (camera.far || 400);
        const s = show ? spots[i].h : 0.0001;
        dummy.makeScale(s, s, s);
        dummy.setPosition(spots[i].x, 0, spots[i].z);
        impostor.setMatrixAt(i, dummy);
      }
      if (frame % 6 === 0) impostor.instanceMatrix.needsUpdate = true;
    },
  };
}
