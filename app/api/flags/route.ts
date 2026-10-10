import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { listFlags } from "@/lib/flags";
import { actorFromRequest, handle } from "@/lib/http";

export async function GET(request: NextRequest) {
  return handle(() => listFlags(getDb(), actorFromRequest(request)));
}
