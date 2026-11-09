# Notifications locales et répétition quotidienne

## Règles livrées

- Activation métier par défaut, sous réserve de l’autorisation Android 13+ et du canal.
- Heure initiale : **18 h 00 dans le fuseau local du smartphone**. Heure et date personnalisables à la création et au report. Modifier l’heure par défaut concerne les nouvelles relances ; les choix existants sont conservés.
- Répétition quotidienne activée par défaut ; désactivation possible pour chaque relance. La répétition suit son heure personnalisée.
- Une relance doit appartenir à une candidature dont le dépôt a été confirmé et qui n’est pas clôturée.
- Validation, annulation, refus, acceptation et retrait arrêtent la répétition. Un report conserve l’identifiant stable mais change la révision et reprend à la nouvelle date.
- Une seule présentation par date locale et relance ; un téléphone rallumé ne rejoue pas tous les jours manqués. Si l’heure du jour est déjà passée, au plus un rattrapage est proposé, puis l’échéance suivante revient à l’heure habituelle.
- Contenu par défaut : **ApplyFlow — Relance à effectuer**, puis `Pense à relancer ta candidature chez KPMG pour le poste de Pricing Senior Analyst.` L’option de confidentialité remplace le message par `Une action vous attend dans ApplyFlow.` Les notifications ont une visibilité privée sur l’écran verrouillé.
- Toucher ouvre la bonne candidature. Les actions **Effectuée** et **Demain** sont appliquées nativement à SQLite ; elles ouvrent l’application. **Reporter…** ouvre le formulaire de la candidature, qui permet une date/heure personnalisée ; les raccourcis trois jours et une semaine sont également proposés dans la fiche et dans Relances. Android peut ne présenter qu’une partie des actions avant expansion de la notification.

## Implémentation hors ligne

`@capacitor/local-notifications` gère permission, canal, rendu, actions et bouton de test. L’app fournit un ordonnanceur natif Java pour éviter toute dépendance au lancement quotidien du JavaScript. Ce récepteur lit le document SQLite partagé, marque `lastNotifiedDate`, affiche les échéances via le gestionnaire natif du plugin puis réarme **un seul réveil global** pour la plus proche échéance. Aucun `setInterval` JS ne porte la récurrence Android et aucune liste infinie de notifications futures n’est construite.

Chaque relance conserve `notificationId` (entier Android stable), UUID métier, révision, échéance locale et dernière date présentée. Les actions d’une ancienne révision sont ignorées. Les données de présentation sont reconstruites à partir de SQLite au déclenchement, et non conservées indéfiniment dans une alarme contenant un ancien nom d’entreprise.

À chaque écriture validée, les notifications affichées sont retirées et le réveil recalculé ; cela évite de laisser un contenu sensible ou une action périmée après modification/restauration. Le démarrage après déverrouillage, la mise à jour du paquet, les changements de fuseau/horloge et le changement d’autorisation d’alarme exacte entraînent une réconciliation. L’ouverture et le retour au premier plan la relancent également. La permission de notification et l’activation du canal sont revérifiées avant programmation et présentation.

L’enregistrement de la date de présentation précède le rendu Android : une mort du processus dans cet intervalle peut perdre une occurrence, mais ne produit pas une rafale de doublons. La relance récurrente reste éligible le jour suivant. Ce compromis privilégie une présentation au plus une fois par jour.

## Contraintes Android et Samsung

`RTC_WAKEUP` repose sur le calendrier local et les calculs utilisent `LocalDate`/`ZoneId`. Un changement d’heure d’été conserve l’heure murale ; un horaire inexistant est décalé selon les règles du fuseau. La garde par date locale empêche une double présentation pendant l’heure d’automne répétée.

Si l’accès aux alarmes exactes est présent, l’app utilise `setExactAndAllowWhileIdle`. Sinon elle utilise `setAndAllowWhileIdle`, sans contourner les restrictions. Les quotas Doze, restrictions utilisateur/constructeur, canal désactivé et permissions refusées peuvent retarder ou empêcher la présentation. Le refus des notifications ne doit pas provoquer de boucle d’alarme : les données sont conservées et la programmation reprend après autorisation et retour à l’app.

Le réveil global évite les limites Samsung sur le nombre d’alarmes par application. Un arrêt forcé empêche les récepteurs de fonctionner tant que le système n’autorise pas à nouveau le paquet. Les alarmes ne peuvent pas être garanties à la minute ni fonctionner pendant que le téléphone est éteint. Les mécanismes de réparation respectent Android et ne garantissent pas une reprise sans ouverture après toutes les formes de révocation/arrêt forcé. Le redémarrage nécessite que le stockage utilisateur soit déverrouillé.

## Section 17 — validation

Les suites automatisées TypeScript, React, navigateur et JVM sont des preuves de logique et de comportement dans leur environnement, **pas des preuves de livraison effective sur un smartphone**.

| Cas obligatoire | Automatisation métier / JVM | Validation Android réelle à effectuer |
|---|---|---|
| Premier rappel à 18 h | `domain.test.ts`, `ReminderClockTest` | Programmer et attendre 18 h sur le téléphone |
| Heure personnalisée | TS et JVM | Échéance proche avec heure personnalisée |
| Répétition quotidienne | TS et JVM | Laisser la relance active sur deux jours, app fermée |
| Validation / annulation | TS ; moteur natif | Action depuis le volet et absence au jour suivant |
| Candidature refusée, retirée ou acceptée | TS | Clôturer et vérifier l’absence de réveil/présentation |
| Report, identifiant stable, nouvelle échéance | TS et JVM | Tester demain, trois jours, semaine et date personnalisée |
| Aucun doublon | TS et JVM | Réouvrir plusieurs fois, modifier, puis attendre |
| Redémarrage / restauration | Stockage et politique de réconciliation | Redémarrer, déverrouiller et attendre sans réouvrir |
| Application fermée | Récepteur natif indépendant de JS | Retirer des applications récentes, attendre l’alarme |
| Permissions refusées | Garde native et tests Android simulés | Refuser/réautoriser et tester le canal désactivé |
| Navigation | Routage natif avec applicationId | Toucher chaque notification de deux candidatures |
| Fuseau et DST | JVM | Changer le fuseau du téléphone et vérifier l’heure locale |
| Doze et batterie Samsung | Aucun mock ne le prouve | Tester veille prolongée et plusieurs modes batterie |

Voir le compte rendu de validation de la PR pour les commandes réellement exécutées. En l’absence de téléphone/émulateur connecté, les cases Android réelles restent **non exécutées**. Le bouton de test ne constitue une preuve que si une personne observe la notification sur l’appareil. Utiliser des données de test et conserver date, modèle, version Android/One UI, permissions, mode batterie et heure observée lors de la recette.
