# Cotonou City

Jeu de ville ouverte dans le navigateur, au bord de l'Atlantique à Cotonou. Tu incarnes **Ibrahim** : à pied dans les rues, au volant du SUV noir, ou sur un zemidjan jaune. Les courses de taxi et les livraisons se paient en francs CFA.

Le rendu est en 3D vue troisième personne (Three.js). La ville est générée dans le code : boulevard de la Marina, Route des Pêches, marché Dantokpa, Grande Mosquée, stade, port, plage de Fidjrossè, palmiers, trafic et passants. La lumière suit un cycle jour / nuit qui s'attarde sur l'heure dorée.

## Lancer en local

Il faut Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Ouvre l'adresse affichée par Vite (par défaut `http://localhost:5173`).

## Build

```bash
npm run build
```

Les fichiers statiques sont écrits dans `dist/`. Pour les prévisualiser :

```bash
npm run preview
```

## Déploiement Vercel

Le projet est un site statique Vite, sans configuration supplémentaire.

1. Importer le dépôt dans Vercel.
2. Laisser la détection **Vite** (ou s'appuyer sur `vercel.json`).
3. Commande de build : `npm run build`.
4. Dossier de sortie : `dist`.

Aucun serveur, aucune variable d'environnement, aucune base de données.

## Contrôles

### Clavier

Les déplacements suivent la position physique des touches WASD. Sur un clavier AZERTY, cela correspond à **ZQSD**.

| Action | Touche |
| --- | --- |
| Marcher | ZQSD, WASD ou flèches |
| Courir | Maj |
| Sauter | Espace (à pied) |
| Monter / descendre d'un véhicule | E |
| Frein à main | Espace (en véhicule) |
| Klaxon | H |
| Caméra | Glisser la souris |
| Pause | Échap ou P |

### Téléphone

Un joystick s'affiche en bas à gauche, les boutons **Courir / Frein**, **Monter / Sortir**, **Klaxon** et **Pause** en bas à droite. Glisser ailleurs sur l'écran tourne la caméra. Pousser le joystick à fond fait courir.

## Comment jouer

- Le SUV noir et les zemidjans jaunes garés sur la promenade sont à toi. Tu peux aussi monter dans le trafic.
- Un marqueur jaune indique une prise en charge, un marqueur vert la destination. Ralentis dessus pour valider.
- L'argent s'affiche en haut à gauche. Une conduite sans accident pendant la course ajoute un pourboire.
- Renverser un piéton, percuter une voiture ou la police augmente le niveau **Recherché**. Si une voiture de police reste collée à Ibrahim, il est interpellé, paie une amende et repart de Fidjrossè.
- La mini-carte en bas à gauche montre les routes, Ibrahim et l'objectif. Une flèche à l'écran pointe le marqueur quand il est hors champ.
