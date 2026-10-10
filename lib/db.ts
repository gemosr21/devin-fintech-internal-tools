import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA } from "./schema";
import { seed, seedFlags } from "./seed";

export type DB = Database.Database;

export function openDb(file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db")): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (n === 0) seed(db);
  const { f } = db.prepare("SELECT COUNT(*) AS f FROM feature_flags").get() as { f: number };
  if (f === 0) seedFlags(db);
  return db;
}

const globalForDb = globalThis as unknown as { __db?: DB };

export function getDb(): DB {
  globalForDb.__db ??= openDb();
  return globalForDb.__db;
}
