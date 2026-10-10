import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "./db";
import { HttpError } from "./errors";
import { DEMO_IDENTITY_COOKIE, resolveActor, type Actor } from "./identity";

export function actorFromRequest(request: NextRequest): Actor | null {
  return resolveActor(getDb(), request.cookies.get(DEMO_IDENTITY_COOKIE)?.value);
}

export async function handle(fn: () => unknown | Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
