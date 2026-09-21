import { useState } from "react";
import { useSession } from "../App";
import { useData, PageTitle, Notice, Loading } from "../components/shared";
import { api, message } from "../services/api";
import type { User } from "../types";
export default function Admin({ mode }: { mode: "users" | "audit" }) {
  const { user, revision, refresh } = useSession();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "VIEWER" });
  const result = useData<
    | User[]
    | {
        id: number;
        user_id: string;
        action: string;
        resource_id: string;
        timestamp: string;
      }[]
  >(user.role === "ADMIN" ? `/${mode}` : "/auth/me", revision);
  if (user.role !== "ADMIN")
    return <div className="empty">Administrator access is required.</div>;
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRATION / WORKSPACE"
        title={
          mode === "users"
            ? "The right access for every role."
            : "A record of every important action."
        }
        description={
          mode === "users"
            ? "Administrators manage policy. Analysts review cases. Viewers observe."
            : "Access, policy changes, and investigator decisions are recorded in PostgreSQL."
        }
      />
      <Notice error={error || result.error} />
      {mode === "users" && (
        <form
          className="panel form-grid admin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api.post("/auth/register", form);
              setForm({ email: "", password: "", role: "VIEWER" });
              refresh();
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Initial password
            <input
              required
              minLength={12}
              maxLength={72}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {["VIEWER", "ANALYST", "ADMIN"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={busy}>
            Create account
          </button>
        </form>
      )}
      <section className="panel table-scroll">
        {result.loading && !result.data ? (
          <Loading />
        ) : (
          <table>
            <thead>
              <tr>
                {(mode === "users"
                  ? ["Email", "Role", "User ID"]
                  : ["Action", "Actor", "Resource", "Time"]
                ).map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mode === "users"
                ? (result.data as User[])?.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>
                        <select
                          aria-label={`Role for ${u.email}`}
                          disabled={u.id === user.id}
                          value={u.role}
                          onChange={async (e) => {
                            try {
                              await api.put(`/users/${u.id}/role`, {
                                role: e.target.value,
                              });
                              refresh();
                            } catch (e) {
                              setError(message(e));
                            }
                          }}
                        >
                          {["VIEWER", "ANALYST", "ADMIN"].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <code>{u.id.slice(0, 12)}</code>
                      </td>
                    </tr>
                  ))
                : (
                    result.data as {
                      id: number;
                      action: string;
                      user_id: string;
                      resource_id: string;
                      timestamp: string;
                    }[]
                  )?.map((a) => (
                    <tr key={a.id}>
                      <td>{a.action}</td>
                      <td>{a.user_id.slice(0, 12)}</td>
                      <td>{a.resource_id.slice(0, 18)}</td>
                      <td>{new Date(a.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
