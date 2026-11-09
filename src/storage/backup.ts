import { type State, validateState } from "../domain/model";
export function exportJSON(s: State) {
  return JSON.stringify(
    {
      format: "applyflow",
      exportedAt: new Date().toISOString(),
      data: validateState(s),
    },
    null,
    2,
  );
}
export function parseBackup(text: string): State {
  if (new TextEncoder().encode(text).length > 20 * 1024 * 1024)
    throw new Error("Sauvegarde trop volumineuse (20 Mo maximum)");
  const input = JSON.parse(text);
  if (input.format !== "applyflow")
    throw new Error("Ce fichier n’est pas une sauvegarde ApplyFlow");
  return validateState(input.data);
}
export function exportCSV(s: State) {
  const cell = (v: string) =>
    '"' + (/^[=+@\-\t\r]/.test(v) ? "'" + v : v).replace(/"/g, '""') + '"';
  return (
    "\uFEFF" +
    [
      [
        "Entreprise",
        "Poste",
        "Pays",
        "Ville",
        "Statut",
        "Date de dépôt",
        "URL",
        "Notes",
      ],
      ...s.opportunities.flatMap((o) => {
        const aa = s.applications.filter((a) => a.opportunityId === o.id);
        return (aa.length ? aa : [null]).map((a) => [
          o.company,
          o.title,
          o.country,
          o.city,
          a?.status ?? o.status,
          a?.submittedDate ?? "",
          o.url,
          a?.notes ?? o.notes,
        ]);
      }),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
