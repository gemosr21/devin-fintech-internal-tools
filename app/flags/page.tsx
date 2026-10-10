import { listAuditEvents } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { listFlags } from "@/lib/flags";
import { when } from "@/lib/format";
import { can } from "@/lib/identity";
import { currentActor } from "@/lib/session";
import { FlagToggle } from "./FlagToggle";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const actor = await currentActor();
  if (!actor) return <p className="notice">Choose a demo identity above to view feature flags.</p>;
  const db = getDb();
  const flags = listFlags(db, actor);
  const canWrite = can(actor, "flags:write");

  return (
    <>
      <h1>Feature flags</h1>
      {!canWrite && <p className="notice">Your role ({actor.role}) can view but not change flags. The server enforces this too.</p>}
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Description</th>
            <th>State</th>
            <th>Last changed</th>
            <th>Audit events</th>
            {canWrite && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {flags.map((f) => (
            <tr key={f.key}>
              <td>
                <code>{f.key}</code>
              </td>
              <td>{f.description}</td>
              <td>
                <span className={`status ${f.enabled ? "status-approved" : "status-rejected"}`}>{f.enabled ? "on" : "off"}</span>
              </td>
              <td>
                {f.updated_by ? `${f.updated_by}, ` : ""}
                {when(f.updated_at)}
              </td>
              <td>{listAuditEvents(db, "feature_flag", f.key).length}</td>
              {canWrite && (
                <td>
                  <FlagToggle flagKey={f.key} enabled={f.enabled === 1} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
