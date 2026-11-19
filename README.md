# IDIGER · Risk Model Platform — V2

Application locale en espagnol pour explorer les risques de Bogotá, leurs données et les scénarios climatiques. Cette V2 refond l’accueil, la carte plein écran et le glissement 3D. Les géométries sont documentées ; les animations et les pertes restent illustratives, sans modèle physique calibré.

## Ouvrir

Double-cliquer sur **Lancer IDIGER.command**, ou ouvrir **http://127.0.0.1:5180/** si le serveur tourne déjà. Garder sa fenêtre Terminal ouverte. Le lanceur construit la version de production et réutilise un serveur existant de cette application.

```sh
npm ci
npm run build
npm run preview
```

Node.js 22.12+ ; développement : `npm run dev`. Aucun compte ni clé API. L’imagerie détaillée nécessite Internet ; l’image de secours, la géographie, les bâtiments, le climat et les cinq terrains 3D sont embarqués. WebGL est nécessaire pour les cartes et la scène Three.js.

## Parcours

- **Accueil** (V3, style éditorial arrondi) : logo IDIGER avec drapeau colombien, titre « Centro de Modelación de Riesgos » en Fraunces, quatre principes à droite de la barre, « ? » = intention de la proposition. Trois risques actifs en cartes compactes, cinq modules en attente (bulle « Módulo pendiente » au survol), « + » mis en avant pour les sept risques complémentaires. En bas : Climatología et Modelo de índices de riesgo à gauche, Biblioteca de Archivos y Fuentes en face. La carte d'accueil est figée sur Bogotá (ni zoom ni déplacement). Styles V3 : `src/v3.css`.
- **Carte** : fond satellite, nord en haut. Choisir directement une zone ou son nom. La recherche de bassin reste repliée en bas à gauche. **Datos** ouvre les références ; **Capas** gère les stations, le relief 3D et l’inventaire historique. Les stations apparaissent seulement dans le territoire sélectionné, avec une infobulle au survol.
- **Caméra** : déplacer à la souris, zoomer au trackpad, tourner avec Ctrl + glisser / bouton droit, incliner avec le curseur et revenir au nord.
- **Inundaciones → Río Tunjuelo → Simular una lluvia** : régler pluie/durée puis lancer. Les bâtiments, pertes économiques et occupants en exposition critique évoluent avec le temps. Pause, curseur, avant/après, sauvegarde et export sont disponibles.
- **Movimientos en masa → Altos de la Estancia** : configurer puis lancer le glissement. La carte laisse place au relief isolé, aux unités de sol conceptuelles et au déplacement prescrit. Tourner la caméra et ouvrir les sources. Une trajectoire peut ne toucher aucun bâtiment de la **muestra** : zéro ne signifie pas absence de risque réel.
- **Climatología** : comparer les normales par station/variable/période ; explorer les quatre SSP et horizons du rapport IDIGER de janvier 2026 ; ouvrir l’esquisse de gestion à long terme.
- **Modelo de índices de riesgo** : matrice multirisque non compensatoire ; la gravité conserve la dimension la plus élevée.
- **Design Next Step**, depuis l’accueil : 19 actions organisées en données, modélisation, validation et intégration. Hypothèse actuelle, responsable proposé et critère de clôture sont explicités. Le suivi déclaré reste local.

## Données et portée

