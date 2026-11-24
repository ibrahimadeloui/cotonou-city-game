# Cotonou City

Jeu de ville ouverte dans le navigateur, au bord de l'Atlantique à Cotonou. Tu incarnes **Ibrahim** : à pied dans les rues, au volant du SUV noir, ou sur un zemidjan jaune. Les courses de taxi et les livraisons se paient en francs CFA.

Le rendu est en 3D vue troisième personne (Three.js). La ville est générée dans le code : boulevard de la Marina, Route des Pêches, marché Dantokpa, Grande Mosquée, stade, port, plage de Fidjrossè, palmiers, trafic et passants. La lumière suit un cycle jour / nuit qui s'attarde sur l'heure dorée.

Ibrahim et les passants utilisent le modèle **Quaternius — Animated Human** (CC0). Le visage d'Ibrahim est sa photo, projetée sur la tête. Les passants proches sont animés (marche, discussion, vendeurs) ; au loin, des silhouettes instanciées prennent le relais. Le menu pause propose **Foule dense**, **Foule moyenne** et **Foule légère** pour les téléphones.

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

## Hors ligne

Après un premier chargement, le jeu se met en cache (service worker) : JavaScript, modèle 3D, visage, voix. Il se lance ensuite sans réseau, y compris en mode avion. Sur iPhone : Partager, puis **Ajouter à l'écran d'accueil**. Sur Android : **Installer**.

## Missions, bagarre, voix

Huit missions enchaînées (zem chronométré, pagne volé à Dantokpa, convoi du SUV vers le port, course de la Route des Pêches, protection d'un étal à Fidjrossè, fuite devant la police, patron du marché, retour à la Marina). La progression et l'argent sont dans le `localStorage`, donc aussi hors ligne. **F** ou le bouton **Frapper** enchaîne poing et coup de pied, **R** esquive. Frapper un passant augmente le niveau recherché. À zéro point de vie, Ibrahim revient de l'hôpital. Les répliques (français, avec quelques tours béninois) sont des fichiers audio dans le jeu, avec sous-titres.

Les personnages restent le modèle **Quaternius** (CC0), léger pour un téléphone. Ce n'est pas un rendu façon grand jeu cinématographique : pas de visages uniques filmés, pas de ville photogrammétrée. La lumière reste simple pour que Safari iPhone et Chrome Android tiennent le rythme.

## Contrôles

### Clavier

Les touches **ZQSD**, **WASD** et les flèches marchent ensemble, sur clavier AZERTY comme QWERTY : ce sont à la fois les lettres et la position physique du bloc WASD.

| Action | Touche |
| --- | --- |
| Marcher | ZQSD, WASD ou flèches |
| Courir | Maj |
| Sauter | Espace (à pied) |
| Monter / descendre d'un véhicule | E |
| Frein à main | Espace (en véhicule) |
| Klaxon | H |
| Frapper (poing, puis pied) | F, ou le bouton Frapper |
| Esquiver | R, ou le bouton Esquive |
| Selfie | C, ou le portrait en haut à gauche |
| Changer de tenue | V, ou Tenue wax dans le menu pause |
| Densité des passants | Foule dense / moyenne / légère, dans le menu pause |
| Caméra | Glisser la souris |
| Pause | Échap ou P |

### Téléphone

Un joystick s'affiche en bas à gauche, les boutons **Courir / Frein**, **Monter / Sortir**, **Klaxon** et **Pause** en bas à droite. Glisser ailleurs sur l'écran tourne la caméra. Pousser le joystick à fond fait courir. Haut éloigne de la caméra, bas s'en rapproche, droite et gauche suivent l'écran (comme D et A). En voiture, droite fait tourner à droite.

## Comment jouer

- Le SUV noir et les zemidjans jaunes garés sur la promenade sont à toi. Tu peux aussi monter dans le trafic.
- Un marqueur jaune indique une prise en charge, un marqueur vert la destination. Ralentis dessus pour valider.
- L'argent s'affiche en haut à gauche. Une conduite sans accident pendant la course ajoute un pourboire.
- Renverser un piéton, percuter une voiture ou la police augmente le niveau **Recherché**. Si une voiture de police reste collée à Ibrahim, il est interpellé, paie une amende et repart de Fidjrossè.
- La mini-carte en bas à gauche montre les routes, Ibrahim et l'objectif. Une flèche à l'écran pointe le marqueur quand il est hors champ.
