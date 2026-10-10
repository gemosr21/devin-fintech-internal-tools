import { getDb } from "@/lib/db";
import { listUsers, type Actor } from "@/lib/identity";

export function IdentitySwitcher({ actor }: { actor: Actor | null }) {
  const users = listUsers(getDb());
  return (
    <div className="demo-banner" role="note">
      <strong>DEMO IDENTITY — NOT AUTHENTICATION.</strong> Anyone can pick any user. This only exists to exercise
      server-side permission checks.
      <form method="post" action="/api/demo-identity" className="switcher">
        <label>
          Acting as{" "}
          <select name="userId" defaultValue={actor?.id ?? ""}>
            <option value="">(none)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.role}
              </option>
            ))}
          </select>
        </label>{" "}
        <button type="submit">Switch</button>
      </form>
    </div>
  );
}
