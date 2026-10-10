import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { actorFromRequest, handle } from "@/lib/http";
import { listRefunds } from "@/lib/refunds";

export async function GET(request: NextRequest) {
  return handle(() => {
    const params = request.nextUrl.searchParams;
    return listRefunds(getDb(), actorFromRequest(request), {
      status: params.get("status") ?? undefined,
      q: params.get("q") ?? undefined,
    });
  });
}
