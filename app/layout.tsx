import type { Metadata } from "next";
import Link from "next/link";
import { currentActor } from "@/lib/session";
import { IdentitySwitcher } from "./IdentitySwitcher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal tools — refunds review (prototype)",
  description: "Prototype internal tool built with Devin. Synthetic data.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await currentActor();
  return (
    <html lang="en">
      <body>
        <IdentitySwitcher actor={actor} />
        <header className="topnav">
          <Link href="/refunds">Refunds review</Link>
          <Link href="/flags">Feature flags</Link>
          <span className="muted">Synthetic data · prototype</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
