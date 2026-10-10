import { z } from "zod";
import type { DB } from "./db";
import { recordAudit as defaultRecordAudit } from "./audit";
import { HttpError } from "./errors";
import { requirePermission, type Actor } from "./identity";

export const REFUND_STATUSES = ["pending", "approved", "rejected"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export type Refund = {
  id: string;
  customer_name: string;
  customer_email: string;
  merchant: string;
  amount_cents: number;
  currency: string;
  request_reason: string;
  created_at: string;
  status: RefundStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
};

export const DecisionInput = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(1, "A reason is required").max(500, "Reason must be at most 500 characters"),
});

export function listRefunds(db: DB, actor: Actor | null, filter: { status?: string; q?: string } = {}): Refund[] {
  requirePermission(actor, "refunds:read");
  const where: string[] = [];
  const args: string[] = [];
  if (filter.status && (REFUND_STATUSES as readonly string[]).includes(filter.status)) {
    where.push("status = ?");
    args.push(filter.status);
  }
  if (filter.q?.trim()) {
    where.push("(id LIKE ? OR customer_name LIKE ? OR merchant LIKE ?)");
    const like = `%${filter.q.trim()}%`;
    args.push(like, like, like);
  }
  const sql = `SELECT * FROM refund_requests ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
  return db.prepare(sql).all(...args) as Refund[];
}

function findRefund(db: DB, id: string): Refund | undefined {
  return db.prepare("SELECT * FROM refund_requests WHERE id = ?").get(id) as Refund | undefined;
}

export function getRefund(db: DB, actor: Actor | null, id: string): Refund {
  requirePermission(actor, "refunds:read");
  const refund = findRefund(db, id);
  if (!refund) throw new HttpError(404, `Refund ${id} not found`);
  return refund;
}

export function decideRefund(
  db: DB,
  actor: Actor | null,
  id: string,
  input: unknown,
  deps: { recordAudit: typeof defaultRecordAudit } = { recordAudit: defaultRecordAudit },
): Refund {
  const reviewer = requirePermission(actor, "refunds:decide");
  const parsed = DecisionInput.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  const { decision, reason } = parsed.data;
  const status: RefundStatus = decision === "approve" ? "approved" : "rejected";

  return db.transaction(() => {
    const before = findRefund(db, id);
    if (!before) throw new HttpError(404, `Refund ${id} not found`);
    if (before.status !== "pending") throw new HttpError(409, `Refund ${id} was already ${before.status}`);

    const result = db
      .prepare(
        `UPDATE refund_requests SET status = ?, decided_by = ?, decided_at = ?, decision_reason = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(status, reviewer.id, new Date().toISOString(), reason, id);
    if (result.changes !== 1) throw new HttpError(409, `Refund ${id} was already decided`);

    const after = findRefund(db, id)!;
    deps.recordAudit(db, {
      actorId: reviewer.id,
      action: `refund.${status}`,
      entityType: "refund",
      entityId: id,
      before: { status: before.status },
      after: { status: after.status, decided_by: after.decided_by, decided_at: after.decided_at },
      reason,
    });
    return after;
  })();
}
