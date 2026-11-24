import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import {
  BLVD_Z,
  PARKED,
  PLACES,
  ROAD_W,
  ROAD_XS,
  ROAD_ZS,
  SPAWN,
  cellBounds,
  halfZ,
} from './config.js';
import { addBox, coloredBox, mergeColored, mulberry32, paint } from './utils.js';

const UP = new Vector3(0, 1, 0);

const oceanVertex = `
  uniform float time;
  varying float vZ;
  varying float vDist;
  varying float vWave;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec3 p = position;
    float wx = cos(p.x * 0.045 + time * 1.2);
    float wz = sin(p.z * 0.035 + time * 0.8);
    float w = sin(p.x * 0.045 + time * 1.2) * cos(p.z * 0.035 + time * 0.8);
    p.y += w * 0.55;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vec4 viewPos = viewMatrix * world;
    vZ = world.z;
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * vec3(-wx * 0.14, 1.0, -wz * 0.12));
    vDist = length(viewPos.xyz);
    vWave = w;
    gl_Position = projectionMatrix * viewPos;
  }
`;

const oceanFragment = `
  varying float vZ;
  varying float vDist;
  varying float vWave;
  varying vec3 vWorld;
  varying vec3 vNormal;
  uniform vec3 deepColor;
  uniform vec3 shoreColor;
  uniform vec3 sunColor;
  uniform vec3 skyColor;
  uniform vec3 sunDir;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  void main() {
    float shore = smoothstep(-80.0, 16.0, vZ);
    vec3 col = mix(deepColor, shoreColor, shore);
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.0);
    col = mix(col, skyColor, 0.16 + fres * 0.62);
    vec3 halfDir = normalize(viewDir + normalize(sunDir));
    float spec = pow(max(dot(n, halfDir), 0.0), 96.0);
    col += sunColor * (0.05 + spec * 0.95 + max(vWave, 0.0) * 0.05);
    float fogFactor = smoothstep(fogNear, fogFar, vDist);
    col = mix(col, fogColor, clamp(fogFactor, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createCity(scene, refs, quality) {
  const rand = mulberry32(0xc07040);
  const geoms = [];
  const collision = [];
  const graph = buildGraph();
  const paths = buildPaths();

  const depth = 372;
  const ground = new PlaneGeometry(560, depth);
  ground.rotateX(-Math.PI / 2);
  ground.translate(0, 0, 8 + depth / 2);
  scaleUv(ground, 560 / 3.2, depth / 3.2);
  geoms.push(paint(ground, 0xe6d3a6));
  geoms.push(coloredBox(560, 0.025, 14, 0, 0.012, 15, 0xd2b48c));

  addRoads(geoms);
  addCrosswalks(geoms);

  const { map, emissiveMap } = makeFacadeTextures();
  refs.windowMat = new MeshStandardMaterial({
    map,
    roughness: 0.72,
    metalness: 0.04,
    envMapIntensity: 0.45,
    emissive: new Color('#ffc48a'),
    emissiveMap,
    emissiveIntensity: 0.12,
    side: DoubleSide,
  });
  refs.lampMat = new MeshLambertMaterial({
    color: 0xffe1a8,
    emissive: 0xffc56a,
    emissiveIntensity: 0.15,
  });

  const buckets = {
    house: [],
    house2: [],
    shop: [],
    block: [],
    tower: [],
  };
  const palmSpots = [];

  for (let ix = 0; ix < ROAD_XS.length - 1; ix += 1) {
    for (let iz = 0; iz < ROAD_ZS.length - 1; iz += 1) {
      const id = `${ix},${iz}`;
      if (id === '3,1' || id === '4,1') continue;
      if (id === '4,2' || id === '1,3') continue;
      if (id === '6,1' || id === '6,2' || id === '7,1' || id === '7,2') continue;
      const bounds = cellBounds(ix, iz);
      const emptyChance = iz === 0 ? 0.24 : 0.09;
      if (rand() < emptyChance) {
        palmSpots.push({
          x: (bounds.x0 + bounds.x1) / 2 + (rand() - 0.5) * 6,
          z: (bounds.z0 + bounds.z1) / 2 + (rand() - 0.5) * 6,
          s: 0.85 + rand() * 0.4,
        });
        continue;
      }
      const tries = bounds.x1 - bounds.x0 > 22 ? 2 : 1;
      for (let n = 0; n < tries; n += 1) {
        placeBuilding(buckets, geoms, collision, ix, iz, rand);
      }
    }
  }

  addMarket(geoms, collision, rand);
  addMosque(geoms, collision);
  addStadium(geoms, collision);
  addPort(geoms, collision, rand);
  addAirport(geoms, collision);

  buildBuildingMeshes(scene, buckets, refs.windowMat);
  addLamps(scene, geoms, refs.lampMat);
  collectPalmSpots(palmSpots, rand);
  addPalms(scene, collision, palmSpots, quality.palms);
  addUmbrellas(scene, rand);
  const boats = addBoats(scene, rand);
  const flags = addFlags(scene);
  addSigns(scene);
  addBillboards(scene);
  const clouds = addClouds(scene, refs, rand);

  const cityGeom = mergeColored(geoms);
  const surface = surfaceMaps();
  const cityMat = new MeshStandardMaterial({
    map: surface.albedo,
    roughnessMap: surface.roughness,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.03,
    envMapIntensity: 0.42,
    side: DoubleSide,
  });
  const cityMesh = new Mesh(cityGeom, cityMat);
  cityMesh.receiveShadow = quality.shadows;
  cityMesh.castShadow = quality.shadows;
  scene.add(cityMesh);

  const oceanGeo = new PlaneGeometry(1800, 780, quality.ocean, Math.max(12, Math.floor(quality.ocean * 0.55)));
  oceanGeo.rotateX(-Math.PI / 2);
  oceanGeo.translate(0, -0.4, -200);
  const oceanMat = new ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      deepColor: { value: new Color('#0c3a52') },
      shoreColor: { value: new Color('#1f8ea0') },
      sunColor: { value: new Color('#ffb07a') },
      skyColor: { value: new Color('#ffd0ea') },
      sunDir: { value: new Vector3(0.2, 0.8, -0.2) },
      fogColor: { value: new Color('#ffb07a') },
      fogNear: { value: 80 },
      fogFar: { value: 340 },
    },
    vertexShader: oceanVertex,
    fragmentShader: oceanFragment,
  });
  const ocean = new Mesh(oceanGeo, oceanMat);
  ocean.renderOrder = -1;
  scene.add(ocean);
  refs.ocean = oceanMat.uniforms;

  const foam = new Mesh(
    new PlaneGeometry(620, 5),
    new MeshBasicMaterial({ color: 0xfff6ea, transparent: true, opacity: 0.38, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.06, 11.5);
  scene.add(foam);

  return { collision, graph, paths, boats, flags, clouds };
}

function buildGraph() {
  const nodes = [];
  const index = new Map();
  const id = (i, j) => `${i},${j}`;
  for (let i = 0; i < ROAD_XS.length; i += 1) {
    for (let j = 0; j < ROAD_ZS.length; j += 1) {
      const node = { i, j, x: ROAD_XS[i], z: ROAD_ZS[j], neighbors: [] };
      index.set(id(i, j), node);
      nodes.push(node);
    }
  }
  for (const node of nodes) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [di, dj] of dirs) {
      const next = index.get(id(node.i + di, node.j + dj));
      if (next) node.neighbors.push(next);
    }
  }
  return { nodes };
}

function buildPaths() {
  const paths = [];
  for (let i = 0; i < ROAD_XS.length - 1; i += 1) {
    for (const z of ROAD_ZS) {
      const x1 = ROAD_XS[i];
      const x2 = ROAD_XS[i + 1];
      const off = halfZ(z) + 1.35;
      paths.push({ a: { x: x1, z: z + off }, b: { x: x2, z: z + off } });
      paths.push({ a: { x: x1, z: z - off }, b: { x: x2, z: z - off } });
    }
  }
  for (let j = 0; j < ROAD_ZS.length - 1; j += 1) {
    for (const x of ROAD_XS) {
      const z1 = ROAD_ZS[j];
      const z2 = ROAD_ZS[j + 1];
      const off = ROAD_W / 2 + 1.35;
      paths.push({ a: { x: x + off, z: z1 }, b: { x: x + off, z: z2 } });
      paths.push({ a: { x: x - off, z: z1 }, b: { x: x - off, z: z2 } });
    }
  }
  paths.push({ a: { x: -210, z: 26 }, b: { x: 210, z: 26 } });
  paths.push({ a: { x: -210, z: 38 }, b: { x: 210, z: 38 } });
  return paths;
}

function addRoads(geoms) {
  const asphalt = 0x6d7684;
  const walk = 0xd9d0c3;
  for (const x of ROAD_XS) {
    for (const z of ROAD_ZS) {
      geoms.push(coloredBox(ROAD_W + 0.4, 0.06, halfZ(z) * 2 + 0.4, x, 0.045, z, asphalt));
    }
  }
  for (const z of ROAD_ZS) {
    const hz = halfZ(z);
    const boulevard = Math.abs(z - BLVD_Z) < 0.01;
    for (let i = 0; i < ROAD_XS.length - 1; i += 1) {
      const x1 = ROAD_XS[i] + ROAD_W / 2;
      const x2 = ROAD_XS[i + 1] - ROAD_W / 2;
      const mid = (x1 + x2) / 2;
      const len = Math.max(0.5, x2 - x1);
      geoms.push(coloredBox(len, 0.06, hz * 2, mid, 0.045, z, asphalt));
      if (boulevard) {
        geoms.push(coloredBox(len, 0.05, 2.6, mid, 0.06, z + hz + 1.3, 0xe6d7c0));
        geoms.push(coloredBox(len, 0.04, 7.2, mid, 0.03, z - hz - 3.8, 0xe8d4a4));
        geoms.push(coloredBox(len, 0.02, 0.16, mid, 0.09, z + hz - 0.75, 0xf0d15a));
        geoms.push(coloredBox(len, 0.02, 0.16, mid, 0.09, z - hz + 0.75, 0xf0d15a));
        geoms.push(coloredBox(len * 0.62, 0.08, 1.15, mid, 0.1, z, 0x5d8a48));
      } else {
        geoms.push(coloredBox(len, 0.05, 2.2, mid, 0.06, z + hz + 1.15, walk));
        geoms.push(coloredBox(len, 0.05, 2.2, mid, 0.06, z - hz - 1.15, walk));
      }
      const dashes = Math.max(1, Math.floor(len / 10));
      for (let d = 0; d < dashes; d += 1) {
        const dx = x1 + (len / dashes) * d + 2;
        geoms.push(coloredBox(2.2, 0.02, 0.15, dx, 0.095, z, 0xf4f1ea));
      }
    }
  }
  for (const x of ROAD_XS) {
    for (let j = 0; j < ROAD_ZS.length - 1; j += 1) {
      const z1 = ROAD_ZS[j] + halfZ(ROAD_ZS[j]);
      const z2 = ROAD_ZS[j + 1] - halfZ(ROAD_ZS[j + 1]);
      const mid = (z1 + z2) / 2;
      const len = Math.max(0.5, z2 - z1);
      geoms.push(coloredBox(ROAD_W, 0.06, len, x, 0.045, mid, asphalt));
      geoms.push(coloredBox(2.2, 0.05, len, x + ROAD_W / 2 + 1.15, 0.06, mid, walk));
      geoms.push(coloredBox(2.2, 0.05, len, x - ROAD_W / 2 - 1.15, 0.06, mid, walk));
      const dashes = Math.max(1, Math.floor(len / 10));
      for (let d = 0; d < dashes; d += 1) {
        const dz = z1 + (len / dashes) * d + 2;
        geoms.push(coloredBox(0.15, 0.02, 2.2, x, 0.095, dz, 0xf4f1ea));
      }
    }
  }
}

function addCrosswalks(geoms) {
  for (const x of [-104, 0, 104]) {
    for (let i = 0; i < 7; i += 1) {
      geoms.push(coloredBox(0.55, 0.02, 12, x + 8 + i * 0.95, 0.1, BLVD_Z, 0xf7f7f7));
    }
  }
}

const ARCH = {
  house: { w: 7.2, h: 5.8, d: 7.4, awning: false },
  house2: { w: 8, h: 9.4, d: 8, awning: false },
  shop: { w: 11, h: 6.5, d: 8.2, awning: true },
  block: { w: 12, h: 16, d: 11, awning: false },
  tower: { w: 13, h: 32, d: 13, awning: false },
};
const WALLS = [0xf3e2c4, 0xe7c07a, 0xd97748, 0xc4554a, 0xf7f4ee, 0xdebf9a, 0x8eafc4, 0xe8b84a, 0xd8d2c8, 0xb7c7a1];
const ROOFS = [0x8c3b2a, 0x6e4a32, 0x4d5d73, 0x9a6a32, 0x5c6b52, 0xa34b3c];
const AWNINGS = [0xe23d3d, 0x1f6feb, 0xf2c14e, 0x0e8f62, 0xf47bb5];

function pickArch(ix, iz, rand) {
  const coastal = iz === 0;
  const central = ix >= 2 && ix <= 5 && iz >= 2 && iz <= 3;
  const r = rand();
  if (coastal) {
    if (r < 0.48) return 'house';
    if (r < 0.72) return 'house2';
    return 'shop';
  }
  if (central && r > 0.86) return 'tower';
  if (r < 0.34) return 'house';
  if (r < 0.52) return 'house2';
  if (r < 0.74) return 'shop';
  return 'block';
}

function placeBuilding(buckets, geoms, collision, ix, iz, rand) {
  const name = pickArch(ix, iz, rand);
  const arch = ARCH[name];
  const rot = rand() < 0.5 ? 0 : Math.PI / 2;
  const extX = rot ? arch.d : arch.w;
  const extZ = rot ? arch.w : arch.d;
  const bounds = cellBounds(ix, iz);
  const minX = bounds.x0 + extX / 2;
  const maxX = bounds.x1 - extX / 2;
  const minZ = bounds.z0 + extZ / 2;
  const maxZ = bounds.z1 - extZ / 2;
  if (minX >= maxX || minZ >= maxZ) return;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    if (overlaps(collision, x, z, extX, extZ, 1.1)) continue;
    buckets[name].push({
      x,
      z,
      rot,
      color: WALLS[Math.floor(rand() * WALLS.length)],
    });
    addBox(collision, x, z, extX, extZ);
    geoms.push(coloredBox(extX + 0.45, 0.28, extZ + 0.45, x, arch.h + 0.12, z, ROOFS[Math.floor(rand() * ROOFS.length)]));
    if (name === 'tower') {
      geoms.push(coloredBox(1.4, 4.2, 1.4, x, arch.h + 2.3, z, 0x5c6b78));
    }
    if (arch.awning) {
      const fwdX = Math.sin(rot);
      const fwdZ = Math.cos(rot);
      const ax = x + fwdX * (arch.d / 2 + 0.4);
      const az = z + fwdZ * (arch.d / 2 + 0.4);
      geoms.push(coloredBox(arch.w * 0.82, 0.1, 0.85, ax, 2.45, az, AWNINGS[Math.floor(rand() * AWNINGS.length)], rot));
    }
    return;
  }
}

function scaleUv(geom, su, sv) {
  const uv = geom.getAttribute('uv');
  if (!uv) return;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

function surfaceMaps() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f3f0ea';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i += 1) {
    const v = 214 + Math.floor(Math.random() * 36);
    ctx.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 1);
  }
  const albedo = new CanvasTexture(canvas);
  albedo.wrapS = RepeatWrapping;
  albedo.wrapT = RepeatWrapping;
  albedo.colorSpace = SRGBColorSpace;
  albedo.anisotropy = 4;

  const rough = document.createElement('canvas');
  rough.width = 128;
  rough.height = 128;
  const rg = rough.getContext('2d');
  rg.fillStyle = '#c8c8c8';
  rg.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i += 1) {
    const v = 90 + Math.floor(Math.random() * 140);
    rg.fillStyle = `rgb(${v},${v},${v})`;
    rg.fillRect(Math.random() * 128, Math.random() * 128, 3, 2);
  }
  const roughness = new CanvasTexture(rough);
  roughness.wrapS = RepeatWrapping;
  roughness.wrapT = RepeatWrapping;
  return { albedo, roughness };
}

function overlaps(collision, x, z, w, d, pad) {
  const minX = x - w / 2 - pad;
  const maxX = x + w / 2 + pad;
  const minZ = z - d / 2 - pad;
  const maxZ = z + d / 2 + pad;
  for (let i = 0; i < collision.length; i += 1) {
    const b = collision[i];
    if (minX < b.maxX && maxX > b.minX && minZ < b.maxZ && maxZ > b.minZ) return true;
  }
  return false;
}

function buildBuildingMeshes(scene, buckets, material) {
  for (const [name, list] of Object.entries(buckets)) {
    if (!list.length) continue;
    const arch = ARCH[name];
    const geom = facadeGeom(arch.w, arch.h, arch.d);
    const mesh = new InstancedMesh(geom, material, list.length);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const matrix = new Matrix4();
    const quat = new Quaternion();
    const pos = new Vector3();
    const scl = new Vector3(1, 1, 1);
    const color = new Color();
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      quat.setFromAxisAngle(UP, item.rot);
      pos.set(item.x, 0, item.z);
      matrix.compose(pos, quat, scl);
      mesh.setMatrixAt(i, matrix);
      color.setHex(item.color);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }
}

function facadeGeom(w, h, d) {
  const hw = w / 2;
  const hd = d / 2;
  const positions = [];
  const normals = [];
  const uvs = [];
  const uy = h / 3.3;
  function quad(pts, nx, ny, nz, us, vs) {
    const [a, b, c, e] = pts;
    for (const p of [a, b, c, a, c, e]) positions.push(p[0], p[1], p[2]);
    for (let i = 0; i < 6; i += 1) normals.push(nx, ny, nz);
    uvs.push(0, 0, us, 0, us, vs, 0, 0, us, vs, 0, vs);
  }
  quad([[-hw, 0, hd], [hw, 0, hd], [hw, h, hd], [-hw, h, hd]], 0, 0, 1, w / 3.3, uy);
  quad([[hw, 0, -hd], [-hw, 0, -hd], [-hw, h, -hd], [hw, h, -hd]], 0, 0, -1, w / 3.3, uy);
  quad([[-hw, 0, -hd], [-hw, 0, hd], [-hw, h, hd], [-hw, h, -hd]], -1, 0, 0, d / 3.3, uy);
  quad([[hw, 0, hd], [hw, 0, -hd], [hw, h, -hd], [hw, h, hd]], 1, 0, 0, d / 3.3, uy);
  quad([[-hw, h, hd], [hw, h, hd], [hw, h, -hd], [-hw, h, -hd]], 0, 1, 0, 0.02, 0.02);
  const geom = new BufferGeometry();
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return geom;
}

function makeFacadeTextures() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ece7df';
  ctx.fillRect(0, 0, 64, 4);
  const windows = [[6, 8], [36, 8], [6, 36], [36, 36]];
  for (const [x, y] of windows) {
    ctx.fillStyle = '#101820';
    ctx.fillRect(x, y, 20, 22);
    ctx.fillStyle = '#d7f3ff';
    ctx.fillRect(x + 3, y + 3, 5, 7);
  }
  const map = new CanvasTexture(canvas);
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  map.colorSpace = SRGBColorSpace;
  map.magFilter = NearestFilter;
  map.needsUpdate = true;

  const emissive = document.createElement('canvas');
  emissive.width = 64;
  emissive.height = 64;
  const eg = emissive.getContext('2d');
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, 64, 64);
  eg.fillStyle = '#fff';
  eg.fillRect(8, 10, 16, 18);
  eg.fillRect(38, 10, 16, 18);
  eg.fillRect(8, 38, 16, 18);
  const emissiveMap = new CanvasTexture(emissive);
  emissiveMap.wrapS = RepeatWrapping;
  emissiveMap.wrapT = RepeatWrapping;
  emissiveMap.colorSpace = SRGBColorSpace;
  emissiveMap.magFilter = NearestFilter;
  emissiveMap.needsUpdate = true;
  return { map, emissiveMap };
}

function addMarket(geoms, collision, rand) {
  const colors = [0xe23d3d, 0xf2c14e, 0x1f6feb, 0x0e8f62, 0xfffaf2, 0xff8c42];
  for (const [ix, iz] of [[3, 1], [4, 1]]) {
    const bounds = cellBounds(ix, iz);
    const aisle = (bounds.z0 + bounds.z1) / 2;
    for (let k = 0; k < 5; k += 1) {
      const x = bounds.x0 + 2.2 + ((bounds.x1 - bounds.x0 - 4.4) * k) / 4;
      for (const z of [(bounds.z0 + aisle) / 2, (aisle + bounds.z1) / 2]) {
        const roof = colors[Math.floor(rand() * colors.length)];
        geoms.push(coloredBox(3.1, 1.25, 2.15, x, 0.62, z, 0x8a5a32));
        geoms.push(coloredBox(3.5, 0.14, 2.5, x, 1.38, z, roof));
        addBox(collision, x, z, 3.1, 2.15);
      }
    }
  }
}

function addMosque(geoms, collision) {
  const bounds = cellBounds(4, 2);
  const x = (bounds.x0 + bounds.x1) / 2;
  const z = (bounds.z0 + bounds.z1) / 2;
  geoms.push(coloredBox(18, 8, 16, x, 4, z, 0xf4efe2));
  geoms.push(coloredBox(8, 1.1, 8, x, 8.55, z, 0xe7d7b0));
  const dome = new SphereGeometry(5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(x, 8.6, z);
  geoms.push(paint(dome, 0xd4a017));
  const mx = Math.min(bounds.x1 - 2, x + 8);
  const mz = Math.max(bounds.z0 + 2, z - 6);
  const shaft = new CylinderGeometry(1.05, 1.25, 16, 8);
  shaft.translate(mx, 8, mz);
  geoms.push(paint(shaft, 0xf4efe2));
  const cap = new ConeGeometry(1.5, 2.3, 8);
  cap.translate(mx, 17.1, mz);
  geoms.push(paint(cap, 0x0e8f62));
  addBox(collision, x, z, 18, 16);
  addBox(collision, mx, mz, 2.6, 2.6);
}

function addStadium(geoms, collision) {
  const bounds = cellBounds(1, 3);
  const x = (bounds.x0 + bounds.x1) / 2;
  const z = (bounds.z0 + bounds.z1) / 2;
  const fw = Math.min(18, bounds.x1 - bounds.x0 - 8);
  const fd = Math.min(11, bounds.z1 - bounds.z0 - 8);
  geoms.push(coloredBox(fw, 0.08, fd, x, 0.08, z, 0x2f8f4e));
  geoms.push(coloredBox(fw - 1.2, 0.02, 0.12, x, 0.14, z, 0xffffff));
  geoms.push(coloredBox(0.12, 0.02, fd - 1.2, x, 0.14, z, 0xffffff));
  const height = 3.1;
  const thick = 3.2;
  const stands = [
    [x, z - fd / 2 - thick / 2, fw + thick * 2, thick],
    [x, z + fd / 2 + thick / 2, fw + thick * 2, thick],
    [x - fw / 2 - thick / 2, z, thick, fd],
    [x + fw / 2 + thick / 2, z, thick, fd],
  ];
  for (const [sx, sz, sw, sd] of stands) {
    geoms.push(coloredBox(sw, height, sd, sx, height / 2, sz, 0xd9d3c6));
    geoms.push(coloredBox(sw * 0.92, 0.35, sd * 0.55, sx, height + 0.15, sz, 0xc4554a));
    addBox(collision, sx, sz, sw, sd);
  }
}

function addPort(geoms, collision, rand) {
  const colors = [0xb3392b, 0x1d6fbf, 0x0f8a5f, 0xe0b34a, 0xd5dde6, 0x8d3b8d];
  for (const [ix, iz] of [[6, 1], [6, 2], [7, 1], [7, 2]]) {
    const bounds = cellBounds(ix, iz);
    for (let c = 0; c < 4; c += 1) {
      for (let r = 0; r < 3; r += 1) {
        if (r === 1 || rand() < 0.15) continue;
        const cw = 6.1;
        const cd = 2.45;
        const ch = rand() < 0.28 ? 4.8 : 2.45;
        const x = bounds.x0 + cw / 2 + ((bounds.x1 - bounds.x0 - cw) * c) / 3;
        const z = bounds.z0 + 1.6 + ((bounds.z1 - bounds.z0 - 3.2) * r) / 2;
        const color = colors[Math.floor(rand() * colors.length)];
        geoms.push(coloredBox(cw, ch, cd, x, ch / 2, z, color));
        geoms.push(coloredBox(cw * 0.94, ch * 0.1, cd + 0.05, x, ch * 0.72, z, 0xf7f4ee));
        addBox(collision, x, z, cw, cd);
      }
    }
  }
  const bounds = cellBounds(7, 2);
  const x = bounds.x1 - 1.6;
  const z = (bounds.z0 + bounds.z1) / 2;
  geoms.push(coloredBox(1.1, 16, 1.1, x, 8, z, 0xf0c14a));
  geoms.push(coloredBox(12, 0.55, 0.7, x - 5.2, 15.4, z, 0xf0c14a));
  geoms.push(coloredBox(0.35, 5, 0.35, x - 10.5, 12.5, z, 0x333333));
  addBox(collision, x, z, 1.6, 1.6);
}

function addAirport(geoms, collision) {
  geoms.push(coloredBox(16, 0.05, 130, -236, 0.04, 230, 0x4a5160));
  for (let i = 0; i < 10; i += 1) {
    geoms.push(coloredBox(0.4, 0.02, 6, -236, 0.09, 175 + i * 12, 0xf4f1ea));
  }
  geoms.push(coloredBox(12, 7, 16, -226, 3.5, 214, 0xe7e1d6));
  geoms.push(coloredBox(8, 1.2, 6, -226, 7.6, 214, 0x8eafc4));
  addBox(collision, -226, 214, 12, 16);
}

function addLamps(scene, geoms, lampMat) {
  const spots = [];
  for (const z of ROAD_ZS) {
    const off = halfZ(z) + 1.8;
    for (let x = -190; x <= 200; x += 30) {
      if (ROAD_XS.some((rx) => Math.abs(rx - x) < 9)) continue;
      spots.push({ x, z: z + off });
    }
  }
  for (const spot of spots) {
    const pole = new CylinderGeometry(0.06, 0.09, 4.5, 5);
    pole.translate(spot.x, 2.25, spot.z);
    geoms.push(paint(pole, 0x4e565f));
  }
  if (!spots.length) return;
  const bulbs = new InstancedMesh(new SphereGeometry(0.16, 6, 5), lampMat, spots.length);
  bulbs.frustumCulled = false;
  const matrix = new Matrix4();
  for (let i = 0; i < spots.length; i += 1) {
    matrix.makeTranslation(spots[i].x, 4.55, spots[i].z);
    bulbs.setMatrixAt(i, matrix);
  }
  bulbs.instanceMatrix.needsUpdate = true;
  scene.add(bulbs);
}

function crowded(x, z) {
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 18) return true;
  for (const car of PARKED) {
    if (Math.hypot(x - car.x, z - car.z) < 5) return true;
  }
  for (const place of PLACES) {
    if (Math.hypot(x - place.x, z - place.z) < 4.5) return true;
  }
  return false;
}

function collectPalmSpots(spots, rand) {
  for (let x = -214; x <= 214; x += 16) {
    if (ROAD_XS.some((rx) => Math.abs(rx - x) < 10)) continue;
    spots.push({ x: x + (rand() - 0.5) * 2, z: BLVD_Z, s: 0.8 + rand() * 0.25 });
  }
  for (let x = -220; x <= 220; x += 18) {
    spots.push({ x: x + (rand() - 0.5) * 4, z: 20 + rand() * 3, s: 0.9 + rand() * 0.45 });
    if (rand() > 0.35) spots.push({ x: x + 7, z: 30 + rand() * 2, s: 0.75 + rand() * 0.35 });
  }
}

function addPalms(scene, collision, spots, limit) {
  const filtered = spots.filter((spot) => !crowded(spot.x, spot.z)).slice(0, limit);
  if (!filtered.length) return;
  const trunkGeo = new CylinderGeometry(0.16, 0.28, 4.3, 5);
  trunkGeo.translate(0, 2.15, 0);
  const fronds = [];
  for (let i = 0; i < 6; i += 1) {
    const cone = new ConeGeometry(0.62, 2.5, 4);
    cone.translate(0, 1.15, 0);
    cone.rotateZ(-1.28);
    cone.rotateY((i / 6) * Math.PI * 2);
    cone.translate(0, 4.15, 0);
    fronds.push(cone.toNonIndexed());
  }
  const crownGeo = mergeColored(fronds.map((geom) => paint(geom, 0x2f7d32)));
  const trunkMat = new MeshLambertMaterial({ color: 0x8a5a32 });
  const crownMat = new MeshLambertMaterial({ color: 0x2f7d32, side: DoubleSide });
  const trunks = new InstancedMesh(trunkGeo, trunkMat, filtered.length);
  const crowns = new InstancedMesh(crownGeo, crownMat, filtered.length);
  trunks.frustumCulled = false;
  crowns.frustumCulled = false;
  trunks.castShadow = true;
  const matrix = new Matrix4();
  const quat = new Quaternion();
  const pos = new Vector3();
  const scl = new Vector3();
  for (let i = 0; i < filtered.length; i += 1) {
    const spot = filtered[i];
    quat.setFromAxisAngle(UP, spot.x * 0.2);
    pos.set(spot.x, 0, spot.z);
    scl.set(spot.s, spot.s, spot.s);
    matrix.compose(pos, quat, scl);
    trunks.setMatrixAt(i, matrix);
    crowns.setMatrixAt(i, matrix);
    addBox(collision, spot.x, spot.z, 0.7, 0.7);
  }
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  scene.add(trunks, crowns);
}

function addUmbrellas(scene, rand) {
  const colors = [0xe23d3d, 0xf2c14e, 0x1f6feb, 0x0e8f62, 0xf47bb5, 0xffffff];
  const poleMat = new MeshLambertMaterial({ color: 0xeeeeee });
  for (let i = 0; i < 12; i += 1) {
    const x = -200 + i * 34 + rand() * 6;
    const z = 16 + rand() * 6;
    if (crowded(x, z)) continue;
    const group = new Group();
    const pole = new Mesh(new CylinderGeometry(0.04, 0.05, 1.5, 5), poleMat);
    pole.position.y = 0.75;
    const top = new Mesh(new ConeGeometry(1.05, 0.42, 7), new MeshLambertMaterial({ color: colors[i % colors.length] }));
    top.position.y = 1.55;
    group.add(pole, top);
    group.position.set(x, 0, z);
    scene.add(group);
  }
}

function addBoats(scene, rand) {
  const boats = [];
  const colors = [0x1f6feb, 0xe23d3d, 0xf2c14e, 0xf7f4ee, 0x0e8f62];
  for (let i = 0; i < 5; i += 1) {
    const scale = 0.8 + rand() * 0.7;
    const group = new Group();
    const hull = new Mesh(
      new BoxGeometry(1.15 * scale, 0.32 * scale, 3.1 * scale),
      new MeshLambertMaterial({ color: colors[i % colors.length] }),
    );
    hull.position.y = 0.18 * scale;
    const cabin = new Mesh(
      new BoxGeometry(0.85 * scale, 0.38 * scale, 1 * scale),
      new MeshLambertMaterial({ color: 0xf4f1ea }),
    );
    cabin.position.set(0, 0.48 * scale, -0.15 * scale);
    group.add(hull, cabin);
    group.position.set(-180 + i * 70, -0.15, -6 - rand() * 10);
    group.rotation.y = rand() * 0.6 - 0.2;
    group.userData = { baseY: -0.15, ph: rand() * 6, sp: 0.7 + rand() * 0.5 };
    scene.add(group);
    boats.push(group);
  }
  const ship = new Group();
  ship.add(new Mesh(new BoxGeometry(6, 2.2, 22), new MeshLambertMaterial({ color: 0x2c3e50 })));
  const bridge = new Mesh(new BoxGeometry(5, 2.4, 5), new MeshLambertMaterial({ color: 0xf4f1ea }));
  bridge.position.set(0, 2, -4);
  ship.add(bridge);
  ship.position.set(40, 0.4, -28);
  ship.userData = { baseY: 0.4, ph: 1, sp: 0.35 };
  scene.add(ship);
  boats.push(ship);
  return boats;
}

function addFlags(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#008751';
  ctx.fillRect(0, 0, 38, 64);
  ctx.fillStyle = '#fcd116';
  ctx.fillRect(38, 0, 58, 32);
  ctx.fillStyle = '#e8112d';
  ctx.fillRect(38, 32, 58, 32);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  const mat = new MeshLambertMaterial({ map: tex, side: DoubleSide });
  const poleMat = new MeshLambertMaterial({ color: 0xdddddd });
  const flags = [];
  const spots = [
    [-170, 44], [20, 44], [26, 200], [-130, 250], [180, 150],
  ];
  for (const [x, z] of spots) {
    const group = new Group();
    const pole = new Mesh(new CylinderGeometry(0.05, 0.06, 4.2, 5), poleMat);
    pole.position.y = 2.1;
    const cloth = new Mesh(new PlaneGeometry(1.35, 0.78), mat);
    cloth.position.set(0.75, 3.5, 0);
    group.add(pole, cloth);
    group.position.set(x, 0, z);
    group.userData = { baseYaw: 0, ph: x * 0.01, cloth };
    scene.add(group);
    flags.push(group);
  }
  return flags;
}

function addSigns(scene) {
  const labels = [
    ['ROUTE DES PÊCHES', -150, 47],
    ['BD DE LA MARINA', 8, 47],
    ['MARCHÉ DANTOKPA', 18, 112],
    ['GRANDE MOSQUÉE', 18, 168],
    ["STADE DE L'AMITIÉ", -140, 220],
    ['PORT DE COTONOU', 140, 112],
    ['CADJEHOUN', -214, 190],
  ];
  for (const [text, x, z] of labels) {
    const board = new Mesh(new PlaneGeometry(text.length > 16 ? 5.4 : 4.4, 0.9), new MeshLambertMaterial({
      map: labelTexture(text, '#14324a', '#f7f1e1'),
      side: DoubleSide,
    }));
    board.position.set(x, 2.5, z);
    const pole = new Mesh(new CylinderGeometry(0.05, 0.06, 2.5, 5), new MeshLambertMaterial({ color: 0x5c656f }));
    pole.position.set(x, 1.25, z);
    scene.add(board, pole);
  }
}

function addBillboards(scene) {
  const boards = [
    ['ZEMIDJAN', 'Course rapide', -80, 43],
    ['COTONOU', 'Golfe du Bénin', 70, 43],
    ['229', 'Bénin', 150, 43],
  ];
  for (const [title, sub, x, z] of boards) {
    const mesh = new Mesh(
      new PlaneGeometry(6.2, 3.6),
      new MeshLambertMaterial({ map: billboardTexture(title, sub), side: DoubleSide }),
    );
    mesh.position.set(x, 3.4, z);
    scene.add(mesh);
    for (const ox of [-2.4, 2.4]) {
      const pole = new Mesh(new CylinderGeometry(0.08, 0.1, 3.2, 5), new MeshLambertMaterial({ color: 0x5c656f }));
      pole.position.set(x + ox, 1.6, z);
      scene.add(pole);
    }
  }
}

function labelTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#f0c14a';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = fg;
  ctx.font = '700 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function billboardTexture(title, sub) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#102033';
  ctx.fillRect(0, 0, 512, 320);
  ctx.fillStyle = '#fcd116';
  ctx.fillRect(0, 0, 512, 16);
  ctx.fillRect(0, 304, 512, 16);
  ctx.fillStyle = '#f7f1e1';
  ctx.font = '800 78px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 140);
  ctx.fillStyle = '#f0c14a';
  ctx.font = '500 36px sans-serif';
  ctx.fillText(sub, 256, 210);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function addClouds(scene, refs, rand) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grd.addColorStop(0, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  refs.cloudMat = new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.7 });
  const clouds = [];
  for (let i = 0; i < 8; i += 1) {
    const sprite = new Sprite(refs.cloudMat);
    sprite.position.set(-260 + rand() * 520, 70 + rand() * 40, -40 + rand() * 300);
    const s = 50 + rand() * 50;
    sprite.scale.set(s, s * 0.45, 1);
    sprite.userData.spd = 1.5 + rand() * 2;
    scene.add(sprite);
    clouds.push(sprite);
  }
  return clouds;
}
