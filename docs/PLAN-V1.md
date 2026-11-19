# IDIGER Risk Model Platform — interprétation et plan de V1

## Intention
Démontrer une expérience de modélisation future, en espagnol, sans exécuter de moteur scientifique. Priorité à la lisibilité, à la qualité cartographique et aux transitions. La carte demeure le socle de l'interface. Les trois parcours partagent une grammaire : choisir un territoire → définir un scénario → explorer aléa/exposition → comprendre les impacts. Aucune alerte opérationnelle ni estimation validée ne doit être suggérée.

## Parcours et décisions
1. **Accueil** : logo IDIGER original, titre fort, carte de Bogotá en fond, trois portes d'entrée, ajout de risque désactivé, entrée transversale multirisque, accès Design Next Step.
2. **Territoire** : bassins ou secteurs survolables, sélection par carte ou liste accessible, zoom progressif et inclinaison. Panneau compact avec population/bâtiments de démonstration et stations du catalogue IDIGER réel. Attribution spatiale aux périmètres illustratifs signalée. EAAB : données IDF locales utilisées ; inventaire géolocalisé de stations à consolider, jamais inventé en tant que réel.
3. **Scénario hydrologique** : fréquent / sévère / extrême exploratoire, durée réglable, courbe IDF selon les coefficients EAAB du corpus (point de référence, association au bassin non validée). Hyétogramme illustratif. Le scénario extrême est une majoration et n'est pas un nouveau temps de retour.
4. **Résultat** : lecture temporelle animée, pause/reprise, curseur, retour avant/après, vue menace/risque. Bâtiments 3D synthétiques, catégories explicites, emprise d'eau scénarisée. Les résultats et valeurs économiques proviennent d'une fiction déterministe commune et restent cohérents.
5. **Mouvements en masse** : polygones d'inventaire local historique avec provenance, secteurs de présentation synthétiques, pluie récente/antécédente, saturation, pente, séisme, modification du talus et drainage. Distinction facteurs déclenchants/conditions. Scène Three.js 3D manipulable avec terrain, rupture, propagation et dépôt animés, bâtiments et pluie. Ni solveur géotechnique ni reconstruction d'un événement réel.
6. **Impacts** : personnes exposées (pas de victimes estimées), bâtiments par dommage illustratif, pertes directes/indirectes et décomposition, service essentiel et confiance. Export JSON traçable et fiche imprimable.
7. **Multirisque** : matrice gravité/probabilité 5 × 5, quatre dimensions non compensables, confiance et priorité de modélisation distinctes. Pas d'indice physique commun ou de moyenne qui masque l'impact humain. Selon la note UNDRR fournie, références institutionnelles liées.
8. **Design Next Step** : registre exploitable de données manquantes, hypothèses, responsables et validations. Catégories, recherche, état local persistant, catalogue de sources, export du registre.

## Architecture
React + TypeScript + Vite. MapLibre pour carte, couches locales GeoJSON, extrusion des bâtiments et navigation 3D. Three.js chargé à la demande pour scène de glissement. Polices embarquées. Pas de clé API requise. Données locales reproductibles via script Python et provenance versionnée. Fond OpenFreeMap/OSM et imagerie Esri ; relief public si disponible. Fond local de secours pour démo sans réseau. Aucune transmission de documents privés.

## Séquence de réalisation
- [x] Lire brief, diagnostic intégré, note UNDRR, fiche EAAB, document mouvements de masse, EasyLoc et Model Bogotá.
- [x] Rechercher sources primaires IDIGER/SIRE/EAAB/IDECA/SGC/USGS/UNDRR.
- [x] Importer catalogue stations, IDF, limites IDECA et inventaire historique.
- [x] Construire socle cartographique et système de design.
- [x] Réaliser les trois parcours et animations.
- [x] Construire impacts, multirisque, registre et sources.
- [x] Tester parcours complets au navigateur, responsive, clavier, réseau indisponible, cohérence données, build.
- [x] Livrer lancement local, documentation, captures et limitations restantes.

## Critères de réception
Trois parcours terminables sans rechargement ; carte interactive avec survol/sélection ; scènes lisibles ; seuils et IDF tracés ; stations réelles distinguées ; données simulées toujours identifiables ; export utilisable ; aucune impasse à part l'ajout de risque explicitement demandé ; animations désactivables ; tests de cohérence et de navigation ; rendu vérifié en captures desktop et mobile.
