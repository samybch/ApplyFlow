# Contribution

Travailler sur une branche, ouvrir une PR vers `main`, ne pas fusionner sans revue. Utiliser `npm ci` pour les versions verrouillées. Prérequis et commandes : README.

La logique métier reste indépendante d’Ionic et de Capacitor. Une nouvelle mutation doit conserver l’historique et les références, passer par `Store.update` et valider l’état. Les sauvegardes sont versionnées : une évolution de schéma doit ajouter une migration explicite et des tests de restauration, sans écraser silencieusement les données existantes.

Exécuter `npm test`, `npm run build`, `npm run test:e2e`, puis les tests JVM, le lint et `assembleDebug` Android. Formater le code TypeScript/React/CSS avec Prettier. Ne pas committer `node_modules`, SDK/JDK, caches Gradle, clés de signature, données personnelles, APK ou exports personnels. La CI publie les APK comme artefacts.

Les tests natifs simulés (Robolectric) et les tests TypeScript ne démontrent pas la livraison effective d’une notification. Documenter séparément les résultats sur émulateur et téléphone physique. Référencer le modèle, Android/One UI, mode batterie, permission de notification et autorisation d’alarme exacte pour toute affirmation sur les rappels.
