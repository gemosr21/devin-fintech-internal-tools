import type { DB } from "./db";

export type AuditInput = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason?: string | null;
};

export type AuditEvent = {
  id: number;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  reason: string | null;
  created_at: string;
};

// Must be called inside the same transaction as the change it records.
export function recordAudit(db: DB, e: AuditInput): void {
  db.prepare(
    `INSERT INTO audit_events (actor_id, action, entity_type, entity_id, before_json, after_json, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(e.actorId, e.action, e.entityType, e.entityId, JSON.stringify(e.before), JSON.stringify(e.after), e.reason ?? null, new Date().toISOString());
}

export function listAuditEvents(db: DB, entityType: string, entityId: string): AuditEvent[] {
  return db
    .prepare("SELECT * FROM audit_events WHERE entity_type = ? AND entity_id = ? ORDER BY id")
    .all(entityType, entityId) as AuditEvent[];
}
