import {
  type State,
  type Opportunity,
  type Status,
  type Reminder,
  closed,
  opportunitySchema,
  validateState,
} from "./model";
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function plusDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
const normalized = (v: string) =>
  v.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
export function duplicates(s: State, o: Opportunity) {
  return s.opportunities.filter(
    (x) =>
      x.id !== o.id &&
      ((o.url &&
        x.url &&
        normalized(x.url.replace(/\/$/, "")) ===
          normalized(o.url.replace(/\/$/, ""))) ||
        (normalized(x.company) === normalized(o.company) &&
          normalized(x.title) === normalized(o.title) &&
          normalized(x.city) === normalized(o.city))),
  );
}
export function saveOpportunity(s: State, o: Opportunity) {
  o = opportunitySchema.parse(o);
  const i = s.opportunities.findIndex((x) => x.id === o.id);
  if (i < 0) s.opportunities.push(o);
  else s.opportunities[i] = o;
}
export function createApplication(s: State, opportunityId: string) {
  if (!s.opportunities.some((o) => o.id === opportunityId))
    throw new Error("Offre introuvable");
  if (
    s.applications.some(
      (a) => a.opportunityId === opportunityId && !closed(a.status),
    )
  )
    throw new Error("Une candidature active existe déjà pour cette offre");
  const at = new Date().toISOString();
  const a = {
    id: crypto.randomUUID(),
    opportunityId,
    status: "À préparer" as Status,
    submittedDate: null,
    notes: "",
    createdAt: at,
    history: [{ at, status: "À préparer" as Status }],
  };
  s.applications.push(a);
  return a;
}
export function changeStatus(
  s: State,
  id: string,
  status: Status,
  submittedDate?: string,
) {
  const a = s.applications.find((x) => x.id === id);
  if (!a) throw new Error("Candidature introuvable");
  if (
    !["À préparer", "Prête à envoyer", "Retirée"].includes(status) &&
    !(submittedDate || a.submittedDate)
  )
    throw new Error("Confirmez la date réelle de dépôt");
  if (submittedDate) {
    if (submittedDate > localDate())
      throw new Error("La date de dépôt ne peut pas être future");
    a.submittedDate = submittedDate;
  }
  if (status !== a.status) {
    a.status = status;
    a.history.push({ at: new Date().toISOString(), status });
  }
  if (closed(status))
    s.reminders
      .filter((r) => r.applicationId === id && r.state === "active")
      .forEach((r) => {
        r.state = "cancelled";
        r.revision++;
      });
}
export function addReminder(
  s: State,
  applicationId: string,
  dueDate: string,
  time = s.settings.defaultTime,
  repeatDaily = s.settings.repeatDaily,
): Reminder {
  const a = s.applications.find((x) => x.id === applicationId);
  if (!a?.submittedDate || closed(a.status))
    throw new Error("La candidature doit être envoyée et active");
  if (
    s.reminders.some(
      (r) =>
        r.applicationId === applicationId &&
        r.dueDate === dueDate &&
        r.time === time &&
        r.state === "active",
    )
  )
    throw new Error("Une relance identique existe déjà");
  if (s.nextNotificationId >= 2147483647)
    throw new Error("Limite des identifiants atteinte");
  const r: Reminder = {
    id: crypto.randomUUID(),
    applicationId,
    notificationId: s.nextNotificationId++,
    dueDate,
    time,
    repeatDaily,
    state: "active",
    revision: 0,
    completedAt: null,
    lastNotifiedDate: null,
  };
  s.reminders.push(r);
  return r;
}
export function finishReminder(
  s: State,
  id: string,
  state: "done" | "cancelled",
) {
  const r = s.reminders.find((x) => x.id === id);
  if (!r) throw new Error("Relance introuvable");
  r.state = state;
  r.revision++;
  r.completedAt = state === "done" ? new Date().toISOString() : null;
}
export function postpone(
  s: State,
  id: string,
  dueDate: string,
  time?: string,
  repeatDaily?: boolean,
) {
  const r = s.reminders.find((x) => x.id === id);
  if (!r || r.state !== "active") throw new Error("Relance inactive");
  if (
    s.reminders.some(
      (x) =>
        x.id !== id &&
        x.applicationId === r.applicationId &&
        x.state === "active" &&
        x.dueDate === dueDate &&
        x.time === (time ?? r.time),
    )
  )
    throw new Error("Une relance identique existe déjà");
  r.dueDate = dueDate;
  r.time = time ?? r.time;
  r.repeatDaily = repeatDaily ?? r.repeatDaily;
  r.lastNotifiedDate = null;
  r.revision++;
}
export function deleteApplication(s: State, id: string) {
  s.applications = s.applications.filter((a) => a.id !== id);
  s.reminders = s.reminders.filter((r) => r.applicationId !== id);
  s.contacts = s.contacts.filter((c) => c.applicationId !== id);
  s.interactions = s.interactions.filter((c) => c.applicationId !== id);
}
export function deleteOpportunity(s: State, id: string) {
  s.applications
    .filter((a) => a.opportunityId === id)
    .forEach((a) => deleteApplication(s, a.id));
  s.opportunities = s.opportunities.filter((o) => o.id !== id);
}
export function edit(s: State, fn: (draft: State) => void) {
  const next = structuredClone(s);
  fn(next);
  return validateState(next);
}
export function metrics(s: State) {
  const sent = s.applications.filter((a) => a.submittedDate);
  const responded = sent.filter((a) =>
    a.history.some((h) =>
      ["Entretien", "Refusée", "Offre reçue", "Acceptée"].includes(h.status),
    ),
  );
  const interviews = sent.filter((a) =>
    a.history.some((h) => h.status === "Entretien"),
  );
  const delays = responded.map((a) => {
    const h = a.history.find((h) =>
      ["Entretien", "Refusée", "Offre reçue", "Acceptée"].includes(h.status),
    )!;
    return Math.max(
      0,
      (Date.parse(h.at) - Date.parse(a.submittedDate! + "T00:00:00")) /
        86400000,
    );
  });
  return {
    sent: sent.length,
    active: s.applications.filter((a) => !closed(a.status)).length,
    response: sent.length
      ? Math.round((responded.length / sent.length) * 100)
      : 0,
    interview: sent.length
      ? Math.round((interviews.length / sent.length) * 100)
      : 0,
    rejection: sent.length
      ? Math.round(
          (sent.filter((a) => a.status === "Refusée").length / sent.length) *
            100,
        )
      : 0,
    delay: delays.length
      ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
      : null,
  };
}
