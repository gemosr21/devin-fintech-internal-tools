import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { setFlag } from "@/lib/flags";
import { actorFromRequest, handle } from "@/lib/http";

export async function POST(request: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const body = await request.json().catch(() => null);
  return handle(() => setFlag(getDb(), actorFromRequest(request), key, body));
}
