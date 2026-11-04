import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { SCHEMA_V1, seedLibrary } from "./schema";
import { isV1Database, migrateFromV1 } from "./migrateV1";

export const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "astrofit.db");

export const nowIso = () => new Date().toISOString();

function open(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  // A v1 AstroFit database gets backed up and converted before anything else touches it.
  if (fs.existsSync(DB_PATH) && isV1Database(DB_PATH)) {
    migrateFromV1(DB_PATH, migrate);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

const MIGRATIONS: ((db: Database.Database) => void)[] = [
  // 1: v2 schema
  db => { db.exec(SCHEMA_V1); },
];

export function migrate(db: Database.Database) {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      MIGRATIONS[v](db);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  seedLibrary(db);
}

const g = globalThis as unknown as { __astrofitDb?: Database.Database };

/**
 * Opens on first use, not on import. `next build` imports every route in parallel workers, and opening
 * there makes them race to switch one new file to WAL mode, failing the build with SQLITE_BUSY.
 */
export const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const real = g.__astrofitDb ?? (g.__astrofitDb = open());
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
