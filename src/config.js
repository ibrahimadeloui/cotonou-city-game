/** Grille, lieux et réglages partagés de Cotonou City. */

export const ROAD_XS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];
export const ROAD_ZS = [56, 108, 160, 212, 264, 316];
export const ROAD_W = 11;
export const BLVD_W = 16;
export const BLVD_Z = ROAD_ZS[0];

export const MAP = { minX: -242, maxX: 242, minZ: 4, maxZ: 348 };

export const SPAWN = { x: -160, z: 40, yaw: Math.PI / 2 };

export const PARKED = [
  { type: 'suv', x: -151, z: 40.5, yaw: Math.PI / 2 },
  { type: 'zem', x: -132, z: 37.5, yaw: Math.PI / 2 },
  { type: 'zem', x: -116, z: 42, yaw: Math.PI / 2 },
  { type: 'zem', x: -100, z: 36.5, yaw: 0.35 },
];

const SIDEWALK = ROAD_W / 2 + 1.35;

export const PLACES = [
  { id: 'fidjrosse', name: 'Plage de Fidjrossè', x: -188, z: 23 },
  { id: 'peches', name: 'Route des Pêches', x: -124, z: 40 },
  { id: 'marina', name: 'Boulevard de la Marina', x: 28, z: 40 },
  { id: 'ganhi', name: 'Ganhi', x: -52 + SIDEWALK, z: (56 + 108) / 2 },
  { id: 'dantokpa', name: 'Marché Dantokpa', x: SIDEWALK, z: (108 + 160) / 2 },
  { id: 'mosquee', name: 'Grande Mosquée', x: SIDEWALK, z: (160 + 212) / 2 },
  { id: 'stade', name: "Stade de l'Amitié", x: -156 + SIDEWALK, z: (212 + 264) / 2 },
  { id: 'port', name: 'Port de Cotonou', x: 156 - SIDEWALK, z: (108 + 160) / 2 },
  { id: 'cadjehoun', name: 'Cadjehoun', x: -208 - SIDEWALK, z: (160 + 212) / 2 },
  { id: 'haie', name: 'Haie Vive', x: 52 + SIDEWALK, z: (264 + 316) / 2 },
  { id: 'akpakpa', name: 'Akpakpa', x: 104 + SIDEWALK, z: (212 + 264) / 2 },
];

export const SPECS = {
  suv: { max: 26, reverse: 7, turn: 1.7, radius: 1.2, cam: 9.6, reach: 10 },
  car: { max: 20, reverse: 6, turn: 1.9, radius: 1.05, cam: 8.8, reach: 8 },
  zem: { max: 19, reverse: 4.5, turn: 2.75, radius: 0.66, cam: 7.3, reach: 4.3 },
  police: { max: 27, reverse: 6, turn: 1.95, radius: 1.12, cam: 9.4, reach: 0 },
};

export const WALK_SPEED = 4.3;
export const RUN_SPEED = 7.6;
export const START_MONEY = 2500;
export const CYCLE_SECONDS = 210;

export function halfZ(z) {
  return Math.abs(z - BLVD_Z) < 0.01 ? BLVD_W / 2 : ROAD_W / 2;
}

export function cellBounds(ix, iz) {
  const gutter = 2.8;
  const xL = ROAD_XS[ix];
  const xR = ROAD_XS[ix + 1];
  const zB = ROAD_ZS[iz];
  const zT = ROAD_ZS[iz + 1];
  return {
    x0: xL + ROAD_W / 2 + gutter,
    x1: xR - ROAD_W / 2 - gutter,
    z0: zB + halfZ(zB) + gutter,
    z1: zT - halfZ(zT) - gutter,
  };
}

export function districtAt(x, z) {
  if (z < 52 && x < -70) return 'Route des Pêches';
  if (z < 52) return 'Boulevard de la Marina';
  if (x > 145) return 'Le Port';
  if (x < -185 && z > 140) return 'Cadjehoun';
  if (Math.hypot(x, z - 134) < 48) return 'Dantokpa';
  if (Math.hypot(x - 26, z - 186) < 34) return 'Grande Mosquée';
  if (z > 230 && x < -90) return "Stade de l'Amitié";
  if (z > 275) return 'Haie Vive';
  if (x > 70 && z > 200) return 'Akpakpa';
  if (x < -70 && z < 130) return 'Fidjrossè';
  if (z < 130) return 'Ganhi';
  return 'Centre-ville';
}

/** La journée est longue. La nuit est un court passage, encore lisible. */
export function hourFromCycle(u) {
  const x = ((u % 1) + 1) % 1;
  if (x < 0.78) return 7.5 + (x / 0.78) * 10;
  const v = (x - 0.78) / 0.22;
  return (17.5 + v * (24 - 17.5 + 7.5)) % 24;
}

export function detectQuality() {
  const small = Math.min(window.innerWidth, window.innerHeight) < 900;
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const mobile = small || touch || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
  return {
    mobile,
    shadows: !mobile,
    peds: mobile ? 12 : 18,
    crowd: mobile ? 28 : 52,
    crowdFull: mobile ? 8 : 16,
    crowdHide: mobile ? 72 : 118,
    impostors: mobile ? 40 : 72,
    traffic: mobile ? 8 : 13,
    palms: mobile ? 42 : 68,
    ocean: mobile ? 28 : 48,
    pixelRatio: Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.6),
    antialias: !mobile,
  };
}
