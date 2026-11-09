import { type State, type Reminder, closed } from "./model";
import { localDate, plusDays } from "./service";
// Calendar arithmetic preserves the phone's wall clock across DST; never add 24 hours.
export function nextOccurrence(r: Reminder, now = new Date()): Date | null {
  if (r.state !== "active") return null;
  let date = r.dueDate;
  if (date < localDate(now)) date = localDate(now);
  if (!r.repeatDaily && r.lastNotifiedDate) return null;
  let at = new Date(`${date}T${r.time}:00`);
  if (r.lastNotifiedDate === date) {
    if (!r.repeatDaily) return null;
    date = plusDays(date, 1);
    at = new Date(`${date}T${r.time}:00`);
  }
  if (at <= now) {
    // At most one catch-up, never a backlog of missed days.
    if (r.lastNotifiedDate !== date) return new Date(now.getTime() + 5000);
    return null;
  }
  return at;
}
export function reminderPlan(s: State, now = new Date()) {
  if (!s.settings.notifications) return [];
  return s.reminders.flatMap((r) => {
    const a = s.applications.find((a) => a.id === r.applicationId);
    const o = s.opportunities.find((o) => o.id === a?.opportunityId);
    if (!a || !o || closed(a.status)) return [];
    const at = nextOccurrence(r, now);
    return at
      ? [
          {
            id: r.notificationId,
            reminderId: r.id,
            applicationId: a.id,
            revision: r.revision,
            at,
            title: "ApplyFlow — Relance à effectuer",
            body: s.settings.privacy
              ? "Une action vous attend dans ApplyFlow."
              : `Pense à relancer ta candidature chez ${o.company} pour le poste de ${o.title}.`,
          },
        ]
      : [];
  });
}
