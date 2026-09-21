import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  ShieldCheck,
  TriangleAlert,
  Fingerprint,
  UserCheck,
  ArrowRight,
  LoaderCircle,
  Send,
} from "lucide-react";
import { useSession } from "../App";
import { PageTitle, Status, Notice } from "../components/shared";
import { api, message, money } from "../services/api";
import type { Transaction } from "../types";
const scenarios = [
  {
    id: "NORMAL",
    title: "Everyday repayment",
    tag: "01 / NORMAL",
    description:
      "₹2,500 from a familiar device and city. A regular repayment with an established history.",
    icon: ShieldCheck,
    expected: "Expected: ALLOW",
  },
  {
    id: "HIGH_AMOUNT",
    title: "An amount worth a look",
    tag: "02 / HIGH AMOUNT",
    description:
      "₹50,000 against a ₹2,500 baseline. Familiar device, unusual amount.",
    icon: TriangleAlert,
    expected: "Expected: REVIEW",
  },
  {
    id: "TAKEOVER",
    title: "Connect the warning signs",
    tag: "03 / ACCOUNT TAKEOVER",
    description:
      "A new device, a changed city, and ₹65,000 after seven rapid transactions.",
    icon: Fingerprint,
    expected: "Expected: BLOCK",
  },
  {
    id: "FALSE_POSITIVE",
    title: "Keep a human in the loop",
    tag: "04 / ANALYST FEEDBACK",
    description:
      "An unusual but legitimate payment. Investigate it and record the legitimate label.",
    icon: UserCheck,
    expected: "Flag → investigate → clear",
  },
];
export default function Demo({
  onResult,
}: {
  onResult: (t: Transaction) => void;
}) {
  const { user } = useSession();
  const [running, setRunning] = useState("");
  const [result, setResult] = useState<Transaction | null>(null);
  const [error, setError] = useState("");
  const [custom, setCustom] = useState(false);
  const [form, setForm] = useState({
    userId: "DEMO_001",
    amount: 2500,
    deviceId: "DEVICE_KNOWN",
    location: "Bangalore",
    merchantId: "LENDWISE",
    transactionType: "REPAYMENT",
  });
  async function run(id: string) {
    setRunning(id);
    setError("");
    try {
      const r = await api.post("/demo/simulate", { scenario: id });
      setResult(r.data);
      onResult(r.data);
    } catch (e) {
      setError(message(e));
    } finally {
      setRunning("");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="PRESENTATION / INTERACTIVE DEMO"
        title="Watch the signals become a decision."
        description="Real requests. Real inference. A complete investigation in a few clicks."
      />
      <div className="demo-banner">
        <span className="demo-banner-icon">
          <Play size={24} />
        </span>
        <div>
          <h2>Your seven-minute walkthrough starts here.</h2>
          <p>
            Run a normal repayment, simulate a takeover, then open the evidence
            and record an analyst decision.
          </p>
        </div>
        <span className="demo-tag">100% LOCAL</span>
      </div>
      <Notice error={error} />
      <div className="scenario-grid">
        {scenarios.map((s) => (
          <article className="scenario panel" key={s.id}>
            <div className="scenario-top">
              <span className="eyebrow">{s.tag}</span>
              <s.icon size={24} />
            </div>
            <h2>{s.title}</h2>
            <p>{s.description}</p>
            <span className="scenario-expected">{s.expected}</span>
            <button
              className="primary"
              disabled={!!running || user.role === "VIEWER"}
              onClick={() => run(s.id)}
            >
              {running === s.id ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Play size={15} />
              )}{" "}
              {running === s.id ? "Evaluating transactions…" : "Run scenario"}
            </button>
          </article>
        ))}
      </div>
      {result && (
        <section className="result-card" aria-live="polite">
          <div>
            <span className="eyebrow">ACTUAL PIPELINE RESULT</span>
            <h2>
              {money(result.amount)} <Status value={result.decision} />
            </h2>
            <p>
              Risk {result.risk.final.toFixed(1)}/100 · {result.processingMs} ms
              · {result.factors.length} evidence factors
            </p>
          </div>
          <Link className="primary" to={`/transactions/${result.id}`}>
            Investigate this transaction <ArrowRight size={17} />
          </Link>
        </section>
      )}
      <div className="demo-method">
        <h3>What happens when you click?</h3>
        <div>
          {[
            "Build a synthetic customer history",
            "Submit through the transaction API",
            "Run ML, rules & vector retrieval",
            "Persist the decision & push a live event",
          ].map((s, i) => (
            <span key={s}>
              <b>0{i + 1}</b>
              {s}
            </span>
          ))}
        </div>
        <p>
          Each scenario uses a fresh synthetic customer. Scores are calculated,
          not hardcoded. The labels above describe expected default-policy
          behavior; rule changes can change outcomes.
        </p>
      </div>
      <section className="panel custom-request">
        <button
          className="panel-heading full-button"
          onClick={() => setCustom(!custom)}
        >
          <h2>Try your own transaction</h2>
          <span>{custom ? "−" : "+"}</span>
        </button>
        {custom && (
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              setRunning("CUSTOM");
              setError("");
              try {
                const r = await api.post("/transactions", form, {
                  headers: { "Idempotency-Key": crypto.randomUUID() },
                });
                setResult(r.data);
                onResult(r.data);
              } catch (e) {
                setError(message(e));
              } finally {
                setRunning("");
              }
            }}
          >
            {Object.entries(form).map(([k, v]) => (
              <label key={k}>
                {k}
                <input
                  required
                  value={v}
                  type={k === "amount" ? "number" : "text"}
                  min={k === "amount" ? 1 : undefined}
                  max={k === "amount" ? 10000000 : undefined}
                  step={k === "amount" ? "0.01" : undefined}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [k]:
                        k === "amount"
                          ? Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              </label>
            ))}
            <button
              className="primary"
              disabled={!!running || user.role === "VIEWER"}
            >
              <Send size={16} />
              Evaluate request
            </button>
          </form>
        )}
      </section>
    </>
  );
}
