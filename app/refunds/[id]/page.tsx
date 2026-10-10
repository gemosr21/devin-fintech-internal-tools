import Link from "next/link";
import { notFound } from "next/navigation";
import { listAuditEvents } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { money, when } from "@/lib/format";
import { can } from "@/lib/identity";
import { getRefund } from "@/lib/refunds";
import { currentActor } from "@/lib/session";
import { DecisionForm } from "./DecisionForm";

export const dynamic = "force-dynamic";

export default async function RefundDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor) return <p className="notice">Choose a demo identity above to view this request.</p>;
  const db = getDb();
  let refund;
  try {
    refund = getRefund(db, actor, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const audit = listAuditEvents(db, "refund", id);

  return (
    <>
      <p>
        <Link href="/refunds">← All requests</Link>
      </p>
      <h1>
        {refund.id} <span className={`status status-${refund.status}`}>{refund.status}</span>
      </h1>
      <dl className="details">
        <dt>Customer</dt>
        <dd>
          {refund.customer_name} ({refund.customer_email})
        </dd>
        <dt>Merchant</dt>
        <dd>{refund.merchant}</dd>
        <dt>Amount</dt>
        <dd>{money(refund.amount_cents, refund.currency)}</dd>
        <dt>Customer reason</dt>
        <dd>{refund.request_reason}</dd>
        <dt>Requested</dt>
        <dd>{when(refund.created_at)}</dd>
        <dt>Decided by</dt>
        <dd>{refund.decided_by ?? "—"}</dd>
        <dt>Decided at</dt>
        <dd>{when(refund.decided_at)}</dd>
        <dt>Decision reason</dt>
        <dd>{refund.decision_reason ?? "—"}</dd>
      </dl>

      {refund.status === "pending" &&
        (can(actor, "refunds:decide") ? (
          <DecisionForm refundId={refund.id} />
        ) : (
          <p className="notice">Your role ({actor.role}) can view but not decide refunds. The server enforces this too.</p>
        ))}

      <h2>Audit history</h2>
      {audit.length === 0 ? (
        <p className="muted">No audit events recorded by this app for this request (seeded history is not audited).</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Before → After</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{when(e.created_at)}</td>
                <td>{e.actor_id}</td>
                <td>{e.action}</td>
                <td>
                  <code>{e.before_json}</code> → <code>{e.after_json}</code>
                </td>
                <td>{e.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
