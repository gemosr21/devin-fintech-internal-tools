import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb } from "../lib/db";
import { resolveActor } from "../lib/identity";

export function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "refunds-test-")), "app.db");
}

export function freshDb(file = tempDbPath()) {
  const db = openDb(file);
  return {
    db,
    file,
    viewer: resolveActor(db, "vera"),
    reviewer: resolveActor(db, "riley"),
    admin: resolveActor(db, "ada"),
  };
}

export function pendingId(db: ReturnType<typeof openDb>) {
  return (db.prepare("SELECT id FROM refund_requests WHERE status = 'pending' ORDER BY id LIMIT 1").get() as { id: string }).id;
}

export function auditCount(db: ReturnType<typeof openDb>, id?: string) {
  const row = id
    ? db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE entity_id = ?").get(id)
    : db.prepare("SELECT COUNT(*) AS n FROM audit_events").get();
  return (row as { n: number }).n;
}
