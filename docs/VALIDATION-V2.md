# Validation technique V2 — 15 novembre 2026

## Résultat

- `npm test` : **16 tests réussis**, données et calculs finaux.
- `npm run build` : **TypeScript et compilation réussis**.
- `npm run test:e2e` : **9 parcours réussis** sur la compilation de production, Chromium, 57,1 s.
- Après les derniers ajustements : **3 régressions ciblées réussies**, menus mutuellement exclusifs, impact à l’instant zéro en vue « avant » et scène 3D ; 34,5 s.
- Manifeste : **55 fichiers vérifiés**, aucune différence SHA-256.
- Inspection visuelle : 1512×982, 1366×768 et 390×844. Captures `artifacts/v2-*.png`.
- Serveur de démonstration : `http://127.0.0.1:5180/`, commande `npm run preview`.

La validation technique ne constitue pas une validation des modèles de risque. Les limitations scientifiques sont dans l’application, `model-assumptions.json` et [SOURCES-V2.md](SOURCES-V2.md).

## Vérifications de données et de résultats

- Intégrité des 19 microbassins, 14 sous-bassins et 2 621 tronçons EAAB ; déclaration de la couverture effective, sans masquer les différences de bord.
- Empreintes géographiques avec identifiants d’origine dans les principaux corridors. Les fichiers restent des échantillons.
- Catalogue IDIGER de 75 stations, filtrage par inclusion géographique, aucune télémétrie fictive.
- Conservation des 1 089 identifiants du registre historique de mouvements en masse.
- À cinq instants et sur cinq territoires : somme des catégories, exposition, occupants critiques et pertes conformes à la classification utilisée par le rendu ; bilan initial nul ; progression monotone.
- Réponse de l’exposition du Tunjuelo aux épisodes de pluie croissants ; échantillon vide traité sans pertes ni population inventée.
- Emprises d’eau géographiques finies et fermées ; pas d’eau dessinée pour un glissement.
- Cinq DEM locaux complets, trajectoires prescrites finissant plus bas que leur origine ; paramètres de position/exposition valides.
- 265 normales originales préservées, valeurs et divergence des codes El Dorado conservées.
- Coefficients IDF conformes au point 0 du CSV ; aucune probabilité attribuée à l’extrême exploratoire ; export du temps effectivement choisi.

## Parcours navigateur

1. Accueil, cartes carrées, cinq scénarios désactivés, sept risques complémentaires et retour aux sources.
2. Carte satellite plein écran, sélection directe d’une quebrada, menus Datos/Capas, inclinaison et retour au nord.
3. Tunjuelo : configuration, compteurs évolutifs, pause/curseur, avant/après, impacts, téléchargement, sauvegarde et réouverture.
4. Glissement : chargement du terrain sélectionné, facteurs, scène 3D, orbite, sources et retour au même instant en pause.
5. Climat : normales et codes, changement de variable, SSP5-8.5 et plages publiées, gestion à long terme et bibliographie.
6. Design Next Step : recherche de l’incertitude humaine, état persistant, export et réouverture.
7. Multirisque : la dimension humaine élevée n’est pas compensée par une faible conséquence économique.
8. Mobile : parcours de pluie et climat sans débordement horizontal. Compteurs économiques et humains prioritaires dans le panneau compact.
9. Requêtes de tuiles externes bloquées : image locale, géographie, catalogue et parcours restent utilisables.

Deux erreurs initiales de sélecteur de test ont été corrigées : la première source peut être un fichier local, et « Fuentes » existe à la fois sur l’accueil et dans une fenêtre. Les tests finaux ciblent la référence EAAB et le dialogue actif. Aucun contournement applicatif n’a été ajouté pour masquer une erreur.

Une vérification visuelle supplémentaire du survol de station sur le Tunjuelo confirme l’affichage immédiat du nom, du type, de l’opérateur, du code CNE et de la mention « sans observations en direct », avec curseur interactif. Capture : `artifacts/v2-station-hover.png`.

## Limites restantes

- L’EAAB fournit la géographie de drainage, pas une simulation d’écoulement. Le dessin de l’eau est un tampon animé, sans hydraulique calculée.
- Les requêtes d’empreintes et la copie cadastrale 2022 ne couvrent pas exhaustivement l’exposition actuelle. Zéro dans un échantillon ne signifie pas zéro risque.
- Le DEM est régional. Sol, épaisseurs, trajectoire, dommages et économie ne sont pas calibrés. Les fonctions humaines ne calculent pas de victimes.
- Les tendances climatiques locales et les extrêmes demandent des séries homogénéisées ; les normales ne suffisent pas.
- Dépendance à WebGL et à l’accès Internet pour l’imagerie détaillée. Le secours local ne remplace pas la résolution des tuiles.
- La compilation signale la taille des blocs MapLibre/Three et de la géographie. Le module Three est chargé à la demande ; une stratégie de tuilage géographique reste pertinente pour une plateforme hébergée à grande échelle.
- Pas de comptes, de backend ou de télémétrie. Sauvegardes et suivi sont locaux au navigateur. Les sources institutionnelles externes peuvent évoluer indépendamment de cette application.

## Artifacts

- `artifacts/playwright-report/index.html` : dernier passage navigateur (régressions ciblées après la suite complète).
- `artifacts/v2-home-latest.png` : accueil desktop.
- `artifacts/v2-landslide-1366.png` : relief isolé et unités conceptuelles.
- `artifacts/v2-mobile-map.png`, `v2-mobile-results.png`, `v2-mobile-climate.png` : version mobile.
- `artifacts/v2-final-errors.json` : erreurs JavaScript de l’inspection visuelle.

Les captures V1 sont conservées comme historique ; les fichiers commençant par `v2-` correspondent à la nouvelle version.
