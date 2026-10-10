import type { NextRequest } from "next/server";
import { listAuditEvents } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { actorFromRequest, handle } from "@/lib/http";
import { getRefund } from "@/lib/refunds";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(() => {
    const db = getDb();
    const refund = getRefund(db, actorFromRequest(request), id);
    return { refund, audit: listAuditEvents(db, "refund", id) };
  });
}
