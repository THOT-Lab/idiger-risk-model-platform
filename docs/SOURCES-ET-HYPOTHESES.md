> Historique V1. Pour l’état courant, consulter [Sources et hypothèses V2](SOURCES-V2.md).

# Corpus, traçabilité et décisions de V1

Consultation et intégration réalisées le 15 novembre 2026. L'application distingue les données réellement intégrées des références identifiées et des jeux encore à obtenir. La liste complète est également accessible dans « Datos y fuentes ».

## Corpus local consulté

- `Desktop/DiagV3-Integrado.docx` : diagnostic intégré, acteurs, ressources et besoins de modélisation.
- `Desktop/Next Step IDIGER/Aplicacion_UNDRR_Evaluacion_Multirriesgo_Bogota.docx` : principes de gravité non compensable, probabilité, confiance et priorité de modélisation.
- Fiche de travail EAAB du dossier `Next Step IDIGER/Mesas` : réseau, capacités et échanges de données à organiser.
- `Desktop/AI_VScode/CENTRAL/SOFT/dashboard/idiger/Modelisacion de moviliento de masa.docx` : besoins de caractérisation des mouvements en masse.
- Applications EasyLoc et Model Bogotá de CENTRAL : références d'interface et de cartographie, inspectées sans modification.
- `Desktop/IDIGER/EXE` : catalogue hydrométéorologique, coefficients IDF, localités et inventaire SIG historique. Les chemins précis et les empreintes sont dans `public/data/provenance.json`.

Les textes extraits pour l'étude restent dans `docs/research/`. Ils ne sont pas copiés dans `dist/`. Le logo officiel a été extrait du rapport fourni, sans redessiner la signature institutionnelle.

## Sources publiques de référence

| Source | Utilisation / limite |
| --- | --- |
| [IDIGER · Sistema de Alerta de Bogotá](https://www.sire.gov.co/web/sab) | Contexte de surveillance ; aucun flux temps réel intégré |
| [SIRE · POT Decreto 555 de 2021](https://app10.sire.gov.co/server/rest/services/Z_Normativo_Vigente/POT_Bogota_Dec_555_2021/MapServer) | Service identifié pour la zonification actuelle ; accès non exploitable durant l'intégration, couches non récupérées |
| [Cuenca Bogotá D.C. · Datos Abiertos](https://datosabiertos.bogota.gov.co/dataset/cuenca-bogota-d-c) | Source à intégrer pour remplacer les contours schématiques |
| [SGC · Geoportal / SIMMA](https://srvags.sgc.gov.co/PortalWeb/Elementos-web/Geoportal/sistema/index.html) | Inventaires géoscientifiques et besoin de nomenclature officielle |
| [USGS · Landslide Types and Processes](https://pubs.usgs.gov/fs/2004/3072/fs-2004-3072.html) | Typologie, eau, séismes, interventions et charges ; justification des facteurs proposés |
| [USGS · Rainfall-Induced Landslides](https://www.usgs.gov/programs/landslide-hazards/science/overview-rainfall-induced-landslides) | Rôle de la pluie antécédente, des conditions hydriques et de la pression interstitielle |
| [UNDRR · National Disaster Risk Assessment](https://www.undrr.org/publication/national-disaster-risk-assessment-guide-national-practitioners) | Guide actualisé à considérer dans la validation ; la matrice concrète de V1 est une proposition, pas un barème certifié UNDRR |
| [EAAB](https://www.acueducto.com.co/) | Réseau et modernisation ; coordonnées des stations EAAB encore à obtenir |
| [OpenFreeMap](https://openfreemap.org/) / [OpenStreetMap](https://www.openstreetmap.org/copyright) | Fond vectoriel de contexte, style sombre adapté |
| [Esri World Imagery](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) | Imagerie satellite et image de contexte locale ; attributions affichées |
| [Mapzen / AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) | Relief régional optionnel ; ne remplace pas un MDT d'ingénierie |

Les indisponibilités des services publics n'ont pas été remplacées par de faux jeux officiels. L'inventaire de 2016 est présenté comme historique, les bassins comme illustratifs, et les stations comme un catalogue daté à confirmer. Les autorisations et conditions de diffusion de chaque couche devront être confirmées avant une publication institutionnelle (action OPS-01).

## Principaux choix de représentation

**Territoires et exposition.** Sept bassins torrentiels, cinq bassins d'inondation et cinq secteurs de pente. Les limites, statistiques de population et bâtiments sont synthétiques. Les stations sont rattachées spatialement aux contours illustratifs ; faute de station intérieure, les stations voisines sont annoncées comme telles. Ce rattachement sera à refaire avec les bassins officiels.

**Pluie.** Formule du corpus : `i = C1 × (d + Xo)^C2`, avec durée en minutes et intensité en mm/h. Cumul = `i × d / 60`. Fréquent T=5 ans, sévère T=50 ans, extrême exploratoire = 1,3 × T=100 ans. Le point 0 est commun aux démonstrations ; sa pertinence géographique n'est pas validée. L'hyétogramme et l'expansion d'eau sont illustratifs.

**Mouvements en masse.** Pluie, saturation, pente, secousse, intervention sur le talus et drainage modifient un indicateur narratif. La pente est une condition, pas un événement déclencheur. La scène propose rupture, propagation, dépôt et coloration de bâtiments ; aucune cohésion, pression de pores, vitesse ou distance de propagation physique n'est résolue. Le terrain est procédural, avec relief exagéré. Les résultats chiffrés reposent sur l'échantillon cartographique, pas sur un comptage des objets de cette maquette 3D.

**Dommages et pertes.** Échantillonnage reproductible par territoire ; une même règle produit coloration finale, comptages et pertes cartographiques. Les pertes directes représentent 44 % de la valeur synthétique pour le dommage élevé et 12 % pour le moyen ; l'indirect représente 22 % du direct. Ce sont des conventions graphiques, pas des fonctions de vulnérabilité observées. Les personnes exposées ne sont pas présentées comme des victimes.

**Multirisque.** Quatre dimensions, gravité égale au maximum, protection explicite du niveau humain critique. Probabilité illustrative sur un horizon commun de cinq ans, indépendante des temps de retour de pluie. Confiance et priorité d'investissement en modélisation séparées de la gravité. Les cascades sont expliquées sans ajouter une deuxième fois leurs pertes.

**Stockage.** Jusqu'à trente scénarios et états du registre dans le navigateur local ; aucune synchronisation entre appareils. Les exportations JSON permettent de conserver une fiche hors navigateur. La compilation de production ne contient pas les rapports privés d'étude.

Les seize actions dans `src/data/gaps.ts` donnent, pour chacun de ces choix, l'hypothèse, les données ou travaux nécessaires, les acteurs pressentis et le critère d'acceptation.
