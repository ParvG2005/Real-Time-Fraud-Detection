import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useSession } from "../App";
import {
  useData,
  PageTitle,
  Notice,
  Loading,
  TransactionTable,
  Status,
} from "../components/shared";
import { api, message } from "../services/api";
import type { Transaction } from "../types";
export default function Transactions({
  mode,
}: {
  mode: "transactions" | "alerts" | "investigations";
}) {
  const { revision, user } = useSession();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [filter, setFilter] = useState("");
  const [risk, setRisk] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const titles = {
    transactions: ["Live transactions", "Every transaction. Every signal."],
    alerts: ["Fraud alerts", "Surface the activity that needs your attention."],
    investigations: [
      "Investigation queue",
      "Connect evidence to an informed decision.",
    ],
  };
  const q = new URLSearchParams({ page: String(page), pageSize: "15", search });
  if (filter) q.set("decision", filter);
  if (risk) q.set("riskLevel", risk);
  if (date) q.set("dateFrom", new Date(date).toISOString());
  const list = useData<{ items: Transaction[]; total: number } | Transaction[]>(
    mode === "transactions"
      ? "/transactions?" + q
      : mode === "alerts"
        ? "/fraud/alerts"
        : "/investigations",
    revision,
  );
  let items = Array.isArray(list.data) ? list.data : list.data?.items || [];
  if (mode !== "transactions")
    items = items.filter(
      (t) =>
        (!filter || t.decision === filter) &&
        (!risk || t.riskLevel === risk) &&
        (!date || t.timestamp >= new Date(date).toISOString()) &&
        `${t.id} ${t.userId}`.toLowerCase().includes(search.toLowerCase()),
    );
  return (
    <>
      <PageTitle
        eyebrow="OPERATIONS / LIVE INTELLIGENCE"
        title={titles[mode][0]}
        description={titles[mode][1]}
        action={
          mode === "investigations" && user.role !== "VIEWER" ? (
            <button
              className="secondary"
              onClick={async () => {
                try {
                  const r = await api.get("/feedback/export", {
                    responseType: "blob",
                  });
                  const url = URL.createObjectURL(r.data);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "feedback.jsonl";
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  setError(message(e));
                }
              }}
            >
              <Download size={16} />
              Export feedback
            </button>
          ) : (
            <Link className="secondary" to="/demo">
              Open demo studio
            </Link>
          )
        }
      />
      <Notice error={list.error || error} />
      <div className="filters">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search transactions"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search transaction or customer…"
          />
        </div>
        <select
          aria-label="Decision filter"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All decisions</option>
          {["ALLOW", "REVIEW", "BLOCK"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Risk filter"
          value={risk}
          onChange={(e) => {
            setRisk(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All risk levels</option>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          type="date"
          aria-label="From date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {mode === "investigations" && (
        <div className="case-summary">
          {items.filter((t) => t.investigation?.status === "OPEN").length} open
          ·{" "}
          {items.filter((t) => t.investigation?.status === "ESCALATED").length}{" "}
          escalated · Original policy decisions remain preserved after review.
        </div>
      )}
      <section className="panel">
        {list.loading && !list.data ? (
          <Loading />
        ) : (
          <TransactionTable items={items} />
        )}
      </section>
      {mode === "transactions" && !Array.isArray(list.data) && (
        <div className="pagination">
          <span>
            {list.data?.total || 0} transactions · Page {page}
          </span>
          <div>
            <button
              aria-label="Previous page"
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              aria-label="Next page"
              className="secondary"
              disabled={page * 15 >= (list.data?.total || 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
