/** Huit missions, dans l'ordre. Les lieux sont des id de config.PLACES. */
export const STORY = [
  {
    id: 'zem',
    title: 'Le premier zem',
    brief: 'Un client t\'attend sur la Route des Pêches. Prends un zemidjan jaune et conduis-le jusqu\'au marché Dantokpa.',
    body: 'Conduis le client à Dantokpa.',
    objective: 'Conduis le client à Dantokpa',
    place: 'dantokpa',
    steps: ['peches', 'dantokpa'],
    pay: 3500,
    limit: 85,
    vehicle: 'zem',
    kind: 'reach',
    voice: 'zem',
  },
  {
    id: 'pagne',
    title: 'Le pagne volé',
    brief: 'Neutralise le voleur au marché Dantokpa. Tu le mets à terre, sans le blesser : il se relève.',
    body: 'Neutralise le voleur au marché Dantokpa.',
    objective: 'Neutralise le voleur au marché Dantokpa',
    place: 'dantokpa',
    pay: 5000,
    kind: 'fight',
    voice: 'marche',
    bossName: 'Le voleur',
    bossHp: 40,
  },
  {
    id: 'port',
    title: 'Convoi vers le port',
    brief: 'Conduis le client dans le SUV noir jusqu\'au port. Un choc et le convoi recommence.',
    body: 'Conduis le SUV jusqu\'au port, sans choc.',
    objective: 'Conduis le SUV jusqu\'au port',
    place: 'port',
    steps: ['marina', 'port'],
    pay: 8000,
    vehicle: 'suv',
    kind: 'convoy',
    voice: 'port',
  },
  {
    id: 'course',
    title: 'Le repas de la plage',
    brief: 'Maman a préparé le repas. Porte-le de la Route des Pêches jusqu\'à Fidjrossè avant qu\'il refroidisse.',
    body: 'Livre le repas à Fidjrossè.',
    objective: 'Livre le repas à Fidjrossè',
    place: 'fidjrosse',
    steps: ['peches', 'fidjrosse'],
    pay: 4500,
    limit: 70,
    kind: 'reach',
    voice: 'course',
  },
  {
    id: 'vendeur',
    title: 'Pour l\'aîné',
    brief: 'L\'aîné de Fidjrossè veut du riz du marché. Achète-le, puis reste près de lui le temps qu\'il goûte.',
    body: 'Apporte le riz et reste près de l\'aîné.',
    place: 'fidjrosse',
    pay: 4000,
    hold: 18,
    kind: 'protect',
    voice: 'vendeur',
  },
  {
    id: 'fuite',
    title: 'La fuite',
    brief: 'La police a ton signalement. Fonce jusqu\'à Ganhi sans te faire coincer. Si on t\'attrape, tu recommences.',
    body: 'Échappe à la police et atteins Ganhi.',
    place: 'ganhi',
    pay: 6000,
    limit: 55,
    kind: 'escape',
    voice: 'police',
  },
  {
    id: 'patron',
    title: 'Le patron de Dantokpa',
    brief: 'Le patron du marché veut te parler de trop près. Descends de véhicule et fais-le tomber. Il se relève plus souvent que les autres.',
    body: 'Bats le patron, au marché.',
    place: 'dantokpa',
    pay: 9000,
    kind: 'fight',
    voice: 'patron',
    bossName: 'Le patron',
    bossHp: 80,
  },
  {
    id: 'marina',
    title: 'Retour à la Marina',
    brief: 'La ville te doit une fin tranquille. Rejoins le boulevard de la Marina. Les courses libres reprendront ensuite.',
    body: 'Rejoins le boulevard de la Marina.',
    place: 'marina',
    pay: 10000,
    kind: 'reach',
    voice: 'finale',
  },
];

