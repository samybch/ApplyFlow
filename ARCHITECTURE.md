# Architecture

## Couches

- `src/domain/model.ts` : schéma versionné Zod, types et invariants de références.
- `src/domain/service.ts` : transitions, CRUD, cascade, doublons, métriques et actions de relance.
- `src/domain/reminders.ts` : politique de calendrier testable côté TypeScript, contenu public/privé.
- `src/storage/repository.ts` : contrat de stockage, IndexedDB web, initialisation SQLite via le plugin Capacitor et pont natif atomique Android.
- `src/storage/backup.ts` : export JSON/CSV et validation stricte avant restauration.
- `src/notifications/service.ts` : permissions, canaux, actions et notification de test.
- `src/ui/` : présentation Ionic React, formulaires, fichiers, navigation et orchestration des transactions métier.
- `android/app/src/main/java/fr/applyflow/app/` : ordonnanceur, horloge de calendrier pure, récepteur système et plugin de persistance.

Aucune donnée fictive n’est injectée au premier lancement. Les tests créent leurs propres fixtures.

## Persistance et concurrence

Le MVP conserve un document métier versionné dans une ligne `app_state(id, payload, revision)` de `applyflowSQLite.db`. Le format identique est conservé dans un objet IndexedDB sur le web. Ce choix rend le remplacement par sauvegarde atomique et simplifie la cohérence des cascades entre entités ; pour de grands historiques, une future migration normalisera les tables.

Le plugin SQLite communautaire crée et initialise la base native non chiffrée puis ferme sa connexion. Le pont `ApplyFlowStore` effectue les lectures et écritures suivantes avec SQLite Android. Une révision monotone protège les écritures optimistes contre les modifications natives et les autres vues ; le service relit et réapplique la commande en cas de conflit. Les opérations de l’interface sont sérialisées. Les récepteurs, actions Android et écritures du pont partagent un verrou et des transactions SQLite.

Une erreur de lecture ne crée jamais silencieusement une base vide. La restauration valide le format, la version, les champs, les dates, les références, les identifiants, l’historique et l’absence de relance active d’une candidature clôturée. Une mauvaise sauvegarde est rejetée avant toute mutation.

Les identifiants métiers sont des UUID. `notificationId` est un entier Android stable alloué par `nextNotificationId`, conservé en SQLite et dans le JSON. Une modification/report augmente `revision` de la relance pour ignorer les actions provenant d’un ancien contenu.

## Calendrier Android

Un seul `PendingIntent` de réveil global est enregistré avec `AlarmManager`. Lors du réveil, le récepteur lit la base, sélectionne les relances actives arrivées à échéance, enregistre la date locale de présentation, les affiche via le gestionnaire natif officiel de Local Notifications, puis calcule le prochain réveil. Aucun service JS ou serveur n’est nécessaire.

Les calculs natifs font autorité pour Android ; `ReminderClock` est couvert par les tests JVM (heure locale, report, fuseau, DST, rattrapage, répétition). Les tests TypeScript couvrent la politique métier analogue. Les événements de démarrage, mise à jour, horloge et fuseau ainsi que le retour au premier plan reconstruisent le réveil depuis SQLite.

## Statistiques

Les dénominateurs sont les candidatures avec date de dépôt confirmée. Une réponse est la première entrée de l’historique parmi entretien, refus, offre reçue ou acceptation. Le délai moyen porte sur cette première entrée, en jours depuis la date de dépôt. Un appel ou e-mail consigné seul n’est pas assimilé automatiquement à une réponse. Le taux d’entretien utilise l’historique ; le taux de refus utilise le statut courant. Aucun taux n’est présenté comme une mesure issue d’un serveur ou d’un import automatique.

## Sécurité et confidentialité

Pas de compte, télémétrie, police distante, scraping ou clé API. Les liens d’offres sont limités à HTTP(S), et les textes utilisateurs sont rendus par React. Le partage des sauvegardes est une action explicite via le sélecteur système. La sauvegarde automatique Android est désactivée : le transfert s’effectue par JSON, sans promesse de restauration distante. Les exports peuvent contenir des informations sensibles ; ils ne sont pas chiffrés. Le CSV échappe guillemets et retours et désamorce les cellules commençant par un caractère de formule.
