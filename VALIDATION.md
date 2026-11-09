# Validation du MVP

## Résultats observés

- Compilation TypeScript/Vite : réussie.
- Vitest + React Testing Library : 28 tests réussis avant l’ajout du cas de sauvegarde à échéances dupliquées ; le total actuel attendu est 29, à confirmer par la CI.
- Playwright/Chromium : 4 scénarios réussis (deux à 384 × 854, deux sur ordinateur). Parcours offre → dépôt confirmé → relance → report → validation → entretien → clôture, persistance après rechargement, confidentialité, heure personnalisée, thèmes, export JSON et rechargement hors ligne.
- JVM : 10 tests de calendrier réussis (18 h, répétition, report, fuseau, DST, rattrapage unique et heure personnalisée).
- Robolectric API 34 : 10 tests du moteur Android réussis, avec SQLite et framework simulé, sans WebView. Permission refusée, unicité du réveil, réconciliation après suppression simulée de l’alarme, publication, confidentialité, clôture, validation/annulation, accès exact facultatif, actions natives et navigation.
- Une exécution complète CI a déjà réussi sur le commit `869742d` : https://github.com/samybch/ApplyFlow/actions/runs/42657021820. Elle a produit un APK de test. Les corrections natives et tests additionnels sont validés par les exécutions suivantes de la branche et de la PR ; utiliser l’artefact de la **dernière exécution réussie correspondant au dernier commit**.

Les nouveaux tests natifs ont détecté une erreur dans la lecture de `PRAGMA busy_timeout` par `execSQL`. Elle a été corrigée avec une requête SQLite avant que les 20 tests natifs ne réussissent.

## Vérifications non réalisées

Aucun smartphone ou émulateur Android n’est connecté. Aucune réception physique, répétition sur deux jours, reprise après véritable redémarrage Android, livraison en Doze ou restriction batterie Samsung n’a été vérifiée. Les simulations Robolectric ne remplacent pas ces essais. La matrice de recette réelle est dans NOTIFICATIONS.md.

La compilation d’un APK, son téléchargement en artefact et la réussite du lint ne prouvent ni son installation sur Galaxy S24, ni la livraison effective d’une notification. Ne pas présenter le bouton de test comme une réception réussie sans observation sur l’appareil.
