import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, LoaderCircle, Search } from "lucide-react";
import { api, message, money } from "../services/api";
import type { Transaction } from "../types";
export function useData<T>(url: string, revision = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api
      .get<T>(url)
      .then((r) => {
        if (live) {
          setData(r.data);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(message(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [url, revision]);
  return { data, error, loading, setData };
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      <i />
      {value.replaceAll("_", " ")}
    </span>
  );
}
export function Notice({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={20} /> Loading live data…
    </div>
  );
}
export function Empty({
  text = "No transactions match these filters.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Search size={24} />
      <h3>Nothing here yet</h3>
      <p>{text}</p>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function TransactionTable({ items }: { items: Transaction[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Transaction / Customer</th>
            <th>Amount</th>
            <th>Location</th>
            <th>Risk score</th>
            <th>Decision</th>
            <th>Time</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>
                <Link className="transaction-link" to={`/transactions/${t.id}`}>
                  TX-{t.id.slice(0, 8).toUpperCase()}
                </Link>
                <small>
                  {t.userId} · {t.transactionType.toLowerCase()}
                </small>
              </td>
              <td className="amount">{money(t.amount)}</td>
              <td>
                {t.location}
                <small>{t.deviceId}</small>
              </td>
              <td>
                <div className="risk-inline">
                  <span>{t.risk.final.toFixed(0)}</span>
                  <div className="mini-track">
                    <i
                      className={t.decision.toLowerCase()}
                      style={{ width: `${t.risk.final}%` }}
                    />
                  </div>
                </div>
              </td>
              <td>
                <Status value={t.decision} />
              </td>
              <td className="muted">
                {new Date(t.timestamp).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <small>
                  {new Date(t.timestamp).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </small>
              </td>
              <td>
                <Link
                  className="icon-button"
                  aria-label={`View transaction ${t.id.slice(0, 8)}`}
                  to={`/transactions/${t.id}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <Empty />}
    </div>
  );
}
