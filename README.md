# Cotonou City

Jeu de ville ouverte dans le navigateur, au bord de l'Atlantique à Cotonou. Tu incarnes **Ibrahim** : à pied dans les rues, au volant du SUV noir, ou sur un zemidjan jaune. Les courses de taxi et les livraisons se paient en francs CFA.

Le rendu est en 3D vue troisième personne (Three.js). La ville est générée dans le code : boulevard de la Marina, Route des Pêches, marché Dantokpa, Grande Mosquée, stade, port, plage de Fidjrossè, palmiers, trafic et passants. La journée commence claire. Le coucher de soleil rose et violet dure plus longtemps, et la pause peut le forcer avec **Lumière : coucher de soleil**.

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

Huit missions enchaînées (zem chronométré, pagne volé à Dantokpa, convoi du SUV vers le port, course de la Route des Pêches, protection d'un étal à Fidjrossè, fuite devant la police, patron du marché, retour à la Marina). Une flèche jaune flotte devant Ibrahim, la mini-carte trace la route, et un faisceau marque l'objectif. Réussite ou échec s'affichent, avec réessai. La progression et l'argent restent dans le `localStorage`. La police poursuit selon les étoiles : on s'échappe en quittant le cercle de recherche, dans une ruelle ou en changeant de voiture. Se faire prendre mène au commissariat. **F** ou **Frapper** enchaîne poing et coup de pied, **R** esquive. Les répliques sont des fichiers audio, avec sous-titres.

Les personnages restent le modèle **Quaternius** (CC0), un seul corps partagé, avec la photo d'Ibrahim sur le visage. La peau et les vêtements réagissent à la lumière (rugosité), les voitures ont une peinture qui reflète l'environnement, l'eau renvoie le ciel, et les routes portent un grain. La pause propose **Haute**, **Moyenne** et **Basse** : la haute ajoute ombres douces et un léger flou lumineux. Ce n'est pas un film de jeu AAA. Il n'y a pas de scans de rues, pas de visages filmés un par un, pas d'occlusion ambiante. Le téléphone doit rester fluide, donc les textures viennent du code, pas de fichiers de plusieurs mégaoctets.

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

Un joystick s'affiche en bas à gauche, les boutons **Frapper**, **Esquive**, **Courir**, **Monter**, **Klaxon** et **Pause** en bas à droite. En voiture ou en zemidjan, ils laissent place aux pédales **Accélérer** et **Frein**, au frein à main, à la nitro, au klaxon et à **Sortir**. La pause choisit la direction au joystick ou avec deux boutons. Des chevrons jaunes défilent sur la route vers l'objectif. Ils marchent en même temps que le joystick. Glisser ailleurs sur l'écran tourne la caméra. Un petit geste marche lentement, un geste à fond court. Le personnage accélère et tourne sans à-coup. Un appui sur Courir fait aussi sauter. Haut éloigne de la caméra, bas s'en rapproche, droite et gauche suivent l'écran (comme D et A). En voiture, droite fait tourner à droite. La pause a un curseur **Luminosité**, la **Taille du joystick** (plus petit et stable sous le doigt), le choix **Jour** ou **Coucher de soleil**, et la qualité **Haute / Moyenne / Basse**. Ces choix restent sur l'appareil.

## Comment jouer

- Le SUV noir et les zemidjans jaunes garés sur la promenade sont à toi. Tu peux aussi monter dans le trafic.
- Un marqueur jaune indique une prise en charge, un marqueur vert la destination. Ralentis dessus pour valider.
- L'argent s'affiche en haut à gauche. Une conduite sans accident pendant la course ajoute un pourboire.
- Renverser un piéton, percuter une voiture ou la police augmente le niveau **Recherché**. Si une voiture de police reste collée à Ibrahim, il est interpellé, paie une amende et repart de Fidjrossè.
- La mini-carte en bas à gauche montre les routes, Ibrahim et l'objectif. Une flèche à l'écran pointe le marqueur quand il est hors champ.
