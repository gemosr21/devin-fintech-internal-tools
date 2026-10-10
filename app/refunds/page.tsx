import Link from "next/link";
import { getDb } from "@/lib/db";
import { money, when } from "@/lib/format";
import { listRefunds, REFUND_STATUSES } from "@/lib/refunds";
import { currentActor } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RefundsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = "", q = "" } = await searchParams;
  const actor = await currentActor();
  if (!actor) return <p className="notice">Choose a demo identity above to view refund requests.</p>;
  const refunds = listRefunds(getDb(), actor, { status, q });

  return (
    <>
      <h1>Refund requests</h1>
      <form className="filters" method="get">
        <label>
          Status{" "}
          <select name="status" defaultValue={status}>
            <option value="">All</option>
            {REFUND_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search <input name="q" defaultValue={q} placeholder="ID, customer or merchant" />
        </label>
        <button type="submit">Apply</button>
      </form>
      <p className="muted">{refunds.length} result(s)</p>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Merchant</th>
            <th className="num">Amount</th>
            <th>Requested</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {refunds.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/refunds/${r.id}`}>{r.id}</Link>
              </td>
              <td>{r.customer_name}</td>
              <td>{r.merchant}</td>
              <td className="num">{money(r.amount_cents, r.currency)}</td>
              <td>{when(r.created_at)}</td>
              <td>
                <span className={`status status-${r.status}`}>{r.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
