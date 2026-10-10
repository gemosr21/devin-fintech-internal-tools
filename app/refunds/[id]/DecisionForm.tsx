"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DecisionForm({ refundId }: { refundId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(decision: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/refunds/${refundId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(`${res.status}: ${body.error ?? "Request failed"}`);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Nothing was saved by this attempt unless the page shows otherwise; please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="decision">
      <h2>Decision</h2>
      <label>
        Reason (required)
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
      </label>
      <div className="actions">
        <button disabled={busy} onClick={() => submit("approve")} className="approve">
          Approve
        </button>
        <button disabled={busy} onClick={() => submit("reject")} className="reject">
          Reject
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
