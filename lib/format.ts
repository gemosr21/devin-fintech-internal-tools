export function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function when(iso: string | null) {
  return iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—";
}
