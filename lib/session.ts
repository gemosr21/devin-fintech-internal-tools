import { cookies } from "next/headers";
import { getDb } from "./db";
import { DEMO_IDENTITY_COOKIE, resolveActor } from "./identity";

export async function currentActor() {
  const store = await cookies();
  return resolveActor(getDb(), store.get(DEMO_IDENTITY_COOKIE)?.value);
}
