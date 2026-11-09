import { useEffect, useRef, useState } from "react";
import { IonApp, IonPage, IonContent, IonIcon } from "@ionic/react";
import {
  gridOutline,
  briefcaseOutline,
  albumsOutline,
  notificationsOutline,
  settingsOutline,
  addOutline,
  arrowForwardOutline,
  searchOutline,
  checkmarkCircleOutline,
} from "ionicons/icons";
import { App as CapacitorApp } from "@capacitor/app";
import {
  type State,
  type Opportunity,
  type Application,
  type Reminder,
  type Contact,
  type Interaction,
  statuses,
  closed,
  newOpportunity,
} from "../domain/model";
import {
  addReminder,
  changeStatus,
  createApplication,
  deleteApplication,
  deleteOpportunity,
  duplicates,
  finishReminder,
  localDate,
  metrics,
  plusDays,
  postpone,
  saveOpportunity,
} from "../domain/service";
import { createRepository, Store, nativeStore } from "../storage/repository";
import { exportCSV, exportJSON, parseBackup } from "../storage/backup";
import {
  setupNotifications,
  isAndroid,
  permissionStatus,
  requestPermission,
  testNotification,
  openAndroidSettings,
} from "../notifications/service";
import { saveFile } from "./files";
import { Empty, Field, fmt, Modal, Toggle } from "./components";
import {
  OfferForm,
  StatusForm,
  Notes,
  ReminderForm,
  ContactForm,
  InteractionForm,
} from "./forms";
import type { Tab } from "./types";
import { Dashboard } from "./Dashboard";
type Editor =
  | { kind: "offer"; value: Opportunity }
  | { kind: "reminder"; applicationId: string; value?: Reminder }
  | { kind: "contact"; applicationId: string; value?: Contact }
  | { kind: "interaction"; applicationId: string; value?: Interaction }
  | null;
