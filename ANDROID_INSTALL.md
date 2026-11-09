# Installer sur Samsung Galaxy S24

## Télécharger sans compiler

1. Ouvrir le dépôt GitHub `samybch/ApplyFlow`, puis **Actions**.
2. Ouvrir une exécution réussie du workflow **Tests et APK Android** pour la branche `feature/applyflow-android-mvp` (ou lancer **Run workflow** sur cette branche).
3. Dans **Artifacts**, télécharger **ApplyFlow-debug-APK**. GitHub peut demander d’être connecté.
4. Extraire le ZIP, transférer `app-debug.apk` vers le téléphone et l’ouvrir depuis **Mes fichiers**.
5. Si demandé, autoriser temporairement l’installation d’applications inconnues pour Mes fichiers/le navigateur. Sur certaines versions de One UI, le Bloqueur automatique doit aussi autoriser cette installation.
6. Installer, lancer ApplyFlow, ouvrir **Paramètres** et choisir **Autoriser les notifications**.
7. Utiliser **Tester une notification**, puis attendre environ dix secondes et vérifier réellement la réception.

C’est une version de test signée avec une clé debug, pas une publication Play Store. Les artefacts CI expirent après 30 jours ; relancer le workflow si nécessaire. Le workflow fournit également les rapports des tests et du lint.

## Conservation des données entre APK de test

Chaque runner CI crée normalement une nouvelle clé debug. Une mise à jour d’un APK précédent peut donc être refusée pour signature différente. **Exporter le JSON avant de désinstaller**, puis installer le nouvel APK et restaurer le JSON. Une clé de signature stable pour des mises à jour sans désinstallation est prévue dans la roadmap ; elle ne doit jamais être committée. Ne désinstallez pas une version contenant vos données sans sauvegarde.

## Réglages Samsung

- Paramètres Android → Applications → ApplyFlow → Notifications : autorisées, canal **Relances de candidature** actif.
- Batterie : retirer ApplyFlow des applications en veille profonde si des rappels sont retardés. Selon One UI, choisir une utilisation de batterie non restreinte ou l’ajouter aux applications jamais mises en veille.
- Le mode Ne pas déranger et les réglages du canal peuvent masquer son et bannière tout en conservant une notification dans le volet.
- Une fermeture normale ou le retrait des applications récentes ne doit pas nécessiter de réouverture quotidienne. Un **arrêt forcé** dans les paramètres, une désinstallation ou certaines restrictions constructeur empêchent Android d’exécuter les rappels jusqu’à relance/autorisation.
- L’ordonnanceur utilise les alarmes exactes seulement si Android les autorise déjà ; sinon la notification peut arriver après l’heure souhaitée. La précision à la minute n’est pas garantie sans autorisation, ni sous toutes les restrictions de batterie.

## Compiler soi-même (facultatif)

Installer Node 24, JDK 21 et Android SDK 36 avec build tools 36.0.0. Configurer `ANDROID_HOME` vers le SDK.

```sh
npm ci
npm run android:sync
cd android
./gradlew testDebugUnitTest lintDebug assembleDebug
```

Installer éventuellement par USB : `adb install app/build/outputs/apk/debug/app-debug.apk` depuis `android/`. Autoriser le débogage USB sur le téléphone. Ne pas confondre compilation réussie et validation de réception des notifications.
