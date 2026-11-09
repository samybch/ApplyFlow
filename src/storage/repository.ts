import { Capacitor, registerPlugin } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import { emptyState, validateState, type State } from "../domain/model";
export interface Snapshot {
  state: State;
  revision: number;
}
export interface Repository {
  read(): Promise<Snapshot>;
  write(state: State, revision: number): Promise<boolean>;
}
interface NativeStore {
  read(): Promise<{ payload: string; revision: number }>;
  write(options: {
    payload: string;
    revision: number;
  }): Promise<{ saved: boolean }>;
  reconcile(): Promise<void>;
  consumeNavigation(): Promise<{
    applicationId?: string;
    reminderId?: string;
    custom?: boolean;
  }>;
  openSettings(): Promise<void>;
}
export const nativeStore = registerPlugin<NativeStore>("ApplyFlowStore");
export async function createRepository(): Promise<Repository> {
  if (Capacitor.getPlatform() === "android") {
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const db = await sqlite.createConnection(
      "applyflow",
      false,
      "no-encryption",
      1,
      false,
    );
    await db.open();
    await db.execute(
      "CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);",
    );
    await db.run(
      "INSERT OR IGNORE INTO app_state(id,payload,revision) VALUES(1,?,0)",
      [JSON.stringify(emptyState())],
    );
    await sqlite.closeConnection("applyflow", false);
    return {
      async read() {
        const r = await nativeStore.read();
        return {
          state: validateState(JSON.parse(r.payload)),
          revision: r.revision,
        };
      },
      async write(state, revision) {
        return (
          await nativeStore.write({
            payload: JSON.stringify(validateState(state)),
            revision,
          })
        ).saved;
      },
    };
  }
  return new WebRepository();
}
export class WebRepository implements Repository {
  private database: Promise<IDBDatabase>;
  constructor(name = "applyflow") {
    this.database = new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("state");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async read(): Promise<Snapshot> {
    const db = await this.database;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("state", "readonly");
      const req = tx.objectStore("state").get(1);
      req.onsuccess = () => {
        try {
          resolve(
            req.result
              ? {
                  state: validateState(req.result.state),
                  revision: req.result.revision,
                }
              : { state: emptyState(), revision: 0 },
          );
        } catch (e) {
          reject(e);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }
  async write(state: State, revision: number) {
    validateState(state);
    const db = await this.database;
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      const store = tx.objectStore("state");
      let saved = false;
      const req = store.get(1);
      req.onsuccess = () => {
        if ((req.result?.revision ?? 0) === revision) {
          store.put({ state, revision: revision + 1 }, 1);
          saved = true;
        }
      };
      tx.oncomplete = () => resolve(saved);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}
export class Store {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private repo: Repository) {}
  async read() {
    return (await this.repo.read()).state;
  }
  update(fn: (s: State) => void) {
    const job = this.queue.then(async () => {
      for (let tries = 0; tries < 4; tries++) {
        const snap = await this.repo.read();
        fn(snap.state);
        validateState(snap.state);
        if (await this.repo.write(snap.state, snap.revision)) return snap.state;
      }
      throw new Error("Les données ont changé. Réessayez.");
    });
    this.queue = job.catch(() => {});
    return job;
  }
  restore(state: State) {
    return this.update((s) => Object.assign(s, validateState(state)));
  }
}
