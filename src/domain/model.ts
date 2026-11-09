import { z } from "zod";
export const statuses = [
  "À préparer",
  "Prête à envoyer",
  "Envoyée",
  "En attente",
  "Entretien",
  "Refusée",
  "Offre reçue",
  "Acceptée",
  "Retirée",
] as const;
export type Status = (typeof statuses)[number];
export const closed = (status: Status) =>
  ["Refusée", "Acceptée", "Retirée"].includes(status);
const id = z.string().uuid();
export const dateSchema = z.iso.date();
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const opportunitySchema = z.object({
  id,
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  url: z
    .string()
    .max(2000)
    .refine((s) => !s || /^https?:\/\//i.test(s), "URL http(s) attendue"),
  status: z.enum(["À étudier", "Intéressante", "Archivée"]),
  country: z.string(),
  city: z.string(),
  salary: z.string(),
  currency: z.string(),
  contract: z.string(),
  sector: z.string(),
  seniority: z.string(),
  visa: z.string(),
  publishedDate: dateSchema.or(z.literal("")),
  deadline: dateSchema.or(z.literal("")),
  notes: z.string(),
  createdAt: z.iso.datetime(),
});
export const applicationSchema = z.object({
  id,
  opportunityId: id,
  status: z.enum(statuses),
  submittedDate: dateSchema.nullable(),
  notes: z.string(),
  createdAt: z.iso.datetime(),
  history: z.array(
    z.object({ at: z.iso.datetime(), status: z.enum(statuses) }),
  ),
});
export const contactSchema = z.object({
  id,
  applicationId: id,
  name: z.string().trim().min(1),
  email: z.string(),
  phone: z.string(),
  role: z.string(),
  notes: z.string(),
});
export const interactionSchema = z.object({
  id,
  applicationId: id,
  kind: z.enum(["E-mail", "Appel", "LinkedIn", "Entretien", "Note"]),
  at: z.string().refine((s) => Number.isFinite(Date.parse(s)), "Date invalide"),
  notes: z.string(),
  preparation: z.string(),
  report: z.string(),
});
export const reminderSchema = z.object({
  id,
  applicationId: id,
  notificationId: z.number().int().positive().max(2147483646),
  dueDate: dateSchema,
  time: timeSchema,
  repeatDaily: z.boolean(),
  state: z.enum(["active", "done", "cancelled"]),
  revision: z.number().int().nonnegative(),
  completedAt: z.iso.datetime().nullable(),
  lastNotifiedDate: dateSchema.nullable(),
});
export const settingsSchema = z.object({
  notifications: z.boolean(),
  defaultTime: timeSchema,
  repeatDaily: z.boolean(),
  privacy: z.boolean(),
  theme: z.enum(["system", "light", "dark"]),
});
export const stateSchema = z.object({
  version: z.literal(1),
  nextNotificationId: z.number().int().positive().max(2147483647),
  opportunities: z.array(opportunitySchema).max(10000),
  applications: z.array(applicationSchema).max(10000),
  contacts: z.array(contactSchema).max(20000),
  interactions: z.array(interactionSchema).max(50000),
  reminders: z.array(reminderSchema).max(20000),
  settings: settingsSchema,
});
export type Opportunity = z.infer<typeof opportunitySchema>;
export type Application = z.infer<typeof applicationSchema>;
export type Reminder = z.infer<typeof reminderSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type Interaction = z.infer<typeof interactionSchema>;
export type State = z.infer<typeof stateSchema>;
export const emptyState = (): State => ({
  version: 1,
  nextNotificationId: 1,
  opportunities: [],
  applications: [],
  contacts: [],
  interactions: [],
  reminders: [],
  settings: {
    notifications: true,
    defaultTime: "18:00",
    repeatDaily: true,
    privacy: false,
    theme: "system",
  },
});
export const newOpportunity = (): Opportunity => ({
  id: crypto.randomUUID(),
  company: "",
  title: "",
  url: "",
  status: "À étudier",
  country: "",
  city: "",
  salary: "",
  currency: "EUR",
  contract: "",
  sector: "",
  seniority: "",
  visa: "",
  publishedDate: "",
  deadline: "",
  notes: "",
  createdAt: new Date().toISOString(),
});
export function validateState(input: unknown): State {
  const s = stateSchema.parse(input);
  const unique = (rows: { id: string }[]) =>
    new Set(rows.map((x) => x.id)).size === rows.length;
  if (
    ![
      s.opportunities,
      s.applications,
      s.contacts,
      s.interactions,
      s.reminders,
    ].every(unique)
  )
    throw new Error("Identifiants en double");
  if (
    new Set(s.reminders.map((x) => x.notificationId)).size !==
      s.reminders.length ||
    s.reminders.some((x) => x.notificationId >= s.nextNotificationId)
  )
    throw new Error("Identifiants de notification invalides");
  if (
    s.applications.some(
      (a) => !s.opportunities.some((o) => o.id === a.opportunityId),
    )
  )
    throw new Error("Offre manquante");
  if (
    [...s.contacts, ...s.interactions, ...s.reminders].some(
      (x) => !s.applications.some((a) => a.id === x.applicationId),
    )
  )
    throw new Error("Candidature manquante");
  if (
    s.applications.some(
      (a) =>
        a.history.length === 0 ||
        a.history.at(-1)?.status !== a.status ||
        (!["À préparer", "Prête à envoyer", "Retirée"].includes(a.status) &&
          !a.submittedDate),
    )
  )
    throw new Error("Historique ou date de dépôt incohérents");
  for (const r of s.reminders)
    if (
      r.state === "active" &&
      closed(s.applications.find((a) => a.id === r.applicationId)!.status)
    )
      throw new Error("Relance active sur une candidature clôturée");
  return s;
}
