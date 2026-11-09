import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { nativeStore } from "../storage/repository";
export const isAndroid = () => Capacitor.getPlatform() === "android";
export async function setupNotifications() {
  if (!isAndroid()) return;
  await LocalNotifications.createChannel({
    id: "reminders",
    name: "Relances de candidature",
    description: "Rappels locaux ApplyFlow",
    importance: 4,
    visibility: 0,
  });
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: "followup",
        actions: [
          { id: "done", title: "Effectuée" },
          { id: "tomorrow", title: "Demain" },
          { id: "custom", title: "Reporter…" },
        ],
      },
    ],
  });
  await nativeStore.reconcile();
}
export async function permissionStatus() {
  if (!isAndroid())
    return "Version web : rappels visibles dans l’application. Notifications système disponibles sur Android.";
  const p = await LocalNotifications.checkPermissions();
  const exact = await LocalNotifications.checkExactNotificationSetting();
  return `Notifications : ${p.display === "granted" ? "autorisées" : "non autorisées"} · alarmes exactes : ${exact.exact_alarm === "granted" ? "autorisées" : "approximatives"}`;
}
export async function requestPermission() {
  if (!isAndroid()) return;
  await LocalNotifications.requestPermissions();
  await nativeStore.reconcile();
}
export async function testNotification() {
  if (!isAndroid())
    throw new Error("Le test de notification système nécessite Android.");
  const p = await LocalNotifications.checkPermissions();
  if (p.display !== "granted")
    throw new Error("Autorisez les notifications avant le test.");
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 2147483647,
        title: "ApplyFlow — Test",
        body: "Les notifications sont autorisées. Vérifiez la réception sur votre smartphone.",
        channelId: "reminders",
        schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true },
        isExactNotification: false,
      },
    ],
  });
}
export async function openAndroidSettings() {
  if (isAndroid()) await nativeStore.openSettings();
}
