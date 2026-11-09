# ApplyFlow ↗

Application personnelle de suivi des candidatures, développée de zéro pour Android (Samsung Galaxy S24 en priorité) avec une interface web pour ordinateur. Fonctionne sans compte, abonnement, API métier ou serveur distant.

## Fonctions du MVP

- Offres : saisie rapide et détaillée, édition, suppression en cascade, recherche, filtres et avertissement prudent de doublon.
- Candidatures : neuf statuts, confirmation manuelle du dépôt, historique daté et notes.
- Contacts recruteurs et journal des e-mails, appels, messages LinkedIn et entretiens avec préparation et compte rendu.
- Relances : date/heure locales, répétition quotidienne jusqu’à validation, report à demain / trois jours / une semaine / date personnalisée, annulation et historique. La clôture d’une candidature arrête ses rappels.
- Tableau de bord, prochains entretiens, activité récente et statistiques avec dénominateurs explicités.
- Sauvegardes JSON versionnées compatibles Android/web, validation avant restauration, export CSV protégé contre les formules.
- Thèmes clair, sombre et système ; navigation inférieure, zones système et gestion du bouton Retour Android.

## Android et APK

Le workflow **Tests et APK Android** compile un APK de test sur chaque push et PR. Le fichier `app-debug.apk` est publié dans l’artefact **ApplyFlow-debug-APK**, après réussite du job Android. Aucun Android Studio n’est nécessaire pour l’installer. Voir [ANDROID_INSTALL.md](ANDROID_INSTALL.md).

Les notifications utilisent `@capacitor/local-notifications` pour les permissions, canaux, rendu et actions. Un ordonnanceur Android natif lit SQLite et reprogramme un unique réveil global, même lorsque la WebView ne fonctionne plus. Voir [NOTIFICATIONS.md](NOTIFICATIONS.md) pour la politique d’heure locale, les permissions et les limites Samsung.

**Important :** la réussite des tests métier, navigateur ou JVM ne démontre pas la réception sur smartphone. Les tests réels à effectuer sont décrits séparément dans [NOTIFICATIONS.md](NOTIFICATIONS.md).

## Développement

Node 24 LTS (minimum 22.12), npm et Java **JDK** 21 pour Android. La pile installée est verrouillée dans `package-lock.json` : React 19.2, Ionic React 9.0.10, Vite 8.3.7, Capacitor 8.6, Local Notifications 8.3.1, SQLite 8.1.1. Android : SDK/target 36, build tools 36.0.0, minimum API 26.

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run android:sync
cd android
./gradlew testDebugUnitTest lintDebug assembleDebug
```

Android produit `android/app/build/outputs/apk/debug/app-debug.apk`. Le web produit `dist/`, qui peut être servi comme site statique ; aucun backend requis. Le stockage web reste local à l’origine du navigateur. Une nouvelle origine (hôte/port) possède un stockage distinct.

## Données et limites

SQLite natif sous Android, IndexedDB sur le web. Les données restent locales et ne sont pas synchronisées automatiquement entre appareils. Exporter le JSON pour les transférer. Désinstaller l’application, effacer son stockage ou les données du navigateur supprime les données locales. L’application propose une sauvegarde des données courantes avant restauration. La confidentialité des notifications masque l’entreprise et le poste ; le stockage local et les exports ne sont pas chiffrés par ApplyFlow.

Le web secondaire ne programme pas de notifications système lorsque le navigateur est fermé. Les rappels indépendants de l’ouverture quotidienne sont une fonction Android. Le shell web de production est mis en cache par un service worker après la première visite réussie ; il peut ensuite être rechargé hors ligne. La toute première visite nécessite le téléchargement des fichiers.

[Architecture](ARCHITECTURE.md) · [Notifications et validation](NOTIFICATIONS.md) · [Contribution](CONTRIBUTING.md) · [Suite](ROADMAP.md)
