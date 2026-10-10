import { NextResponse, type NextRequest } from "next/server";
import { DEMO_IDENTITY_COOKIE } from "@/lib/identity";

// Demo identity switcher. NOT authentication: anyone can set any identity.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const userId = String(form.get("userId") ?? "");
  const back = String(form.get("returnTo") ?? "/refunds");
  const res = NextResponse.redirect(safeReturnUrl(back, request.url), 303);
  if (userId) res.cookies.set(DEMO_IDENTITY_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
  else res.cookies.delete(DEMO_IDENTITY_COOKIE);
  return res;
}

function safeReturnUrl(back: string, base: string): URL {
  const fallback = new URL("/refunds", base);
  if (!back.startsWith("/") || back.startsWith("//") || back.startsWith("/\\")) return fallback;
  const url = new URL(back, base);
  return url.origin === fallback.origin ? url : fallback;
}
