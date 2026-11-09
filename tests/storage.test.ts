import { it, expect } from "vitest";
import { Store, WebRepository } from "../src/storage/repository";
import { emptyState, newOpportunity } from "../src/domain/model";
import { saveOpportunity } from "../src/domain/service";
import { parseBackup } from "../src/storage/backup";
it("persiste après fermeture logique et réouverture du stockage web", async () => {
  const name = crypto.randomUUID();
  const store = new Store(new WebRepository(name));
  await store.update((s) => {
    const o = newOpportunity();
    o.company = "Persistante";
    o.title = "Analyste";
    saveOpportunity(s, o);
  });
  const reopened = new Store(new WebRepository(name));
  expect((await reopened.read()).opportunities[0].company).toBe("Persistante");
});
it("sérialise deux écritures et détecte une révision obsolète", async () => {
  const repo = new WebRepository(crypto.randomUUID()),
    store = new Store(repo);
  await Promise.all([
    store.update((s) => {
      s.settings.privacy = true;
    }),
    store.update((s) => {
      s.settings.defaultTime = "09:00";
    }),
  ]);
  expect((await store.read()).settings).toMatchObject({
    privacy: true,
    defaultTime: "09:00",
  });
  expect(await repo.write(emptyState(), 0)).toBe(false);
});
it("préserve les données si la restauration est invalide", async () => {
  const store = new Store(new WebRepository(crypto.randomUUID()));
  await store.update((s) => {
    s.settings.privacy = true;
  });
  expect(() => parseBackup("invalid")).toThrow();
  expect((await store.read()).settings.privacy).toBe(true);
});
it("restaure en une écriture atomique et conserve la validation", async () => {
  const store = new Store(new WebRepository(crypto.randomUUID()));
  const restored = emptyState();
  restored.settings.defaultTime = "10:15";
  await store.restore(restored);
  expect((await store.read()).settings.defaultTime).toBe("10:15");
});
