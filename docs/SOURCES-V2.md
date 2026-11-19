# Sources, décisions et limites — V2

État du 15 novembre 2026. Ce document complète l’historique V1 et correspond à la nouvelle interface. Les références détaillées sont intégrées dans **Fuentes**, par contexte, et dans **Datos**. Les 43 entrées distinguent données effectivement intégrées, documents consultés et sources encore à intégrer.

## Hydrographie

Services publics EAAB : [microcuenca](https://acueducto.com.co/wassigue/arcgis/rest/services/EAAB/microcuenca/MapServer/0), [subcuenca](https://acueducto.com.co/wassigue/arcgis/rest/services/EAAB/subcuenca/MapServer/0), [corrienteagua](https://acueducto.com.co/wassigue/arcgis/rest/services/EAAB/corrienteagua/MapServer/0).

- 19 microbassins de montagne sélectionnables ; 14 sous-bassins intersectés avec les localités du corpus.
- 2 621 tronçons récupérés par identifiants puis lots. Les noms et codes EAAB sont conservés.
- Couverture des 19 localités : **99,99173 %** ; différence de bord : **0,070612 km²**. Aucun comblement arbitraire. Le fichier des localités exclut Sumapaz.
- Les limites de bassin représentent le drainage, pas une emprise d’inondation. Le corridor du río Bogotá est celui d’un cours d’eau récepteur ; ses bâtiments peuvent appartenir à des sous-bassins voisins du drainage direct.
- Les terrains de mouvements en masse sont des secteurs d’exploration. L’inventaire IDIGER 2016 est une couche historique distincte ; cliquer un polygone montre ses codes originaux.

Les erreurs de raccordement, la hiérarchie, les exutoires et la couverture au-delà du corpus restent à valider. Les données de couverture et les géométries servies ont leurs propres liens dans l’application.

## Bâtiments et relief

Les empreintes proviennent de la [copie universitaire publique UDFJC](https://www.arcgis.com/home/item.html?id=3c6cc789cf8147878f7086dd4d27f74f), déclarée en août 2022, avec attributs Catastro. Le service officiel de constructions n’a pas pu être utilisé dans cet environnement. Cette copie n’est donc pas présentée comme un cadastre actualisé.

Les requêtes sont limitées à des fenêtres locales et à 8 000 ou 24 000 enregistrements avant filtrage ; le rendu est plafonné à 4 500 éléments. **Ce n’est pas un inventaire exhaustif ni un échantillon statistiquement représentatif.** Les 32 922 objets des fichiers territoriaux ne constituent pas 32 922 bâtiments uniques : certains secteurs/corridors se recouvrent entre risques. Tunjuelo comporte 3 384 empreintes, Salitre 3 555 et le corridor Bogotá 1 264.

Hauteurs : attribut de hauteur valide, sinon estimation par nombre d’étages ×3 m. Les fonctions « logement », « commerce » et « équipement » sont des hypothèses d’interface fondées sur l’aire, sans reconnaissance des usages réels. Aucun propriétaire ni attribut nominatif n’est importé.

Le [DEM Terrarium](https://registry.opendata.aws/terrain-tiles/) fournit cinq terrains de 65×65 échantillons au zoom 13. La scène interpole ces altitudes et les exagère verticalement ×1,35. Les bâtiments utilisent leurs positions et dimensions géographiques ; la représentation de volume est simplifiée. Un MDT géotechnique, les niveaux phréatiques et les paramètres de sol restent nécessaires pour une modélisation physique.

Les unités colorées et les coupes du sous-sol sont **conceptuelles**. Le [SGC](https://www2.sgc.gov.co/sgc/mapas/paginas/geoportal.aspx) fournit géologie et géomécanique ; la [couche IGAC de sols de Cundinamarca](https://mapas.igac.gov.co/server/rest/services/agrologia/mapageneraldesuelosdepartamentodecundinamarca/MapServer) documente la pédologie à une échelle générale. Aucune cohésion, friction ou épaisseur géotechnique n’est déduite arbitrairement de ces catalogues.

## Climat observé

Les **265 lignes Bogotá** viennent du CSV original `Normales_Climatológicas_de_Colombia_20260610.csv`, fourni dans le corpus E2. Son empreinte SHA-256 figure dans `climate-normals.json`. Aucune valeur n’est interpolée ni agrégée par localité. Les fichiers dérivés d’affectation par proximité au centroïde d’une localité n’ont pas été retenus : ils ne constituent pas des moyennes spatiales climatologiques.

Les normales 1961–1990, 1971–2000, 1981–2010 et 1991–2020 se recouvrent. La comparaison n’établit ni tendance statistiquement significative ni attribution causale. El Dorado est nommé et situé de manière identique, mais codé 21205790 en 1981–2010 et 21205791 dans les autres normales. Le rapprochement est affiché et sa continuité instrumentale reste à vérifier.

Références :

- [Normales IDEAM](https://www.ideam.gov.co/sala-de-prensa/informes/Normales-clim%C3%A1ticas-est%C3%A1ndar) : valeurs mensuelles et annuelles par station.
- [Caractérisation climatologique IDIGER](https://webantigua.idiger.gov.co/documents/20182/558631/Caract%2BClimatol%C3%B3gica%2B-%2BBogot%C3%A1%2B%281%29.pdf/b5dbcea1-d291-40a0-8ee8-71ca322edcab), 69 pages : saisonnalité bimodale avec variations spatiales, ENOS, maxima sur 24 h de 18 stations entre 1981–2010. La plage 51–100 mm n’est ni un seuil d’alerte ni une tendance des extrêmes.
- [SaluData, changement climatique](https://saludata.saludcapital.gov.co/osb/indicadores/cambio-climatico/), indicateur RMCAB publié en juin 2026 : tendance urbaine approximative +0,06 °C/an sur 2009–premier trimestre 2026. Aucune extrapolation jusqu’à 2100.
- [Note technique IDEAM 2023-003](https://bart.ideam.gov.co/meteorologia/NOTAS_TECNICAS/NT_IDEAM-2023-003_TENDENCIAS_CC_1981-2020.pdf) : cadre de tendances nationales, sans transformer ses résultats en courbes locales inventées.

Les évolutions des pluies intenses et du calendrier saisonnier demandent des séries quotidiennes/subhoraires homogénéisées, des indices Rx1day/Rx5day, une gestion des ruptures, de l’autocorrélation et d’ENOS. Ces résultats ne sont pas fabriqués à partir des normales.

## Prospective climatique

[Escenarios de cambio climático para la ciudad de Bogotá, D.C., período 2021 a 2100](https://bibliotecadigital.sire.gov.co/items/2ff7f427-93de-4c8e-9679-80fea71fbd83), Guillermo Eduardo Armenta, IDIGER, janvier 2026, 247 pages. Copie locale E2 examinée et [document public intégral](https://backbiblio.sire.gov.co/server/api/core/bitstreams/f6644a19-8b5c-4b17-a9c3-d1a5aa96ec3a/content).

- Méthode pp. 30–37 : 25 modèles CMIP6, quatre SSP, référence 1991–2020, huit décennies. 69 stations de pluie retenues parmi 141 examinées : 27 IDEAM, 6 IDIGER, 8 CAR, 28 EAAB. Sept stations pour température/humidité ; ERA5-Land complète rayonnement et vent.
- Température moyenne p. 58 : plages territoriales transcrites pour quatre fenêtres de vingt ans. En 2081–2100 : SSP1-2.6 +0,5 à +1,5 °C ; SSP2-4.5 +2 à +3 °C ; SSP3-7.0 +2,5 à +4 °C ; SSP5-8.5 +3 à +5 °C. Les barres ne sont pas des intervalles de confiance.
- Pluie pp. 41–44 : synthèse d’augmentation annuelle +5 à +20 % en première moitié du siècle, avec réductions possibles dans certains secteurs de Sumapaz ; +10 à +50 % en fin de siècle. Aucun intervalle unique n’est inventé pour 2061–2080. Le résumé de pluie couvre plusieurs SSP et ne prétend pas fournir un intervalle propre à chaque bouton.
- Sept variables et conclusions pp. 243–244. La finesse d’une carte de downscaling n’atteste pas une précision physique par bâtiment.

Les horizons 2030/2050/2100 de la vue de gestion sont une **esquisse de planification**, pas des résultats calculés de dommages. Aucun pourcentage annuel n’est appliqué aux IDF ni aux pertes de la démonstration.

## Calculs de démonstration

`model-assumptions.json` expose les règles numériques. Les emprises d’eau sont des tampons progressifs autour des cours d’eau ; elles ignorent hydraulique, ouvrages et conservation de masse. La trajectoire de glissement est prescrite entre une zone haute et basse du relief, sans calcul de stabilité ou de propagation. La progression n’est pas une vitesse physique.

Le rendu cartographique, les couleurs 3D et les compteurs utilisent la même classification temporelle. Les pertes directes supposent 44 % du remplacement pour dommage élevé, 12 % pour dommage moyen ; les pertes indirectes valent 22 % du direct. Les occupants et valeurs sont synthétiques. Les sommes n’ont ni validité actuarielle ni probabilité annuelle associée.

L’exposition humaine critique compte les occupants hypothétiques des bâtiments à dommage élevé. Elle **ne calcule ni décès ni probabilité de mort**. Les fonctions de létalité, l’évacuation, les horaires et la vulnérabilité humaine constituent l’action HUM-01 de Design Next Step.

Les 19 actions de ce registre précisent l’état actuel, ce qui manque, le responsable proposé et les critères de clôture. Les états de suivi enregistrés dans le navigateur sont déclaratifs.
