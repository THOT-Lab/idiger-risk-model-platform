# Vérification de la V1 — 15 novembre 2026

## Résultats

- **Compilation de production réussie** : TypeScript strict et Vite. La version compilée est servie localement sur le port 5180.
- **25 tests unitaires réussis** : cohérence bâtiments / personnes / pertes pour les 17 territoires, reproductibilité, réponse aux paramètres, géométries fermées, formule et coefficient IDF, catalogue réel et identifiants historiques.
- **8 parcours Playwright réussis**, également exécutés sur la compilation de production : carte et sélection directe, scénario torrentiel et sauvegarde après rechargement, inondation, facteurs et scène 3D de glissement, multirisque non compensable, registre et export, parcours mobile avec sauvegarde, services cartographiques externes bloqués.
- **Inspection visuelle Chromium** : 1512 × 982, 1366 × 768, 390 × 844 ; accueil, carte, résultats, impacts, 3D, matrice et sources. Pas de débordement horizontal observé sur le parcours mobile testé.
- **Vérifications complémentaires** : focus dans une fenêtre modale, fermeture par Échap, préférence de réduction des mouvements, activation/désactivation du relief régional, export imprimable PDF et maintien de l'image cartographique locale sans réseau externe.
- Aucune erreur JavaScript non interceptée dans les sessions d'inspection enregistrées. `npm audit --omit=dev` : aucune vulnérabilité signalée au moment du contrôle.
- Syntaxe du lanceur macOS vérifiée avec `zsh -n`.

## Artifacts

- `artifacts/01-home.png` à `artifacts/17-offline-context.png` : vues de référence.
- `artifacts/16-landslide-deposit.png` : scène 3D en fin de scénario sur écran de portable.
- `artifacts/ejemplo-impacto.pdf` : exemple de fiche imprimée depuis l'application.
- `artifacts/final-inspection.json` : contrôles complémentaires et erreurs JavaScript.
- `artifacts/playwright-report/index.html` : rapport des huit parcours de navigateur.

## Limites restantes

- Chromium testé ; Safari, Firefox et des appareils mobiles physiques restent à vérifier.
- Les tests de clavier et de responsive ne constituent pas un audit d'accessibilité complet. Les tests d'usage avec les équipes IDIGER sont inscrits dans UX-01.
- MapLibre et Three.js produisent des blocs JavaScript volumineux : avertissement Vite de taille, sans échec de compilation. Le chargement de la scène 3D est différé ; sa fluidité dépend du matériel et de WebGL.
- Le fond externe, les polices de libellés et le relief peuvent être indisponibles. La V1 garde les données et l'image de contexte locales ; elle n'est pas une application installable avec serveur hors ligne embarqué.
- Les imports géographiques ont été transformés et simplifiés pour la présentation. Précision, actualité, CRS, licences et nomenclature doivent être validés avant un usage institutionnel ou opérationnel.
- Aucun résultat ne constitue une validation scientifique de l'aléa, du risque ou des pertes. Les hypothèses et actions correspondantes sont détaillées dans l'application et dans `SOURCES-ET-HYPOTHESES.md`.

Le guide de lancement et le parcours de présentation sont dans `README.md`.