| Contenu | Statut V2 |
| --- | --- |
| 19 microbassins, 14 sous-bassins, 2 621 tronçons | Géométries EAAB ; couverture de 99,9917 % du périmètre des 19 localités du corpus. Sumapaz absent. |
| 38 territoires | 33 territoires hydrographiques et cinq secteurs de présentation pour les mouvements de terrain. Les secteurs ne sont pas des zonages d’aléa. |
| Empreintes de constructions | Copie publique UDFJC des attributs Catastro, 2022 ; échantillons par territoire, parfois limités par requête. 3 384 empreintes dans le corridor Tunjuelo. Les échantillons peuvent se recouvrir entre risques. |
| 75 stations IDIGER | Catalogue géolocalisé, sans télémétrie. Filtrage par inclusion géographique. |
| 12 jeux IDF EAAB | Point 0 de référence ; attribution spatiale aux bassins encore à valider. |
| 1 089 polygones de mouvements en masse | Inventaire historique 2016, identifiants et nomenclature préservés. |
| Relief de cinq secteurs | DEM régional Terrarium, 65×65 échantillons ; représentation 3D avec exagération verticale ×1,35. |
| 265 normales climatologiques | Données IDEAM du corpus E2 ; quatre périodes entre 1961–1990 et 1991–2020. |
| Prospective 2021–2100 | Rapport IDIGER janvier 2026 : 25 modèles CMIP6, quatre SSP, référence 1991–2020. Les plages affichées sont territoriales, pas des probabilités. |
| Exposition et impacts | Occupants, usages, vulnérabilité, valeurs de remplacement et fonctions de dommages hypothétiques. Aucun calcul de mortalité. |

Les hypothèses numériques sont consultables dans `public/data/model-assumptions.json`. **Exposition humaine critique** signifie occupants supposés dans des bâtiments à dommage élevé, et non décès prédits. La pluie annuelle des scénarios climatiques n’est jamais convertie en facteur IDF ou en pertes futures.

El Dorado porte deux codes dans le CSV, malgré un nom et des coordonnées identiques. Le rapprochement descriptif des normales est signalé à l’écran ; la continuité instrumentale reste à vérifier. Les périodes se recouvrent et ne constituent pas une analyse de tendance indépendante.

La signature IDIGER est une proposition SVG pour la maquette. Les documents locaux de travail ne sont pas publiés. Les références publiques sont accessibles par contexte ; les fournisseurs d’imagerie reçoivent les requêtes de tuiles. Aucun scénario n’est envoyé à un serveur applicatif.

## Vérifier et régénérer

```sh
npm test          # Cohérence des résultats, géographie et données climatiques
npm run test:e2e  # Parcours navigateur, dont mobile et secours cartographique
npm run build    # TypeScript et compilation
```

Chromium sur une nouvelle machine : `npx playwright install chromium`. Captures et rapports : `artifacts/`.

Les données sont déjà intégrées. Scripts de réimport :

- `scripts/import_local_data.py` : corpus V1, stations, IDF, localités, inventaire.
- `scripts/import_v2_geography.py` : géométrie EAAB et contrôle de couverture.
- `scripts/import_v2_buildings.py [identifiants…]` : requêtes cadastrales publiques, filtres et échantillons. Importe aussi la géographie.
- `scripts/import_v2_terrain.py` : recoupes DEM des cinq secteurs.
- `scripts/import_v2_climate.py` : normales du CSV original, sans changement de valeur.
- `scripts/provenance_v2.py` : empreintes des fichiers intégrés et description des sources.

Python : `requests`, `shapely`, `pyproj`, `pyshp`, `pymupdf`. Les réponses publiques originales sont conservées sous `docs/research/v2`. L’ingestion EAAB utilise une exception TLS limitée à ce service dont la chaîne de certificats est incomplète dans cet environnement ; aucune vérification TLS n’est désactivée dans l’application.

Architecture : React / TypeScript / Vite, MapLibre, Three.js chargé à la demande. Sources dans `src/data/catalog.ts`, actions dans `src/data/gaps.ts`, hypothèses de scénario dans `src/lib/scenarios.ts`, terrain et trajectoire dans `src/lib/terrain.ts`. Le fonctionnement applicatif est local ; la cartographie intégrée est livrée avec la compilation.

- [Sources, choix et limites V2](docs/SOURCES-V2.md)
- [Vérification V2](docs/VALIDATION-V2.md)
- [Historique de la V1](docs/VALIDATION-V1.md)
