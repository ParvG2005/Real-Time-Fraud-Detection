import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Fingerprint,
  MapPin,
  Clock,
  BrainCircuit,
  Check,
  FileText,
  ArrowUpRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { useSession } from "../App";
import {
  useData,
  PageTitle,
  Status,
  Notice,
  Loading,
} from "../components/shared";
import { api, message, money, number } from "../services/api";
import type { Transaction } from "../types";
export default function Detail() {
  const { id } = useParams();
  const { revision, refresh, user } = useSession();
  const {
    data: t,
    error,
    loading,
  } = useData<Transaction>(`/transactions/${id}`, revision);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState("");
  const [tab, setTab] = useState("Evidence");
  const history = useData<{ items: Transaction[] }>(
    `/transactions?userId=${t?.userId || "none"}&pageSize=10`,
    revision,
  );
  async function decide(decision: string) {
    if (!t) return;
    setSaving(true);
    setSaveError("");
    try {
      let iid = t.investigation?.id;
      if (!iid) {
        iid = (await api.post(`/fraud/${t.id}/investigate`)).data.id;
      }
      await api.post(`/investigations/${iid}/decision`, { decision, notes });
      setSaved(
        `Investigation saved: ${decision}. Original policy decision is preserved.`,
      );
      refresh();
    } catch (e) {
      setSaveError(message(e));
    } finally {
      setSaving(false);
    }
  }
  if (!t)
    return (
      <>
        <Notice error={error} />
        {loading && <Loading />}
      </>
    );
  const contributions = [...t.shapValues]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 8);
  return (
    <>
      <Link to="/transactions" className="back-link">
        <ArrowLeft size={15} />
        Back to transactions
      </Link>
      <PageTitle
        eyebrow="CASE WORKSPACE / TRANSACTION DETAILS"
        title={`TX-${t.id.slice(0, 8).toUpperCase()}`}
        description={`${t.userId} · ${new Date(t.timestamp).toLocaleString("en-IN")} · ${t.demo ? "Synthetic demo transaction" : "Submitted transaction"}`}
        action={<Status value={t.decision} />}
      />
      <Notice error={error} />
      {t.degraded && (
        <div className="error">
          ML was unavailable for this decision. Mandatory review policy applied.
        </div>
      )}
      <div className="detail-hero">
        <div>
          <span className="eyebrow">TRANSACTION AMOUNT</span>
          <h2>{money(t.amount)}</h2>
          <span>
            {t.transactionType} · {t.merchantId}
          </span>
        </div>
        <div className="hero-detail">
          <Fingerprint size={20} />
          <span>
            Device<strong>{t.deviceId}</strong>
          </span>
        </div>
        <div className="hero-detail">
          <MapPin size={20} />
          <span>
            Location<strong>{t.location}</strong>
          </span>
        </div>
        <div className="hero-detail">
          <Clock size={20} />
          <span>
            Decision time<strong>{t.processingMs} ms</strong>
          </span>
        </div>
        <div className={`risk-orb ${t.decision.toLowerCase()}`}>
          <strong>{t.risk.final.toFixed(1)}</strong>
          <span>{t.riskLevel} RISK</span>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {["Evidence", "Explainability", "Similar cases", "History"].map((x) => (
          <button
            role="tab"
            aria-selected={tab === x}
            className={tab === x ? "active" : ""}
            key={x}
            onClick={() => setTab(x)}
          >
            {x}
            {x === "Similar cases" && <span>{t.similarCases.length}</span>}
          </button>
        ))}
      </div>
      <div className="detail-grid">
        <div className="detail-content">
          {tab === "Evidence" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Five signals. One policy decision.</h2>
                    <p>Configured weights combine independent evidence.</p>
                  </div>
                  <ShieldCheck size={20} />
                </div>
                <div className="signal-list">
                  {[
                    ["ml", "ML prediction", 35],
                    ["rules", "Detection rules", 20],
                    ["behavior", "Behavior analysis", 25],
                    ["anomaly", "Anomaly percentile", 10],
                    ["historical", "Historical similarity", 10],
                  ].map(([key, label, weight], index) => (
                    <div className="signal" key={key}>
                      <div>
                        <strong>{label}</strong>
                        <small>
                          {(
                            (t.riskWeights?.[index] ?? Number(weight) / 100) *
                            100
                          ).toFixed(0)}
                          % weight
                        </small>
                      </div>
                      <div className="signal-track">
                        <i style={{ width: `${t.risk[key]}%` }} />
                      </div>
                      <b>{t.risk[key].toFixed(1)}</b>
                    </div>
                  ))}
                </div>
                <div className="panel-foot">
                  ALLOW &lt; 40 · REVIEW 40–69.99 · BLOCK ≥ 70. Weights are demo
                  policy, not industry standards.
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Observed risk factors</h2>
                    <p>Evidence captured at the time of the decision.</p>
                  </div>
                </div>
                <ul className="evidence-list">
                  {t.factors.map((f) => (
                    <li key={f}>
                      <span>
                        <Check size={14} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
          {tab === "Explainability" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>What moved the model?</h2>
                    <p>
                      TreeSHAP contributions · log-odds, not probability points.
                    </p>
                  </div>
                  <BrainCircuit size={20} />
                </div>
                <div className="shap-chart">
                  <ResponsiveContainer width="100%" height={310}>
                    <BarChart
                      data={contributions}
                      layout="vertical"
                      margin={{ left: 20, right: 25 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="feature"
                        width={130}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <ReferenceLine x={0} stroke="#aab5ae" />
                      <Bar dataKey="value" radius={3}>
                        {contributions.map((x) => (
                          <Cell
                            key={x.feature}
                            fill={x.value > 0 ? "#ff6477" : "#6acbdf"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="panel-foot">
                  Positive values increase predicted fraud risk. Base log-odds:{" "}
                  {t.shapBaseValue.toFixed(3)}. Model: {t.modelVersion}.
                </div>
              </section>
              <section className="panel explanation">
                <div className="panel-heading">
                  <div>
                    <h2>Decision explanation</h2>
                    <p>
                      {t.explanation.source === "aws-bedrock"
                        ? "AWS Bedrock narrative"
                        : "Local evidence-based explanation · no LLM used"}
                    </p>
                  </div>
                  <FileText size={20} />
                </div>
                <div className="prose">
                  <p>{t.explanation.summary}</p>
                  <h4>Observed evidence</h4>
                  <ul>
                    {t.explanation.evidence.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                  <h4>Interpretation</h4>
                  <p>{t.explanation.inference}</p>
                  <h4>Next steps</h4>
                  <ul>
                    {t.explanation.recommended_investigation.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              </section>
            </>
          )}
          {tab === "Similar cases" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Historical pattern matches</h2>
                  <p>
                    pgvector cosine search ·{" "}
                    {t.embeddingProvider?.startsWith("local")
                      ? "local text hashing, 256 dimensions"
                      : "Bedrock embeddings"}
                  </p>
                </div>
              </div>
              {t.similarCases.length ? (
                t.similarCases.map((c) => (
                  <article key={c.id} className="similar-case">
                    <div>
                      <span className="eyebrow">
                        CASE {c.id.slice(0, 8).toUpperCase()}
                      </span>
                      <h3>{c.fraudType}</h3>
                    </div>
                    <span className="similarity">
                      {(c.similarity * 100).toFixed(1)}% match
                    </span>
                    <p>{c.notes}</p>
                    <small>
                      {c.synthetic
                        ? "Synthetic reference case"
                        : "Analyst-confirmed case"}{" "}
                      · Similarity indicates pattern overlap, not proof.
                    </small>
                  </article>
                ))
              ) : (
                <div className="empty">
                  No confirmed case exceeded the similarity threshold.
                </div>
              )}
            </section>
          )}
          {tab === "History" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Customer activity</h2>
                  <p>Recent activity for {t.userId}</p>
                </div>
              </div>
              {history.data?.items.map((h) => (
                <Link
                  className="history-row"
                  key={h.id}
                  to={`/transactions/${h.id}`}
                >
                  <span>
                    {new Date(h.timestamp).toLocaleString("en-IN")}
                    <small>
                      {h.deviceId} · {h.location}
                    </small>
                  </span>
                  <strong>{money(h.amount)}</strong>
                  <Status value={h.decision} />
                </Link>
              ))}
              <div className="panel-heading">
                <h2>Captured features</h2>
              </div>
              <dl className="feature-grid">
                {Object.entries(t.features).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k.replaceAll("_", " ")}</dt>
                    <dd>{number(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
        <aside className="investigation-panel panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">HUMAN IN THE LOOP</span>
              <h2>Analyst workspace</h2>
            </div>
          </div>
          <div className="investigation-body">
            <Status value={t.investigation?.status || "NOT_OPENED"} />
            <p>
              Review the evidence before recording a decision. Your label is
              saved for future model training.
            </p>
            {t.investigation?.notes && (
              <blockquote>{t.investigation.notes}</blockquote>
            )}
            {user.role === "VIEWER" ? (
              <div className="info">Your viewer role has read-only access.</div>
            ) : (
              <>
                <label>
                  Investigation notes
                  <textarea
                    rows={5}
                    placeholder="Document what you verified and why…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={4000}
                  />
                </label>
                <small className="muted">
                  At least 5 characters. Avoid personal information.
                </small>
                <Notice error={saveError} />
                {saved && (
                  <div className="success" role="status">
                    {saved}
                  </div>
                )}
                <div className="decision-buttons">
                  <button
                    className="danger"
                    disabled={saving || notes.trim().length < 5}
                    onClick={() => decide("FRAUD")}
                  >
                    Confirm fraud
                  </button>
                  <button
                    className="secondary"
                    disabled={saving || notes.trim().length < 5}
                    onClick={() => decide("LEGITIMATE")}
                  >
                    Mark legitimate
                  </button>
                  <button
                    className="text-button"
                    disabled={saving || notes.trim().length < 5}
                    onClick={() => decide("ESCALATED")}
                  >
                    Escalate for review <ArrowUpRight size={15} />
                  </button>
                </div>
              </>
            )}
            <div className="timeline">
              <h4>Case timeline</h4>
              <p>
                <i />
                Transaction received
                <small>{new Date(t.createdAt).toLocaleString()}</small>
              </p>
              <p>
                <i />
                Policy decision: {t.decision}
                <small>
                  Score {t.risk.final} · {t.processingMs} ms
                </small>
              </p>
              {t.investigation && (
                <p>
                  <i />
                  Investigation: {t.investigation.status}
                  <small>
                    {new Date(t.investigation.updated_at).toLocaleString()}
                  </small>
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
