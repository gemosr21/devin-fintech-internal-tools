"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FlagToggle({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/flags/${flagKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(`${res.status}: ${body.error ?? "Request failed"}`);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error, please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button disabled={busy} onClick={toggle}>
        Turn {enabled ? "off" : "on"}
      </button>
      {error && <span className="error"> {error}</span>}
    </>
  );
}