const tabs: [Tab, string, string][] = [
  ["dashboard", "Vue d’ensemble", gridOutline],
  ["offers", "Opportunités", briefcaseOutline],
  ["applications", "Candidatures", albumsOutline],
  ["reminders", "Relances", notificationsOutline],
  ["settings", "Paramètres", settingsOutline],
];
export function App() {
  const [state, setState] = useState<State | null>(null),
    [tab, setTab] = useState<Tab>("dashboard"),
    [selected, setSelected] = useState<string | null>(null),
    [editor, setEditor] = useState<Editor>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("Toutes"),
    [permission, setPermission] = useState(""),
    [stats, setStats] = useState(false),
    [busy, setBusy] = useState(false);
  const store = useRef<Store | null>(null),
    loadId = useRef(0),
    fileInput = useRef<HTMLInputElement>(null);
  const guard = async (fn: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const update = async (fn: (s: State) => void) => {
    if (!store.current) throw new Error("Stockage indisponible");
    const s = await store.current.update(fn);
    setState(s);
  };
  const setSetting = <K extends keyof State["settings"]>(
    key: K,
    value: State["settings"][K],
  ) => {
    ++loadId.current;
    setState((current) =>
      current
        ? { ...current, settings: { ...current.settings, [key]: value } }
        : current,
    );
    void guard(async () => {
      try {
        await update((s) => {
          s.settings[key] = value;
        });
      } catch (e) {
        if (store.current) setState(await store.current.read());
        throw e;
      }
    });
  };
  useEffect(() => {
    let disposed = false;
    let cleanup: () => void = () => {};
    const reload = async () => {
      if (!store.current) return;
      const i = ++loadId.current;
      const s = await store.current.read();
      if (!disposed && i === loadId.current) setState(s);
      if (isAndroid()) {
        await nativeStore.reconcile();
        const nav = await nativeStore.consumeNavigation();
        if (nav.applicationId && !disposed) {
          setSelected(nav.applicationId);
          setTab("applications");
          if (nav.custom) {
            const r = s.reminders.find(
              (r) =>
                r.applicationId === nav.applicationId && r.state === "active",
            );
            if (r)
              setEditor({
                kind: "reminder",
                applicationId: r.applicationId,
                value: r,
              });
          }
        }
      }
    };
    const init = async () => {
      try {
        const repo = await createRepository();
        if (disposed) return;
        store.current = new Store(repo);
        await reload();
        await setupNotifications();
        if (isAndroid()) setPermission(await permissionStatus());
      } catch (e) {
        if (!disposed)
          setError(
            `Impossible de charger les données : ${e instanceof Error ? e.message : e}`,
          );
      }
    };
    void init();
    const onVisible = () => {
      if (document.visibilityState === "visible")
        void reload().catch((e) => setError(String(e)));
    };
    document.addEventListener("visibilitychange", onVisible);
    const onStorage = () => void reload().catch((e) => setError(String(e)));
    window.addEventListener("focus", onStorage);
    if (isAndroid()) {
      void CapacitorApp.addListener("appStateChange", (e) => {
        if (e.isActive) onStorage();
      }).then((h) => {
        if (disposed) void h.remove();
        else cleanup = () => void h.remove();
      });
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") onStorage();
    }, 60000);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onStorage);
      clearInterval(timer);
      cleanup();
    };
  }, []);
  useEffect(() => {
    const theme = state?.settings.theme ?? "system";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [state?.settings.theme]);
  useEffect(() => {
    if (!isAndroid()) return;
    const p = CapacitorApp.addListener("backButton", () => {
      if (editor) setEditor(null);
      else if (selected) setSelected(null);
      else if (tab !== "dashboard") setTab("dashboard");
      else void CapacitorApp.minimizeApp();
    });
    return () => {
      void p.then((h) => h.remove());
    };
  }, [editor, selected, tab]);
  const go = (t: Tab) => {
    setTab(t);
    setSelected(null);
    setFilter("Toutes");
    setQuery("");
    setStats(false);
  };
  const heading = tabs.find((t) => t[0] === tab)![1];
  const action = (fn: () => Promise<unknown>) => () => void guard(fn);
  const confirmDelete = (message: string, fn: (s: State) => void) => {
    if (window.confirm(message))
      void guard(async () => {
        await update(fn);
        setSelected(null);
      });
  };
  const openApp = (id: string) => {
    go("applications");
    setSelected(id);
  };
  const reminderCard = (r: Reminder) => {
    const a = state!.applications.find((a) => a.id === r.applicationId)!,
      o = state!.opportunities.find((o) => o.id === a.opportunityId)!;
    const late = r.dueDate < localDate() && r.state === "active";
    return (
      <article className="card reminder-card" key={r.id}>
        <div className="card-top">
          <span className={`badge ${late ? "amber" : "green"}`}>
            {r.state === "done"
              ? "Effectuée"
              : r.state === "cancelled"
                ? "Annulée"
                : late
                  ? "En retard"
                  : r.dueDate === localDate()
                    ? "Aujourd’hui"
                    : "À venir"}
          </span>
          <span className="muted">{r.time}</span>
        </div>
        <button className="text-link title-link" onClick={() => openApp(a.id)}>
          {o.company}
        </button>
        <p>{o.title}</p>
        <p className="muted">
          {fmt(r.dueDate)} ·{" "}
          {r.repeatDaily ? "Rappel quotidien" : "Rappel unique"}
        </p>
        {r.completedAt && (
          <p className="muted">Effectuée le {fmt(r.completedAt)}</p>
        )}
        {r.state === "active" && (
          <>
            <div className="row wrap">
              <button
                className="primary small"
                disabled={busy}
                onClick={action(() =>
                  update((s) => finishReminder(s, r.id, "done")),
                )}
              >
                <IonIcon icon={checkmarkCircleOutline} /> Effectuée
              </button>
              <button
                className="secondary small"
                onClick={() =>
                  setEditor({
                    kind: "reminder",
                    applicationId: r.applicationId,
                    value: r,
                  })
                }
              >
                Reporter / modifier
              </button>
              <button
                className="text-link danger"
                disabled={busy}
                onClick={action(() =>
                  update((s) => finishReminder(s, r.id, "cancelled")),
                )}
              >
                Annuler
              </button>
            </div>
            <div className="row wrap snooze">
              {[
                [1, "Demain"],
                [3, "Dans 3 jours"],
                [7, "Dans une semaine"],
              ].map(([n, label]) => (
                <button
                  className="text-link"
                  key={n}
                  disabled={busy}
                  onClick={action(() =>
                    update((s) =>
                      postpone(s, r.id, plusDays(localDate(), Number(n))),
                    ),
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </article>
    );
  };
  if (!state)
    return (
      <IonApp>
        <IonPage>
          <main className="loading">
            <h1>
              ApplyFlow
              <span>
                <IonIcon icon={arrowForwardOutline} />
              </span>
            </h1>
            {error ? (
              <p role="alert">{error}</p>
            ) : (
              <p>Ouverture de votre espace…</p>
            )}
          </main>
        </IonPage>
      </IonApp>
    );
  const m = metrics(state),
    activeReminders = state.reminders
      .filter((r) => r.state === "active")
      .sort((a, b) => (a.dueDate + a.time).localeCompare(b.dueDate + b.time));
  const due = activeReminders.filter((r) => r.dueDate <= localDate());
  const interviews = state.interactions
    .filter(
      (i) =>
        i.kind === "Entretien" &&
        Date.parse(i.at) >= Date.now() &&
        !closed(
          state.applications.find((a) => a.id === i.applicationId)!.status,
        ),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  const a = state.applications.find((a) => a.id === selected),
    o = state.opportunities.find((o) => o.id === a?.opportunityId);
  const search = (company: string, title: string) =>
    `${company} ${title}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase());
  return (
    <IonApp>
      <IonPage>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              ApplyFlow
              <span>
                <IonIcon icon={arrowForwardOutline} />
              </span>
            </div>
            <div className="workspace-label">VOTRE ESPACE CARRIÈRE</div>
            <nav aria-label="Navigation principale">
              {tabs.map(([id, label, icon]) => (
                <button
                  key={id}
                  aria-current={tab === id ? "page" : undefined}
                  className={tab === id ? "active" : ""}
                  onClick={() => go(id)}
                >
                  <IonIcon icon={icon} />
                  <span>{label}</span>
                  {id === "reminders" && due.length > 0 && <b>{due.length}</b>}
                </button>
              ))}
            </nav>
            <div className="local-note">
              <span className="status-dot" /> Vos données restent ici
              <p>Hors ligne. Sans compte. À vous.</p>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <div className="mobile-brand">
                ApplyFlow
                <span>
                  <IonIcon icon={arrowForwardOutline} />
                </span>
              </div>
              <span className="breadcrumb">
                Mon espace <span>/</span> {heading}
              </span>
              <span className="offline">
                <span className="status-dot" /> Stockage local
              </span>
            </header>
            <IonContent>
              <main className="main-content">
                {error && (
                  <div className="alert error" role="alert">
                    {error}
                    <button
                      aria-label="Fermer l’erreur"
                      onClick={() => setError("")}
                    >
                      ×
                    </button>
                  </div>
                )}
                {notice && (
                  <div className="alert success" role="status">
                    {notice}
                    <button
                      aria-label="Fermer le message"
                      onClick={() => setNotice("")}
                    >
                      ×
                    </button>
                  </div>
                )}
                <section className="page-heading">
                  <div>
                    <p className="eyebrow">
                      {new Intl.DateTimeFormat("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }).format(new Date())}
                    </p>
                    <h1>
                      {a && o
                        ? o.company
                        : stats
                          ? "Vos statistiques"
                          : heading}
                    </h1>
                    <p className="muted">
                      {tab === "dashboard"
                        ? "Chaque candidature vous rapproche de la suite."
                        : tab === "offers"
                          ? "Les opportunités qui méritent votre attention."
                          : tab === "applications"
                            ? "Gardez le fil, du premier envoi à la prochaine étape."
                            : tab === "reminders"
                              ? "Le bon suivi, au bon moment."
                              : "Un espace à votre rythme."}
                    </p>
                  </div>
                  {tab !== "settings" && (
                    <button
                      className="primary"
                      onClick={() => {
                        if (tab === "reminders") {
                          const eligible = state.applications.find(
                            (a) => a.submittedDate && !closed(a.status),
                          );
                          if (eligible)
                            setEditor({
                              kind: "reminder",
                              applicationId: eligible.id,
                            });
                          else
                            setError(
                              "Créez et envoyez une candidature avant d’ajouter une relance.",
                            );
                        } else
                          setEditor({ kind: "offer", value: newOpportunity() });
                      }}
                    >
                      <IonIcon icon={addOutline} />
                      {tab === "reminders"
                        ? "Nouvelle relance"
                        : "Ajouter une offre"}
                    </button>
                  )}
                </section>
                {tab === "dashboard" && (
                  <Dashboard
                    state={state}
                    stats={stats}
                    setStats={setStats}
                    go={go}
                    openApp={openApp}
                    reminderCard={reminderCard}
                  />
                )}
                {tab === "offers" && (
                  <>
                    <div className="toolbar">
                      <label className="search">
                        <IonIcon icon={searchOutline} />
                        <input
                          aria-label="Rechercher une opportunité"
                          placeholder="Entreprise, intitulé du poste…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Filtrer les opportunités"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        {[
                          "Toutes",
                          "À étudier",
                          "Intéressante",
                          "Archivée",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </div>
                    <div className="cards-grid">
                      {state.opportunities
                        .filter(
                          (o) =>
                            search(o.company, o.title) &&
                            (filter === "Toutes" || o.status === filter),
                        )
                        .map((o) => (
                          <article className="card offer-card" key={o.id}>
                            <div className="card-top">
                              <span className="company-avatar">
                                {o.company.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="badge">{o.status}</span>
                            </div>
                            <h3>{o.company}</h3>
                            <p>{o.title}</p>
                            <p className="muted">
                              {[o.city, o.country, o.contract]
                                .filter(Boolean)
                                .join(" · ") || "Détails à compléter"}
                            </p>
                            {o.salary && (
                              <p>
                                {o.salary} {o.currency}
                              </p>
                            )}
                            {o.url && (
                              <a href={o.url} target="_blank" rel="noreferrer">
                                Voir l’offre ↗
                              </a>
                            )}
                            <div className="row wrap card-actions">
                              <button
                                className="primary small"
                                disabled={busy}
                                onClick={action(async () => {
                                  let id = "";
                                  await update((s) => {
                                    id = createApplication(s, o.id).id;
                                  });
                                  openApp(id);
                                })}
                              >
                                Créer une candidature
                              </button>
                              <button
                                className="secondary small"
                                onClick={() =>
                                  setEditor({ kind: "offer", value: o })
                                }
                              >
                                Modifier
                              </button>
                              <button
                                className="text-link danger"
                                onClick={() =>
                                  confirmDelete(
                                    "Supprimer cette offre et toutes ses candidatures, contacts et relances ?",
                                    (s) => deleteOpportunity(s, o.id),
                                  )
                                }
                              >
                                Supprimer
                              </button>
                            </div>
                          </article>
                        ))}
                    </div>
                    {!state.opportunities.length && (
                      <Empty title="Votre prochaine opportunité commence ici">
                        Ajoutez une offre, puis suivez votre candidature à votre
                        rythme.
                      </Empty>
                    )}
                  </>
                )}
                {tab === "applications" && !a && (
                  <>
                    <div className="toolbar">
                      <label className="search">
                        <IonIcon icon={searchOutline} />
                        <input
                          aria-label="Rechercher une candidature"
                          placeholder="Rechercher une candidature…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Filtrer les candidatures"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        {["Toutes", ...statuses].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="card application-list">
                      {state.applications
                        .filter((a) => {
                          const o = state.opportunities.find(
                            (o) => o.id === a.opportunityId,
                          )!;
                          return (
                            search(o.company, o.title) &&
                            (filter === "Toutes" || a.status === filter)
                          );
                        })
                        .map((a) => {
                          const o = state.opportunities.find(
                            (o) => o.id === a.opportunityId,
                          )!;
                          return (
                            <button
                              className="application-row"
                              key={a.id}
                              onClick={() => setSelected(a.id)}
                            >
                              <span className="company-avatar">
                                {o.company.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="application-name">
                                <strong>{o.company}</strong>
                                <span>{o.title}</span>
                              </span>
                              <span className="badge">{a.status}</span>
                              <span className="muted submitted">
                                {a.submittedDate
                                  ? fmt(a.submittedDate)
                                  : "Dépôt à confirmer"}
                              </span>
                              <span>→</span>
                            </button>
                          );
                        })}
                      {!state.applications.length && (
                        <Empty title="Aucune candidature pour le moment">
                          Créez une candidature depuis l’onglet Opportunités.
                        </Empty>
                      )}
                    </div>
                  </>
                )}
                {tab === "applications" && a && o && (
                  <>
                    <button
                      className="text-link back"
                      onClick={() => setSelected(null)}
                    >
                      ← Toutes les candidatures
                    </button>
                    <div className="detail-title">
                      <h2>{o.title}</h2>
                      <span className="badge green">{a.status}</span>
                      <button
                        className="text-link"
                        onClick={() => setEditor({ kind: "offer", value: o })}
                      >
                        Modifier l’offre
                      </button>
                    </div>
                    <div className="two-columns">
                      <div>
                        <StatusForm
                          key={a.id + a.status}
                          application={a}
                          busy={busy}
                          save={(status, date) =>
                            guard(() =>
                              update((s) =>
                                changeStatus(s, a.id, status, date),
                              ),
                            )
                          }
                        />
                        <div className="card">
                          <h3>Notes de candidature</h3>
                          <Notes
                            key={a.id + a.notes}
                            value={a.notes}
                            busy={busy}
                            save={(notes) =>
                              guard(() =>
                                update((s) => {
                                  s.applications.find(
                                    (x) => x.id === a.id,
                                  )!.notes = notes;
                                }),
                              )
                            }
                          />
                        </div>
                        <div className="card">
                          <div className="section-heading">
                            <h3>Contacts</h3>
                            <button
                              className="text-link"
                              onClick={() =>
                                setEditor({
                                  kind: "contact",
                                  applicationId: a.id,
                                })
                              }
                            >
                              Ajouter un contact
                            </button>
                          </div>
                          {state.contacts
                            .filter((c) => c.applicationId === a.id)
                            .map((c) => (
                              <div className="sub-record" key={c.id}>
                                <strong>{c.name}</strong>
                                <p>
                                  {c.role} {c.email} {c.phone}
                                </p>
                                <p>{c.notes}</p>
                                <button
                                  className="text-link"
                                  onClick={() =>
                                    setEditor({
                                      kind: "contact",
                                      applicationId: a.id,
                                      value: c,
                                    })
                                  }
                                >
                                  Modifier
                                </button>
                                <button
                                  className="text-link danger"
                                  onClick={() =>
                                    confirmDelete(
                                      "Supprimer ce contact ?",
                                      (s) => {
                                        s.contacts = s.contacts.filter(
                                          (x) => x.id !== c.id,
                                        );
                                      },
                                    )
                                  }
                                >
                                  Supprimer
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                      <div>
                        <div className="card">
                          <h3>Détails de l’opportunité</h3>
                          <dl>
                            {[
                              [
                                "Lieu",
                                [o.city, o.country].filter(Boolean).join(", "),
                              ],
                              [
                                "Salaire",
                                o.salary ? `${o.salary} ${o.currency}` : "",
                              ],
                              ["Contrat", o.contract],
                              ["Secteur", o.sector],
                              ["Séniorité", o.seniority],
                              ["Visa", o.visa],
                              ["Publication", o.publishedDate],
                              ["Date limite", o.deadline],
                            ].map(([l, v]) => (
                              <div key={l}>
                                <dt>{l}</dt>
                                <dd>{v || "Non précisé"}</dd>
                              </div>
                            ))}
                          </dl>
                          {o.url && (
                            <a href={o.url} target="_blank" rel="noreferrer">
                              Ouvrir l’offre ↗
                            </a>
                          )}
                          <p className="preserve">{o.notes}</p>
                        </div>
                        <div className="card">
                          <h3>Historique des statuts</h3>
                          {a.history.map((h, i) => (
                            <div className="history" key={i}>
                              <span className="activity-dot" />
                              <span>{h.status}</span>
                              <time>{fmt(h.at)}</time>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="section-heading">
                      <h2>Relances</h2>
                      {!closed(a.status) && a.submittedDate && (
                        <button
                          className="secondary"
                          onClick={() =>
                            setEditor({ kind: "reminder", applicationId: a.id })
                          }
                        >
                          + Ajouter une relance
                        </button>
                      )}
                    </div>
                    <div className="cards-grid">
                      {state.reminders
                        .filter((r) => r.applicationId === a.id)
                        .map(reminderCard)}
                    </div>
                    <div className="section-heading">
                      <h2>Interactions & entretiens</h2>
                      <button
                        className="secondary"
                        onClick={() =>
                          setEditor({
                            kind: "interaction",
                            applicationId: a.id,
                          })
                        }
                      >
                        Ajouter une interaction
                      </button>
                    </div>
                    {state.interactions
                      .filter((i) => i.applicationId === a.id)
                      .sort((a, b) => b.at.localeCompare(a.at))
                      .map((i) => (
                        <article className="card" key={i.id}>
                          <div className="card-top">
                            <h3>{i.kind}</h3>
                            <time>
                              {new Date(i.at).toLocaleString("fr-FR")}
                            </time>
                          </div>
                          <p className="preserve">{i.notes}</p>
                          {i.preparation && (
                            <p className="preserve">
                              <strong>Préparation :</strong> {i.preparation}
                            </p>
                          )}
                          {i.report && (
                            <p className="preserve">
                              <strong>Compte rendu :</strong> {i.report}
                            </p>
                          )}
                          <button
                            className="text-link"
                            onClick={() =>
                              setEditor({
                                kind: "interaction",
                                applicationId: a.id,
                                value: i,
                              })
                            }
                          >
                            Modifier
                          </button>
                          <button
                            className="text-link danger"
                            onClick={() =>
                              confirmDelete(
                                "Supprimer cette interaction ?",
                                (s) => {
                                  s.interactions = s.interactions.filter(
                                    (x) => x.id !== i.id,
                                  );
                                },
                              )
                            }
                          >
                            Supprimer
                          </button>
                        </article>
                      ))}
                    <button
                      className="danger secondary"
                      onClick={() =>
                        confirmDelete(
                          "Supprimer cette candidature et tous ses contacts, interactions et relances ?",
                          (s) => deleteApplication(s, a.id),
                        )
                      }
                    >
                      Supprimer la candidature
                    </button>
                  </>
                )}
                {tab === "reminders" && (
                  <>
                    <div className="filter-pills">
                      {[
                        "Toutes",
                        "Aujourd’hui / en retard",
                        "À venir",
                        "Historique",
                      ].map((x) => (
                        <button
                          className={filter === x ? "selected" : ""}
                          key={x}
                          onClick={() => setFilter(x)}
                        >
                          {x}
                        </button>
                      ))}
                    </div>
                    <div className="cards-grid">
                      {[...state.reminders]
                        .sort((a, b) =>
                          (a.dueDate + a.time).localeCompare(
                            b.dueDate + b.time,
                          ),
                        )
                        .filter((r) =>
                          filter === "Historique"
                            ? r.state !== "active"
                            : r.state === "active" &&
                              (filter === "Toutes" ||
                                (filter === "À venir"
                                  ? r.dueDate > localDate()
                                  : r.dueDate <= localDate())),
                        )
                        .map(reminderCard)}
                    </div>
                    {!state.reminders.length && (
                      <Empty title="Un suivi qui ne vous lâche pas">
                        Les relances quotidiennes restent actives jusqu’à votre
                        validation.
                      </Empty>
                    )}
                    <p className="footnote">
                      Heure locale du téléphone. La précision dépend des
                      permissions et des restrictions Android.
                    </p>
                  </>
                )}
                {tab === "settings" && (
                  <div className="settings-grid">
                    <section className="card">
                      <h2>Rappels & notifications</h2>
                      <Toggle
                        label="Activer les notifications"
                        checked={state.settings.notifications}
                        onChange={(v) => setSetting("notifications", v)}
                      />
                      <Field
                        label="Heure par défaut"
                        type="time"
                        value={state.settings.defaultTime}
                        onChange={(v) => {
                          if (v) setSetting("defaultTime", v);
                        }}
                      />
                      <p className="muted">
                        Cette heure s’applique aux nouvelles relances. Les
                        heures déjà choisies sont conservées.
                      </p>
                      <Toggle
                        label="Répétition quotidienne par défaut"
                        checked={state.settings.repeatDaily}
                        onChange={(v) => setSetting("repeatDaily", v)}
                      />
                      <Toggle
                        label="Masquer l’entreprise et le poste dans les notifications"
                        checked={state.settings.privacy}
                        onChange={(v) => setSetting("privacy", v)}
                      />
                      <p className="permission">
                        {permission ||
                          "Sur ordinateur, consultez vos relances dans l’application. Les notifications système nécessitent la version Android."}
                      </p>
                      <div className="row wrap">
                        <button
                          className="secondary"
                          onClick={action(async () => {
                            await requestPermission();
                            setPermission(await permissionStatus());
                          })}
                        >
                          Autoriser les notifications
                        </button>
                        <button
                          className="secondary"
                          onClick={action(async () => {
                            await testNotification();
                            setNotice(
                              "Test programmé dans environ 10 secondes. Vérifiez sa réception sur le téléphone.",
                            );
                          })}
                        >
                          Tester une notification
                        </button>
                        {isAndroid() && (
                          <button
                            className="text-link"
                            onClick={action(openAndroidSettings)}
                          >
                            Paramètres Android
                          </button>
                        )}
                      </div>
                      <p className="footnote">
                        Sur Samsung : Paramètres → Applications → ApplyFlow →
                        Batterie. Une mise en veille profonde ou un arrêt forcé
                        peut empêcher les rappels.
                      </p>
                    </section>
                    <section className="card">
                      <h2>Apparence</h2>
                      <Field
                        label="Thème"
                        value={state.settings.theme}
                        options={["system", "light", "dark"]}
                        onChange={(v) =>
                          setSetting("theme", v as State["settings"]["theme"])
                        }
                      />
                    </section>
                    <section className="card">
                      <h2>Sauvegarde & transfert</h2>
                      <p>
                        Les données sont stockées sur cet appareil. Exportez
                        régulièrement une sauvegarde JSON pour les transférer ou
                        les restaurer.
                      </p>
                      <div className="row wrap">
                        <button
                          className="primary"
                          onClick={action(() =>
                            saveFile(
                              `applyflow-${localDate()}.json`,
                              exportJSON(state),
                              "application/json",
                            ),
                          )}
                        >
                          Exporter JSON
                        </button>
                        <button
                          className="secondary"
                          onClick={action(() =>
                            saveFile(
                              `applyflow-${localDate()}.csv`,
                              exportCSV(state),
                              "text/csv;charset=utf-8",
                            ),
                          )}
                        >
                          Exporter CSV
                        </button>
                        <button
                          className="secondary"
                          onClick={() => fileInput.current?.click()}
                        >
                          Restaurer JSON
                        </button>
                      </div>
                      <input
                        hidden
                        ref={fileInput}
                        type="file"
                        accept="application/json,.json"
                        aria-label="Fichier de sauvegarde"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          void guard(async () => {
                            if (file.size > 20 * 1024 * 1024)
                              throw new Error("Fichier trop volumineux");
                            const restored = parseBackup(await file.text());
                            if (
                              !window.confirm(
                                `Remplacer les données actuelles par ${restored.opportunities.length} offres et ${restored.applications.length} candidatures ? Une sauvegarde des données actuelles sera proposée avant le remplacement.`,
                              )
                            )
                              return;
                            await saveFile(
                              `applyflow-avant-restauration-${Date.now()}.json`,
                              exportJSON(state),
                              "application/json",
                            );
                            setState(await store.current!.restore(restored));
                            setNotice(
                              "Sauvegarde restaurée et rappels réconciliés.",
                            );
                          });
                        }}
                      />
                      <p className="footnote">
                        La restauration remplace les données. Le CSV sert à
                        l’analyse ; utilisez le JSON pour restaurer. Aucun
                        transfert automatique entre appareils.
                      </p>
                    </section>
                    <section className="card">
                      <h2>À propos</h2>
                      <p>
                        ApplyFlow 0.1.0 · Votre suivi de candidatures, sans
                        compte ni serveur.
                      </p>
                    </section>
                  </div>
                )}
                <footer className="page-footer">
                  APPLYFLOW <span>Une prochaine étape à la fois.</span>
                </footer>
              </main>
            </IonContent>
          </div>
          <nav className="bottom-nav" aria-label="Navigation mobile">
            {tabs.map(([id, label, icon]) => (
              <button
                key={id}
                aria-current={tab === id ? "page" : undefined}
                className={tab === id ? "active" : ""}
                onClick={() => go(id)}
              >
                <IonIcon icon={icon} />
                <span>
                  {id === "dashboard"
                    ? "Accueil"
                    : id === "offers"
                      ? "Offres"
                      : label}
                </span>
              </button>
            ))}
          </nav>
        </div>
        {editor && (
          <Modal
            title={
              editor.kind === "offer"
                ? state.opportunities.some((o) => o.id === editor.value.id)
                  ? "Modifier l’offre"
                  : "Nouvelle opportunité"
                : editor.kind === "reminder"
                  ? editor.value
                    ? "Reporter ou modifier la relance"
                    : "Nouvelle relance"
                  : editor.kind === "contact"
                    ? "Contact recruteur"
                    : "Interaction ou entretien"
            }
            close={() => setEditor(null)}
          >
            {editor.kind === "offer" ? (
              <OfferForm
                value={editor.value}
                busy={busy}
                save={(value) =>
                  guard(async () => {
                    const ds = duplicates(state, value);
                    if (
                      ds.length &&
                      !window.confirm(
                        `Doublon possible : ${ds[0].company}, ${ds[0].title}. Enregistrer quand même ?`,
                      )
                    )
                      return;
                    await update((s) => saveOpportunity(s, value));
                    setEditor(null);
                  })
                }
              />
            ) : editor.kind === "reminder" ? (
              <ReminderForm
                state={state}
                applicationId={editor.applicationId}
                value={editor.value}
                busy={busy}
                save={(id, date, time, repeat) =>
                  guard(async () => {
                    await update((s) => {
                      if (editor.value)
                        postpone(s, editor.value.id, date, time, repeat);
                      else addReminder(s, id, date, time, repeat);
                    });
                    setEditor(null);
                  })
                }
              />
            ) : editor.kind === "contact" ? (
              <ContactForm
                value={editor.value}
                applicationId={editor.applicationId}
                busy={busy}
                save={(c) =>
                  guard(async () => {
                    await update((s) => {
                      const i = s.contacts.findIndex((x) => x.id === c.id);
                      if (i < 0) s.contacts.push(c);
                      else s.contacts[i] = c;
                    });
                    setEditor(null);
                  })
                }
              />
            ) : (
              <InteractionForm
                value={editor.value}
                applicationId={editor.applicationId}
                busy={busy}
                save={(i) =>
                  guard(async () => {
                    await update((s) => {
                      const ix = s.interactions.findIndex((x) => x.id === i.id);
                      if (ix < 0) s.interactions.push(i);
                      else s.interactions[ix] = i;
                    });
                    setEditor(null);
                  })
                }
              />
            )}
          </Modal>
        )}
      </IonPage>
    </IonApp>
  );
}
