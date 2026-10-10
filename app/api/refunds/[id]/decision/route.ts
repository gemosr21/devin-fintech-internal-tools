import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { actorFromRequest, handle } from "@/lib/http";
import { decideRefund } from "@/lib/refunds";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  return handle(() => decideRefund(getDb(), actorFromRequest(request), id, body));
}
