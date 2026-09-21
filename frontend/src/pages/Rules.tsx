import { useState } from "react";
import { Plus, Trash2, Save, X } from "lucide-react";
import { useSession } from "../App";
import {
  useData,
  PageTitle,
  Notice,
  Loading,
  Empty,
} from "../components/shared";
import { api, message } from "../services/api";
import type { Rule } from "../types";
const initial = {
  name: "",
  feature: "amount_ratio",
  operator: "GT",
  threshold: 5,
  riskWeight: 20,
  enabled: true,
  description: "",
};
export default function Rules() {
  const { revision, refresh, user } = useSession();
  const { data, error, loading } = useData<Rule[]>("/rules", revision);
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  async function toggle(r: Rule) {
    setFailure("");
    try {
      await api.put("/rules/" + r.id, {
        name: r.name,
        feature: r.feature,
        operator: r.operator,
        threshold: r.threshold,
        riskWeight: r.risk_weight,
        enabled: !r.enabled,
        description: r.description,
      });
      refresh();
    } catch (e) {
      setFailure(message(e));
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="POLICY / CONFIGURABLE DETECTION"
        title="Make your policy explicit."
        description="Changes apply to new transactions. Historical scores and evidence stay intact."
        action={
          user.role === "ADMIN" && (
            <button
              className="primary"
              onClick={() => {
                setEditing(null);
                setForm(initial);
                setOpen(true);
              }}
            >
              <Plus size={16} />
              Add rule
            </button>
          )
        }
      />
      <Notice error={error || failure} />
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="rules-grid">
          {data?.map((r) => (
            <article className="panel rule-card" key={r.id}>
              <div className="rule-top">
                <span className="eyebrow">DETECTION RULE</span>
                <button
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={`Enable ${r.name}`}
                  disabled={user.role !== "ADMIN"}
                  className={`toggle ${r.enabled ? "on" : ""}`}
                  onClick={() => toggle(r)}
                >
                  <i />
                </button>
              </div>
              <h2>{r.name}</h2>
              <p>{r.description}</p>
              <code>
                {r.feature}{" "}
                {r.operator === "GT" ? ">" : r.operator === "LT" ? "<" : "="}{" "}
                {r.threshold}
              </code>
              <div className="rule-bottom">
                <span>
                  <strong>+{r.risk_weight}</strong> risk points
                </span>
                {user.role === "ADMIN" && (
                  <div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setEditing(r.id);
                        setForm({
                          name: r.name,
                          feature: r.feature,
                          operator: r.operator,
                          threshold: r.threshold,
                          riskWeight: r.risk_weight,
                          enabled: r.enabled,
                          description: r.description,
                        });
                        setOpen(true);
                      }}
                    >
                      Edit rule
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${r.name}`}
                      onClick={() => setRemove(r.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              {remove === r.id && (
                <div className="delete-confirm">
                  <span>Delete this rule?</span>
                  <button
                    className="danger"
                    onClick={async () => {
                      try {
                        await api.delete("/rules/" + r.id);
                        refresh();
                        setRemove(null);
                      } catch (e) {
                        setFailure(message(e));
                      }
                    }}
                  >
                    Delete
                  </button>
                  <button className="secondary" onClick={() => setRemove(null)}>
                    Cancel
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {open && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Detection rule editor"
          >
            <div className="panel-heading">
              <h2>{editing ? "Edit detection rule" : "New detection rule"}</h2>
              <button
                className="icon-button"
                onClick={() => setOpen(false)}
                aria-label="Close editor"
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setFailure("");
                try {
                  await (editing
                    ? api.put("/rules/" + editing, form)
                    : api.post("/rules", form));
                  setOpen(false);
                  refresh();
                } catch (e) {
                  setFailure(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Rule name
                <input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Description
                <input
                  required
                  maxLength={300}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
              <label>
                Feature
                <select
                  value={form.feature}
                  onChange={(e) =>
                    setForm({ ...form, feature: e.target.value })
                  }
                >
                  {[
                    "amount_ratio",
                    "velocity_5min",
                    "new_device",
                    "location_change",
                    "failed_attempts",
                    "account_age",
                    "amount",
                    "previous_fraud_count",
                    "night_transaction",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Operator
                  <select
                    value={form.operator}
                    onChange={(e) =>
                      setForm({ ...form, operator: e.target.value })
                    }
                  >
                    {["GT", "LT", "EQ"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Threshold
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={form.threshold}
                    onChange={(e) =>
                      setForm({ ...form, threshold: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label>
                Risk points
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  value={form.riskWeight}
                  onChange={(e) =>
                    setForm({ ...form, riskWeight: Number(e.target.value) })
                  }
                />
              </label>
              <Notice error={failure} />
              <button className="primary" disabled={busy}>
                <Save size={16} />
                Save rule
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
