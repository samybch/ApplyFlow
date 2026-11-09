import { test, expect } from "@playwright/test";
test("parcours complet hors ligne : offre, dépôt, relance, entretien, persistance et clôture", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Vue d’ensemble" }),
  ).toBeVisible();
  const nav = (name: string) =>
    page
      .getByRole("navigation", {
        name: test.info().project.name.startsWith("mobile")
          ? "Navigation mobile"
          : "Navigation principale",
      })
      .getByRole("button", { name, exact: true });
  await page
    .getByRole("button", { name: "Ajouter une offre", exact: true })
    .click();
  await page.getByLabel("Entreprise *", { exact: true }).fill("KPMG");
  await page
    .getByLabel("Intitulé du poste *", { exact: true })
    .fill("Pricing Senior Analyst");
  await page.getByLabel("Pays", { exact: true }).fill("France");
  await page.getByRole("button", { name: "Enregistrer l’offre" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(
    test.info().project.name.startsWith("mobile") ? "Offres" : "Opportunités",
  ).click();
  await expect(
    page.getByRole("heading", { name: "KPMG", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Créer une candidature" }).click();
  await page.getByLabel("Statut de candidature").selectOption("Envoyée");
  await page.getByLabel("Date réelle de dépôt").fill("2026-01-01");
  await page.getByRole("button", { name: "Mettre à jour le statut" }).click();
  await expect(page.getByLabel("Statut de candidature")).toHaveValue("Envoyée");
  await page.getByRole("button", { name: "+ Ajouter une relance" }).click();
  await expect(page.getByLabel("Heure locale")).toHaveValue("18:00");
  await page.getByLabel("Date de relance").fill("2026-12-01");
  await page.getByRole("button", { name: "Enregistrer la relance" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Rappel quotidien", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ajouter une interaction", exact: true })
    .click();
  await page.getByLabel("Type d’interaction").selectOption("Entretien");
  await page
    .getByLabel("Date et heure *", { exact: true })
    .fill("2026-12-02T10:30");
  await page
    .getByLabel("Préparation", { exact: true })
    .fill("Préparer les cas pricing");
  await page.getByRole("button", { name: "Enregistrer l’interaction" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("status", { name: "Données enregistrées", exact: true }),
  ).toBeVisible();
  await page.reload();
  await nav("Candidatures").click();
  await page
    .getByRole("button", { name: /KPMG Pricing Senior Analyst/ })
    .click();
  await expect(
    page.getByText("Préparer les cas pricing", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Date réelle de dépôt")).toHaveValue(
    "2026-01-01",
  );
  await page.getByRole("button", { name: "Dans 3 jours", exact: true }).click();
  await page.getByRole("button", { name: "Effectuée", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Effectuée", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "+ Ajouter une relance" }).click();
  await page.getByLabel("Date de relance").fill("2026-12-05");
  await page.getByRole("button", { name: "Enregistrer la relance" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Statut de candidature").selectOption("Refusée");
  await page.getByRole("button", { name: "Mettre à jour le statut" }).click();
  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Effectuée", exact: true }),
  ).toHaveCount(0);
  await nav("Paramètres").click();
  await page.getByLabel("Masquer l’entreprise et le poste").check();
  await expect(
    page.getByRole("status", { name: "Données enregistrées", exact: true }),
  ).toBeVisible();
  await page.reload();
  await nav("Paramètres").click();
  await expect(
    page.getByLabel("Masquer l’entreprise et le poste"),
  ).toBeChecked();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter JSON", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toContain("applyflow-");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.context().setOffline(true);
  await expect(
    page.getByRole("status", { name: "Données enregistrées", exact: true }),
  ).toBeVisible();
  await page.reload();
  await nav(
    test.info().project.name.startsWith("mobile")
      ? "Accueil"
      : "Vue d’ensemble",
  ).click();
  await expect(
    page.getByRole("heading", { name: "Vue d’ensemble" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("confidentialité, heure personnalisée, thème et capture mobile", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "Vue d’ensemble" }).waitFor();
  const mobile = test.info().project.name.startsWith("mobile");
  await page
    .getByRole("navigation", {
      name: mobile ? "Navigation mobile" : "Navigation principale",
    })
    .getByRole("button", { name: "Paramètres", exact: true })
    .click();
  await page.getByLabel("Heure par défaut").fill("09:30");
  await page.getByLabel("Thème").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("status", { name: "Données enregistrées", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation", {
      name: mobile ? "Navigation mobile" : "Navigation principale",
    })
    .getByRole("button", { name: "Paramètres", exact: true })
    .click();
  await expect(page.getByLabel("Heure par défaut")).toHaveValue("09:30");
  await page.getByLabel("Thème").selectOption("light");
  await page.screenshot({
    path: `work/${mobile ? "mobile" : "desktop"}-settings.png`,
    fullPage: true,
  });
});