/** Scènes jouées à l'arrivée. Chaque réplique a un nom, le français, parfois le fon. */
export const SCENES = {
  zem: {
    introAt: 'zone',
    objective: 'Objectif : conduis le client jusqu\'à Dantokpa',
    intro: [
      { speaker: 'Koffi', text: 'Ibrahim, le client est là. Prends le zem jaune.', fon: 'Wa yi zem.', dur: 2.6, cam: { dx: 3.2, dy: 1.7, dz: 1.4 } },
      { speaker: 'Client', text: 'Dantokpa, s\'il te plaît. Je paie à l\'arrivée.', dur: 2.6, cam: { dx: -2.4, dy: 1.5, dz: 2.6 } },
    ],
    mid: { speaker: 'Client', text: 'On y est presque. Reste sur la grande route.' },
    outro: [
      { speaker: 'Client', text: 'Merci. Voici tes francs.', dur: 2.4, cam: { dx: 2.2, dy: 1.6, dz: -2.4 } },
    ],
  },
  pagne: {
    introAt: 'zone',
    objective: 'Objectif : mets le voleur à terre, sans le blesser',
    intro: [
      { speaker: 'Vendeuse', text: 'Il a pris le pagne. Rattrape-le.', fon: 'E huzu.', dur: 2.4, cam: { dx: 2.8, dy: 1.6, dz: 2 } },
      { speaker: 'Ibrahim', text: 'Je le fais tomber. Il se relèvera.', dur: 2.3, cam: { dx: -1.8, dy: 1.45, dz: 2.2 } },
    ],
    mid: { speaker: 'Vendeuse', text: 'Doucement. On ne le blesse pas.' },
    outro: [
      { speaker: 'Vendeuse', text: 'Le pagne est revenu. Tiens, pour ta peine.', dur: 2.4 },
    ],
  },
  course: {
    introAt: 'zone',
    objective: 'Objectif : livre le repas à Fidjrossè',
    intro: [
      { speaker: 'Maman', text: 'Le repas est chaud. Porte-le à la plage.', dur: 2.5, cam: { dx: 2.6, dy: 1.6, dz: 1.8 } },
      { speaker: 'Ibrahim', text: 'J\'y vais avant qu\'il refroidisse.', dur: 2.2, cam: { dx: -2, dy: 1.5, dz: 2.4 } },
    ],
    mid: { speaker: 'Maman', text: 'Tu approches. Ne traîne pas.' },
    outro: [
      { speaker: 'Tante', text: 'Le repas est encore chaud. Merci, mon fils.', fon: 'Akpe.', dur: 2.5 },
    ],
  },
  fuite: {
    introAt: 'start',
    objective: 'Objectif : échappe à la police et atteins Ganhi',
    intro: [
      { speaker: 'Policier', text: 'On te voit. Rends-toi.', dur: 2.2, cam: { dx: 4, dy: 2.2, dz: -1 } },
      { speaker: 'Koffi', text: 'File vers Ganhi. Ne te fais pas coincer.', fon: 'Si gan.', dur: 2.5, cam: { dx: -2.2, dy: 1.6, dz: 2 } },
    ],
    mid: { speaker: 'Koffi', text: 'Encore un peu. Ganhi est devant.' },
    outro: [
      { speaker: 'Koffi', text: 'Ils t\'ont perdu. Respire. Voici de quoi tenir.', dur: 2.6 },
    ],
  },
  vendeur: {
    introAt: 'zone',
    objective: 'Objectif : reste près de l\'aîné le temps qu\'il goûte',
    intro: [
      { speaker: 'L\'aîné', text: 'Tu as le riz ? Reste là, je goûte.', fon: 'Mo du riz.', dur: 2.6, cam: { dx: 2.4, dy: 1.55, dz: 2 } },
      { speaker: 'Ibrahim', text: 'Je reste. Personne ne te dérange.', dur: 2.2, cam: { dx: -1.6, dy: 1.4, dz: 2.2 } },
    ],
    mid: { speaker: 'L\'aîné', text: 'C\'est bon. Encore un instant.' },
    outro: [
      { speaker: 'L\'aîné', text: 'C\'était bien. Prends ces francs.', dur: 2.4 },
    ],
  },
};

export function sceneFor(id) {
  return SCENES[id] || null;
}
