/** Étals au bord du trottoir, en mètres. 1 unité = 1 m. */
export const STALLS = [
  { x: -148, z: 28, name: 'Maquis de la plage', price: 400, heal: 35, line: 'Poulet braisé, 400 francs. Ça remet debout.' },
  { x: -96, z: 70, name: 'Riz de Maman', price: 300, heal: 25, line: 'Riz et sauce, 300 francs. Bon appétit.' },
  { x: 12, z: 70, name: 'Pharmacie du coin', price: 600, heal: 50, line: 'Un sachet, 600 francs. Tu vas mieux.' },
];

const TALK = [
  'Ça va ? La route est encore libre.',
  'Yovo, les zem coupent sans clignotant.',
  'Dantokpa est ouvert. Prends un zem.',
  'La mer est calme ce matin.',
  'Mi kudo. Tu cherches qui ?',
];

export function nearestStall(pos, radius = 2.4) {
  let best = null;
  let bestD = radius;
  for (const stall of STALLS) {
    const d = Math.hypot(stall.x - pos.x, stall.z - pos.z);
    if (d < bestD) {
      best = stall;
      bestD = d;
    }
  }
  return best;
}

export function nearestTalk(pos, peds, radius = 2.3) {
  let best = null;
  let bestD = radius;
  for (const ped of peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
    if (d < bestD) {
      best = ped;
      bestD = d;
    }
  }
  return best;
}

export function talkLine(ped) {
  const index = Math.abs(Math.round(ped.pos.x + ped.pos.z)) % TALK.length;
  return TALK[index];
}
