import { z } from "zod";
import type { DB } from "./db";
import { recordAudit as defaultRecordAudit } from "./audit";
import { HttpError } from "./errors";
import { requirePermission, type Actor } from "./identity";

export type FeatureFlag = {
  key: string;
  description: string;
  enabled: 0 | 1;
  updated_by: string | null;
  updated_at: string | null;
};

export const FlagInput = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export function listFlags(db: DB, actor: Actor | null): FeatureFlag[] {
  requirePermission(actor, "flags:read");
  return db.prepare("SELECT * FROM feature_flags ORDER BY key").all() as FeatureFlag[];
}

function findFlag(db: DB, key: string) {
  return db.prepare("SELECT * FROM feature_flags WHERE key = ?").get(key) as FeatureFlag | undefined;
}

export function setFlag(
  db: DB,
  actor: Actor | null,
  key: string,
  input: unknown,
  deps: { recordAudit: typeof defaultRecordAudit } = { recordAudit: defaultRecordAudit },
): FeatureFlag {
  const admin = requirePermission(actor, "flags:write");
  const parsed = FlagInput.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  const enabled = parsed.data.enabled ? 1 : 0;

  return db.transaction(() => {
    const before = findFlag(db, key);
    if (!before) throw new HttpError(404, `Flag ${key} not found`);
    if (before.enabled === enabled) throw new HttpError(409, `Flag ${key} is already ${enabled ? "on" : "off"}`);
    db.prepare("UPDATE feature_flags SET enabled = ?, updated_by = ?, updated_at = ? WHERE key = ? AND enabled = ?").run(
      enabled,
      admin.id,
      new Date().toISOString(),
      key,
      before.enabled,
    );
    const after = findFlag(db, key)!;
    deps.recordAudit(db, {
      actorId: admin.id,
      action: enabled ? "flag.enabled" : "flag.disabled",
      entityType: "feature_flag",
      entityId: key,
      before: { enabled: before.enabled === 1 },
      after: { enabled: after.enabled === 1 },
      reason: parsed.data.reason || null,
    });
    return after;
  })();
}
