import type { ReactNode } from "react";
import { IonIcon } from "@ionic/react";
import { arrowForwardOutline } from "ionicons/icons";
import { type State, type Reminder, closed } from "../domain/model";
import { metrics, localDate } from "../domain/service";
import { Empty, fmt } from "./components";
import type { Tab } from "./types";
export function Dashboard({
  state,
  stats,
  setStats,
  go,
  openApp,
  reminderCard,
}: {
  state: State;
  stats: boolean;
  setStats: (v: boolean) => void;
  go: (tab: Tab) => void;
  openApp: (id: string) => void;
  reminderCard: (r: Reminder) => ReactNode;
}) {
  const m = metrics(state);
  const due = state.reminders
    .filter((r) => r.state === "active" && r.dueDate <= localDate())
    .sort((a, b) => (a.dueDate + a.time).localeCompare(b.dueDate + b.time));
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
  return (
    <>
      <div className="stat-grid">
        {[
          [m.active, "Candidatures actives", "Votre recherche en mouvement"],
          [
            interviews.length,
            "Entretiens à venir",
            "Préparez la prochaine étape",
          ],
          [due.length, "Relances à effectuer", "Ne laissez rien en suspens"],
          [
            state.opportunities.filter((o) => o.status === "À étudier").length,
            "Offres à étudier",
            "De nouvelles possibilités",
          ],
        ].map(([n, title, sub], i) => (
          <button
            className="stat-card"
            key={title}
            onClick={() =>
              go(
                i === 0
                  ? "applications"
                  : i === 2
                    ? "reminders"
                    : i === 3
                      ? "offers"
                      : "applications",
              )
            }
          >
            <span className="stat-label">
              {title}
              <span>↗</span>
            </span>
            <strong>{n.toString().padStart(2, "0")}</strong>
            <small>{sub}</small>
          </button>
        ))}
      </div>
      <div className="section-heading">
        <h2>
          {stats ? "Analyse de votre recherche" : "Votre prochaine étape"}
        </h2>
        <button className="text-link" onClick={() => setStats(!stats)}>
          {stats ? "Retour au tableau de bord" : "Voir les statistiques"}{" "}
          <IonIcon icon={arrowForwardOutline} />
        </button>
      </div>
      {stats ? (
        <>
          <div className="stat-grid compact">
            {[
              [m.sent, "Candidatures envoyées"],
              [`${m.response} %`, "Taux de réponse"],
              [`${m.interview} %`, "Taux d’entretien"],
              [`${m.rejection} %`, "Taux de refus"],
            ].map(([v, l]) => (
              <div className="card" key={l}>
                <p className="muted">{l}</p>
                <h2>{v}</h2>
              </div>
            ))}
          </div>
          <p className="muted">
            Délai moyen avant une première réponse :{" "}
            {m.delay === null
              ? "aucune réponse enregistrée"
              : `${m.delay} jours`}
            . Une réponse est un passage en entretien, refus, offre reçue ou
            acceptation. Les taux portent sur les candidatures dont le dépôt est
            confirmé.
          </p>
          <div className="two-columns">
            {[
              ["Par statut", state.applications.map((a) => a.status)],
              [
                "Par entreprise",
                state.applications.map(
                  (a) =>
                    state.opportunities.find((o) => o.id === a.opportunityId)!
                      .company,
                ),
              ],
              [
                "Par pays",
                state.applications.map(
                  (a) =>
                    state.opportunities.find((o) => o.id === a.opportunityId)!
                      .country || "Non précisé",
                ),
              ],
              [
                "Envois par mois",
                state.applications
                  .filter((a) => a.submittedDate)
                  .map((a) => a.submittedDate!.slice(0, 7)),
              ],
            ].map(([title, values]) => (
              <div className="card" key={String(title)}>
                <h3>{title}</h3>
                {Object.entries(
                  (values as string[]).reduce<Record<string, number>>(
                    (r, k) => {
                      r[k] = (r[k] ?? 0) + 1;
                      return r;
                    },
                    {},
                  ),
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, n]) => (
                    <div className="chart-row" key={label}>
                      <span>{label}</span>
                      <meter
                        min={0}
                        max={Math.max(1, state.applications.length)}
                        value={n}
                      />
                      <b>{n}</b>
                    </div>
                  ))}
                {!(values as string[]).length && (
                  <p className="muted">Aucune donnée pour le moment.</p>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="two-columns">
            <section>
              <div className="section-heading">
                <h3>Relances prioritaires</h3>
                <span className="count">{due.length}</span>
              </div>
              {due.length ? (
                due.slice(0, 3).map(reminderCard)
              ) : (
                <Empty title="Vous êtes à jour">
                  Vos relances du jour apparaîtront ici.
                </Empty>
              )}
            </section>
            <section>
              <div className="section-heading">
                <h3>Prochains entretiens</h3>
                <span className="count">{interviews.length}</span>
              </div>
              {interviews.length ? (
                interviews.slice(0, 4).map((i) => {
                  const app = state.applications.find(
                      (a) => a.id === i.applicationId,
                    )!,
                    offer = state.opportunities.find(
                      (o) => o.id === app.opportunityId,
                    )!;
                  return (
                    <button
                      className="card interview"
                      key={i.id}
                      onClick={() => openApp(app.id)}
                    >
                      <span className="calendar-day">
                        {new Date(i.at).getDate()}
                        <small>
                          {new Intl.DateTimeFormat("fr-FR", {
                            month: "short",
                          }).format(new Date(i.at))}
                        </small>
                      </span>
                      <span>
                        <strong>{offer.company}</strong>
                        <p>{offer.title}</p>
                        <small className="muted">
                          {new Date(i.at).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </span>
                      <span>↗</span>
                    </button>
                  );
                })
              ) : (
                <Empty title="Place à la prochaine rencontre">
                  Ajoutez vos entretiens depuis une candidature.
                </Empty>
              )}
            </section>
          </div>
          <div className="section-heading">
            <h2>Activité récente</h2>
            <span className="muted">Vos derniers mouvements</span>
          </div>
          <div className="card">
            {state.applications
              .flatMap((a) => a.history.map((h) => ({ a, h })))
              .sort((a, b) => b.h.at.localeCompare(a.h.at))
              .slice(0, 6)
              .map(({ a, h }, i) => (
                <button
                  className="activity"
                  key={a.id + i}
                  onClick={() => openApp(a.id)}
                >
                  <span className="activity-dot" />
                  <strong>
                    {
                      state.opportunities.find((o) => o.id === a.opportunityId)!
                        .company
                    }
                  </strong>
                  <span className="badge">{h.status}</span>
                  <time>{fmt(h.at)}</time>
                </button>
              ))}
            {!state.applications.length && (
              <p className="muted">
                Votre histoire commence avec une première offre.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
