import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import { HttpError } from "../lib/errors";
import { resolveActor } from "../lib/identity";
import { decideRefund, getRefund, listRefunds } from "../lib/refunds";
import { listAuditEvents } from "../lib/audit";
import { auditCount, freshDb, pendingId } from "./helpers";

function expectHttp(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(status);
    return;
  }
  throw new Error(`expected HttpError ${status}`);
}

describe("listRefunds / getRefund", () => {
  it("filters by status and search", () => {
    const { db, viewer } = freshDb();
    const all = listRefunds(db, viewer);
    const pending = listRefunds(db, viewer, { status: "pending" });
    expect(all.length).toBe(24);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((r) => r.status === "pending")).toBe(true);
    expect(listRefunds(db, viewer, { q: "RF-1001" }).map((r) => r.id)).toEqual(["RF-1001"]);
  });

  it("denies reads without a recognized identity", () => {
    const { db } = freshDb();
    expectHttp(() => listRefunds(db, null), 401);
    expectHttp(() => getRefund(db, resolveActor(db, "nobody"), "RF-1001"), 401);
  });
});

describe("decideRefund", () => {
  it("AC1: reviewer approves a pending request and the decision is persisted", () => {
    const { db, reviewer } = freshDb();
    const id = pendingId(db);
    const result = decideRefund(db, reviewer, id, { decision: "approve", reason: "Duplicate charge confirmed" });
    expect(result.status).toBe("approved");
    const stored = getRefund(db, reviewer, id);
    expect(stored).toMatchObject({ status: "approved", decided_by: "riley", decision_reason: "Duplicate charge confirmed" });
    expect(stored.decided_at).toBeTruthy();
  });

  it("AC1: reviewer can reject", () => {
    const { db, reviewer } = freshDb();
    const id = pendingId(db);
    expect(decideRefund(db, reviewer, id, { decision: "reject", reason: "Outside refund window" }).status).toBe("rejected");
  });

  it("AC2: viewer, admin and missing identity cannot decide; nothing is written", () => {
    const { db, viewer, admin } = freshDb();
    const id = pendingId(db);
    const input = { decision: "approve", reason: "x" };
    expectHttp(() => decideRefund(db, viewer, id, input), 403);
    expectHttp(() => decideRefund(db, admin, id, input), 403);
    expectHttp(() => decideRefund(db, null, id, input), 401);
    expect(getRefund(db, viewer, id).status).toBe("pending");
    expect(auditCount(db)).toBe(0);
  });

  it("AC3: missing/blank reason and invalid decision are rejected with no writes", () => {
    const { db, reviewer } = freshDb();
    const id = pendingId(db);
    expectHttp(() => decideRefund(db, reviewer, id, { decision: "approve" }), 400);
    expectHttp(() => decideRefund(db, reviewer, id, { decision: "approve", reason: "   " }), 400);
    expectHttp(() => decideRefund(db, reviewer, id, { decision: "maybe", reason: "ok" }), 400);
    expectHttp(() => decideRefund(db, reviewer, id, { decision: "approve", reason: "x".repeat(501) }), 400);
    expectHttp(() => decideRefund(db, reviewer, id, null), 400);
    expect(getRefund(db, reviewer, id).status).toBe("pending");
    expect(auditCount(db)).toBe(0);
  });

  it("returns 404 for an unknown refund", () => {
    const { db, reviewer } = freshDb();
    expectHttp(() => decideRefund(db, reviewer, "RF-9999", { decision: "approve", reason: "x" }), 404);
  });

  it("AC4: a second decision is rejected and the original decision is kept", () => {
    const { db, reviewer } = freshDb();
    const other = resolveActor(db, "rana");
    const id = pendingId(db);
    decideRefund(db, reviewer, id, { decision: "approve", reason: "first" });
    expectHttp(() => decideRefund(db, other, id, { decision: "reject", reason: "second" }), 409);
    expect(getRefund(db, reviewer, id)).toMatchObject({ status: "approved", decided_by: "riley", decision_reason: "first" });
    expect(auditCount(db, id)).toBe(1);
  });

  it("AC5: a successful decision writes exactly one audit event with actor, before/after and reason", () => {
    const { db, reviewer } = freshDb();
    const id = pendingId(db);
    decideRefund(db, reviewer, id, { decision: "reject", reason: "  Not eligible  " });
    const events = listAuditEvents(db, "refund", id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actor_id: "riley", action: "refund.rejected", reason: "Not eligible" });
    expect(JSON.parse(events[0].before_json!)).toEqual({ status: "pending" });
    expect(JSON.parse(events[0].after_json!)).toMatchObject({ status: "rejected", decided_by: "riley" });
  });

  it("AC5: if the audit write fails, the decision is rolled back", () => {
    const { db, reviewer } = freshDb();
    const id = pendingId(db);
    const failingAudit = () => {
      throw new Error("audit store unavailable");
    };
    expect(() => decideRefund(db, reviewer, id, { decision: "approve", reason: "x" }, { recordAudit: failingAudit })).toThrow(
      "audit store unavailable",
    );
    expect(getRefund(db, reviewer, id).status).toBe("pending");
    expect(auditCount(db)).toBe(0);
  });

  it("audit events cannot be updated or deleted through SQL (application-level guard)", () => {
    const { db, reviewer } = freshDb();
    decideRefund(db, reviewer, pendingId(db), { decision: "approve", reason: "x" });
    expect(() => db.prepare("UPDATE audit_events SET reason = 'edited'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM audit_events").run()).toThrow(/append-only/);
  });

  it("AC6: decisions and audit events survive closing and reopening the database file", () => {
    const { db, file, reviewer } = freshDb();
    const id = pendingId(db);
    decideRefund(db, reviewer, id, { decision: "approve", reason: "persist me" });
    db.close();
    const reopened = openDb(file);
    const actor = resolveActor(reopened, "riley");
    expect(getRefund(reopened, actor, id)).toMatchObject({ status: "approved", decision_reason: "persist me" });
    expect(auditCount(reopened, id)).toBe(1);
    reopened.close();
  });
});
