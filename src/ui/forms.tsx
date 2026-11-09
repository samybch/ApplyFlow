import { useState, type FormEvent } from "react";
import type {
  State,
  Opportunity,
  Application,
  Reminder,
  Contact,
  Interaction,
} from "../domain/model";
import { statuses, closed } from "../domain/model";
import { localDate } from "../domain/service";
import { Field, Toggle } from "./components";

export function OfferForm({
  value,
  busy,
  save,
}: {
  value: Opportunity;
  busy: boolean;
  save: (o: Opportunity) => Promise<void>;
}) {
  const [v, set] = useState({ ...value });
  const field = (
    key: keyof Opportunity,
    label: string,
    type = "text",
    required = false,
  ) => (
    <Field
      key={key}
      label={label}
      value={v[key]}
      type={type}
      required={required}
      onChange={(value) => set({ ...v, [key]: value })}
    />
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(v);
      }}
    >
      <div className="form-grid">
        {field("company", "Entreprise", "text", true)}
        {field("title", "Intitulé du poste", "text", true)}
        {field("url", "URL de l’offre", "url")}
        <Field
          label="Statut de l’offre"
          value={v.status}
          options={["À étudier", "Intéressante", "Archivée"]}
          onChange={(status) =>
            set({ ...v, status: status as Opportunity["status"] })
          }
        />
        {field("country", "Pays")}
        {field("city", "Ville")}
        {field("salary", "Salaire / fourchette")}
        {field("currency", "Devise")}
        {field("contract", "Type de contrat")}
        {field("sector", "Secteur")}
        {field("seniority", "Séniorité")}
        {field("visa", "Visa / autorisation de travail")}
        {field("publishedDate", "Date de publication", "date")}
        {field("deadline", "Date limite", "date")}
      </div>
      {field("notes", "Notes sur l’offre", "textarea")}
      <button className="primary full" disabled={busy}>
        Enregistrer l’offre
      </button>
    </form>
  );
}
export function StatusForm({
  application: a,
  busy,
  save,
}: {
  application: Application;
  busy: boolean;
  save: (s: Application["status"], date: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(a.status),
    [date, setDate] = useState(a.submittedDate ?? "");
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        void save(status, date);
      }}
    >
      <h3>Suivi de candidature</h3>
      <Field
        label="Statut de candidature"
        value={status}
        options={statuses}
        onChange={(v) => setStatus(v as Application["status"])}
      />
      <Field
        label="Date réelle de dépôt (confirmation manuelle)"
        type="date"
        value={date}
        onChange={setDate}
        required={
          !["À préparer", "Prête à envoyer", "Retirée"].includes(status)
        }
      />
      <button className="primary small" disabled={busy}>
        Mettre à jour le statut
      </button>
    </form>
  );
}
export function Notes({
  value,
  busy,
  save,
}: {
  value: string;
  busy: boolean;
  save: (s: string) => Promise<void>;
}) {
  const [v, set] = useState(value);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(v);
      }}
    >
      <Field label="Notes" type="textarea" value={v} onChange={set} />
      <button className="secondary small" disabled={busy}>
        Enregistrer les notes
      </button>
    </form>
  );
}
export function ReminderForm({
  state,
  applicationId,
  value,
  busy,
  save,
}: {
  state: State;
  applicationId: string;
  value?: Reminder;
  busy: boolean;
  save: (id: string, d: string, t: string, r: boolean) => Promise<void>;
}) {
  const [app, setApp] = useState(applicationId),
    [date, setDate] = useState(value?.dueDate ?? localDate()),
    [time, setTime] = useState(value?.time ?? state.settings.defaultTime),
    [repeat, setRepeat] = useState(
      value?.repeatDaily ?? state.settings.repeatDaily,
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(app, date, time, repeat);
      }}
    >
      {!value && (
        <label className="field">
          <span>Candidature</span>
          <select value={app} onChange={(e) => setApp(e.target.value)}>
            {state.applications
              .filter((a) => a.submittedDate && !closed(a.status))
              .map((a) => {
                const o = state.opportunities.find(
                  (o) => o.id === a.opportunityId,
                )!;
                return (
                  <option value={a.id} key={a.id}>
                    {o.company} — {o.title}
                  </option>
                );
              })}
          </select>
        </label>
      )}
      <Field
        label="Date de relance"
        type="date"
        value={date}
        onChange={setDate}
        required
      />
      <Field
        label="Heure locale"
        type="time"
        value={time}
        onChange={setTime}
        required
      />
      <Toggle
        label="Répéter chaque jour jusqu’à validation"
        checked={repeat}
        onChange={setRepeat}
      />
      <p className="muted">
        Si l’échéance est passée, un seul rappel sera présenté, puis la
        répétition reprendra à l’heure choisie.
      </p>
      <button className="primary full" disabled={busy}>
        Enregistrer la relance
      </button>
    </form>
  );
}
export function ContactForm({
  value,
  applicationId,
  busy,
  save,
}: {
  value?: Contact;
  applicationId: string;
  busy: boolean;
  save: (c: Contact) => Promise<void>;
}) {
  const [v, set] = useState<Contact>(
    value ?? {
      id: crypto.randomUUID(),
      applicationId,
      name: "",
      email: "",
      phone: "",
      role: "",
      notes: "",
    },
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(v);
      }}
    >
      {(
        [
          ["name", "Nom", "text"],
          ["role", "Fonction", "text"],
          ["email", "E-mail", "email"],
          ["phone", "Téléphone", "tel"],
          ["notes", "Notes", "textarea"],
        ] as const
      ).map(([key, label, type]) => (
        <Field
          key={key}
          label={label}
          value={v[key]}
          type={type}
          required={key === "name"}
          onChange={(s) => set({ ...v, [key]: s })}
        />
      ))}
      <button className="primary full" disabled={busy}>
        Enregistrer le contact
      </button>
    </form>
  );
}
export function InteractionForm({
  value,
  applicationId,
  busy,
  save,
}: {
  value?: Interaction;
  applicationId: string;
  busy: boolean;
  save: (i: Interaction) => Promise<void>;
}) {
  const toInput = (s: string) => {
    const d = new Date(s);
    return `${localDate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const [v, set] = useState<Interaction>(
      value ?? {
        id: crypto.randomUUID(),
        applicationId,
        kind: "E-mail",
        at: new Date().toISOString(),
        notes: "",
        preparation: "",
        report: "",
      },
    ),
    [at, setAt] = useState(toInput(v.at));
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void save({ ...v, at: new Date(at).toISOString() });
      }}
    >
      <Field
        label="Type d’interaction"
        value={v.kind}
        options={["E-mail", "Appel", "LinkedIn", "Entretien", "Note"]}
        onChange={(s) => set({ ...v, kind: s as Interaction["kind"] })}
      />
      <Field
        label="Date et heure"
        type="datetime-local"
        value={at}
        onChange={setAt}
        required
      />
      {(["notes", "preparation", "report"] as const).map((key, i) => (
        <Field
          key={key}
          label={["Notes / objet", "Préparation", "Compte rendu"][i]}
          type="textarea"
          value={v[key]}
          onChange={(s) => set({ ...v, [key]: s })}
        />
      ))}
      <button className="primary full" disabled={busy}>
        Enregistrer l’interaction
      </button>
    </form>
  );
}
