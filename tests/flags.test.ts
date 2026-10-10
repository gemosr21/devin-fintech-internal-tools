import { describe, expect, it } from "vitest";
import { HttpError } from "../lib/errors";
import { listFlags, setFlag } from "../lib/flags";
import { listAuditEvents } from "../lib/audit";
import { freshDb } from "./helpers";

function status(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (e instanceof HttpError) return e.status;
    throw e;
  }
  return 200;
}

describe("feature flags (reuses identity + audit modules)", () => {
  it("admin toggles a flag; change and audit event are persisted", () => {
    const { db, admin } = freshDb();
    const flag = setFlag(db, admin, "instant_refunds", { enabled: true, reason: "pilot" });
    expect(flag).toMatchObject({ enabled: 1, updated_by: "ada" });
    const events = listAuditEvents(db, "feature_flag", "instant_refunds");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actor_id: "ada", action: "flag.enabled", reason: "pilot" });
  });

  it("everyone with an identity can read; only admin can write", () => {
    const { db, viewer, reviewer, admin } = freshDb();
    expect(listFlags(db, viewer).length).toBe(4);
    expect(status(() => listFlags(db, null))).toBe(401);
    expect(status(() => setFlag(db, viewer, "instant_refunds", { enabled: true }))).toBe(403);
    expect(status(() => setFlag(db, reviewer, "instant_refunds", { enabled: true }))).toBe(403);
    expect(status(() => setFlag(db, null, "instant_refunds", { enabled: true }))).toBe(401);
    expect(status(() => setFlag(db, admin, "instant_refunds", { enabled: "yes" }))).toBe(400);
    expect(status(() => setFlag(db, admin, "nope", { enabled: true }))).toBe(404);
    expect(status(() => setFlag(db, admin, "instant_refunds", { enabled: false }))).toBe(409);
    expect(listFlags(db, admin).find((f) => f.key === "instant_refunds")?.enabled).toBe(0);
    expect(listAuditEvents(db, "feature_flag", "instant_refunds")).toHaveLength(0);
  });

  it("rolls back the flag change if the audit write fails", () => {
    const { db, admin } = freshDb();
    expect(() =>
      setFlag(db, admin, "instant_refunds", { enabled: true }, { recordAudit: () => { throw new Error("audit down"); } }),
    ).toThrow("audit down");
    expect(listFlags(db, admin).find((f) => f.key === "instant_refunds")?.enabled).toBe(0);
  });
});
