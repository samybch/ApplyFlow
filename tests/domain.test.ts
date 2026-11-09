import { describe, it, expect } from "vitest";
import { emptyState, newOpportunity, validateState } from "../src/domain/model";
import {
  addReminder,
  changeStatus,
  createApplication,
  deleteApplication,
  deleteOpportunity,
  duplicates,
  finishReminder,
  metrics,
  postpone,
  saveOpportunity,
} from "../src/domain/service";
import { nextOccurrence, reminderPlan } from "../src/domain/reminders";
import { exportCSV, exportJSON, parseBackup } from "../src/storage/backup";
export function fixture() {
  const s = emptyState();
  const o = newOpportunity();
  o.company = "KPMG";
  o.title = "Pricing Senior Analyst";
  saveOpportunity(s, o);
  const a = createApplication(s, o.id);
  changeStatus(s, a.id, "Envoyée", "2026-01-01");
  const r = addReminder(s, a.id, "2026-02-10");
  return { s, o, a, r };
}
describe("offres et candidatures", () => {
  it("crée, modifie et supprime avec cascade", () => {
    const { s, o, a } = fixture();
    o.city = "Paris";
    saveOpportunity(s, o);
    expect(s.opportunities[0].city).toBe("Paris");
    s.contacts.push({
      id: crypto.randomUUID(),
      applicationId: a.id,
      name: "Nom",
      role: "",
      email: "",
      phone: "",
      notes: "",
    });
    deleteOpportunity(s, o.id);
    expect(s.opportunities).toHaveLength(0);
    expect(s.applications).toHaveLength(0);
    expect(s.contacts).toHaveLength(0);
    expect(s.reminders).toHaveLength(0);
  });
  it("exige une date de dépôt manuelle et trace les statuts", () => {
    const s = emptyState(),
      o = newOpportunity();
    o.company = "A";
    o.title = "B";
    saveOpportunity(s, o);
    const a = createApplication(s, o.id);
    expect(() => changeStatus(s, a.id, "Envoyée")).toThrow("Confirmez");
    changeStatus(s, a.id, "Envoyée", "2026-01-01");
    changeStatus(s, a.id, "Entretien");
    expect(a.history.map((x) => x.status)).toEqual([
      "À préparer",
      "Envoyée",
      "Entretien",
    ]);
    expect(a.submittedDate).toBe("2026-01-01");
  });
  it("ne crée pas de candidature active en double", () => {
    const { s, o } = fixture();
    expect(() => createApplication(s, o.id)).toThrow("déjà");
  });
  it("signale prudemment les doublons sans supprimer de données", () => {
    const { s, o } = fixture();
    const candidate = { ...o, id: crypto.randomUUID(), company: "  kpmg " };
    expect(duplicates(s, candidate)).toHaveLength(1);
    expect(s.opportunities).toHaveLength(1);
  });
  it("calcule les taux sur les dépôts confirmés", () => {
    const { s, a } = fixture();
    changeStatus(s, a.id, "Entretien");
    expect(metrics(s)).toMatchObject({
      sent: 1,
      response: 100,
      interview: 100,
      rejection: 0,
    });
    deleteApplication(s, a.id);
    expect(metrics(s).response).toBe(0);
  });
});
describe("planification métier simulée, aucune preuve de réception Android", () => {
  it("programme le premier rappel à 18 h locale", () => {
    const { s } = fixture();
    const p = reminderPlan(s, new Date("2026-02-10T12:00:00"));
    expect(p).toHaveLength(1);
    expect(p[0].at.getHours()).toBe(18);
    expect(p[0].at.getDate()).toBe(10);
    expect(p[0].body).toContain("KPMG");
  });
  it("répète le lendemain à la même heure après émission", () => {
    const { r } = fixture();
    r.lastNotifiedDate = "2026-02-10";
    expect(nextOccurrence(r, new Date("2026-02-10T18:01:00"))).toEqual(
      new Date("2026-02-11T18:00:00"),
    );
  });
  it("ne répète pas après validation ou annulation", () => {
    for (const mode of ["done", "cancelled"] as const) {
      const { s, r } = fixture();
      finishReminder(s, r.id, mode);
      expect(reminderPlan(s)).toHaveLength(0);
    }
  });
  it.each(["Refusée", "Retirée", "Acceptée"] as const)(
    "annule après clôture %s",
    (status) => {
      const { s, r, a } = fixture();
      changeStatus(s, a.id, status);
      expect(r.state).toBe("cancelled");
      expect(reminderPlan(s)).toHaveLength(0);
    },
  );
  it("reprend à la date reportée et conserve le lien Android", () => {
    const { s, r } = fixture();
    const id = r.notificationId;
    postpone(s, r.id, "2026-03-01", "09:15");
    const p = reminderPlan(s, new Date("2026-02-15T12:00:00"));
    expect(p[0].at).toEqual(new Date("2026-03-01T09:15:00"));
    expect(p[0].id).toBe(id);
    expect(p[0].revision).toBe(1);
  });
  it("refuse une relance identique et un report en double", () => {
    const { s, a, r } = fixture();
    expect(() => addReminder(s, a.id, r.dueDate)).toThrow("identique");
    const other = addReminder(s, a.id, "2026-03-01");
    expect(() => postpone(s, other.id, r.dueDate)).toThrow("identique");
    expect(reminderPlan(s)).toHaveLength(2);
  });
  it("respecte l’heure personnalisée et le défaut modifié", () => {
    const { s, a, r } = fixture();
    s.settings.defaultTime = "08:45";
    const r2 = addReminder(s, a.id, "2026-02-11");
    expect(r.time).toBe("18:00");
    expect(r2.time).toBe("08:45");
  });
  it("ne remplit pas de file pour les jours manqués", () => {
    const { s, r } = fixture();
    r.dueDate = "2025-01-01";
    const now = new Date("2026-02-10T20:00:00");
    expect(reminderPlan(s, now)).toHaveLength(1);
    expect(reminderPlan(s, now)[0].at.getTime() - now.getTime()).toBe(5000);
  });
  it("désactive la répétition par relance", () => {
    const { r } = fixture();
    r.repeatDaily = false;
    r.lastNotifiedDate = "2026-02-10";
    expect(nextOccurrence(r)).toBeNull();
  });
  it("ne planifie rien lorsque les notifications sont désactivées", () => {
    const { s } = fixture();
    s.settings.notifications = false;
    expect(reminderPlan(s)).toEqual([]);
  });
  it("masque les données sensibles", () => {
    const { s } = fixture();
    s.settings.privacy = true;
    expect(reminderPlan(s)[0].body).not.toContain("KPMG");
    expect(reminderPlan(s)[0].body).not.toContain("Pricing");
  });
  it("la réconciliation est déterministe, une occurrence par relance", () => {
    const { s } = fixture();
    const now = new Date("2026-02-10T12:00:00");
    expect(reminderPlan(s, now)).toEqual(reminderPlan(s, now));
    expect(new Set(reminderPlan(s, now).map((x) => x.id)).size).toBe(1);
  });
});
describe("sauvegardes", () => {
  it("effectue un aller-retour JSON complet", () => {
    const { s } = fixture();
    expect(parseBackup(exportJSON(s))).toEqual(s);
  });
  it("refuse version inconnue, référence orpheline, identifiants dupliqués et date impossible", () => {
    const { s } = fixture();
    for (const mutate of [
      (s: any) => (s.version = 2),
      (s: any) => (s.applications[0].opportunityId = crypto.randomUUID()),
      (s: any) => s.reminders.push(s.reminders[0]),
      (s: any) => (s.reminders[0].dueDate = "2026-02-31"),
    ]) {
      const copy = structuredClone(s);
      mutate(copy);
      expect(() => validateState(copy)).toThrow();
    }
  });
  it("refuse un fichier étranger", () => {
    expect(() => parseBackup('{"version":1}')).toThrow("ApplyFlow");
  });
  it("échappe CSV et désamorce les formules", () => {
    const { s } = fixture();
    s.opportunities[0].company = '=HYPERLINK("x")';
    expect(exportCSV(s)).toContain('"\'=HYPERLINK(""x"")"');
  });
});
