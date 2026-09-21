import { ScrollStage } from "../components/Motion";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Activity,
  ShieldCheck,
  TriangleAlert,
  ScanSearch,
  Plus,
  ArrowRight,
  Radio,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useSession } from "../App";
import {
  useData,
  PageTitle,
  Notice,
  Loading,
  TransactionTable,
} from "../components/shared";
import { number, money } from "../services/api";
import type { Transaction } from "../types";
export default function Dashboard() {
  const { revision, user } = useSession();
  const health = useData<{ status: string }>("/system/health", revision);
  const overview = useData<Record<string, number>>(
    "/analytics/overview",
    revision,
  );
  const trends = useData<
    { day: string; transactions: number; blocked: number }[]
  >("/analytics/fraud-trends", revision);
  const distribution = useData<{ name: string; value: number }[]>(
    "/analytics/risk-distribution",
    revision,
  );
  const recent = useData<{ items: Transaction[] }>(
    "/transactions?pageSize=6",
    revision,
  );
  const d = overview.data;
  const colors: Record<string, string> = {
    Low: "#58c5ed",
    Medium: "#d2b36e",
    High: "#ff6477",
    Critical: "#e63953",
  };
  return (
    <ScrollStage>
      <PageTitle
        eyebrow="FRAUD OPERATIONS / OVERVIEW"
        title="A clearer view of every risk."
        description="Monitor activity, connect the signals, and act with confidence."
        action={
          <Link to="/demo" className="primary">
            <Plus size={17} />
            Simulate transaction
          </Link>
        }
      />
      <div className="system-strip">
        <span>
          <span className="pulse-dot" />
          {health.data?.status === "UP"
            ? "Detection pipeline active"
            : health.data
              ? "Detection pipeline degraded"
              : "Checking pipeline…"}
        </span>
        <span>Rules + XGBoost + behavioral analysis</span>
        <Link to="/analytics">
          View model performance <ArrowUpRight size={14} />
        </Link>
      </div>
      <Notice
        error={
          overview.error || trends.error || distribution.error || recent.error
        }
      />
      {!d ? (
        <Loading />
      ) : (
        <>
          <div className="metric-grid">
            {[
              {
                label: "Total transactions",
                value: number(d.total),
                hint: `${money(d.volume)} processed`,
                icon: Activity,
                className: "",
              },
              {
                label: "Blocked transactions",
                value: number(d.blocked),
                hint: `${money(d.blocked_volume)} held for review`,
                icon: ShieldCheck,
                className: "green",
              },
              {
                label: "Under review",
                value: number(d.review),
                hint: "Flagged for an analyst decision",
                icon: ScanSearch,
                className: "amber",
              },
              {
                label: "Confirmed fraud",
                value: number(d.confirmed_fraud),
                hint: "Confirmed by human analysts",
                icon: TriangleAlert,
                className: "rose",
              },
            ].map((m) => (
              <div className={`metric-card ${m.className}`} key={m.label}>
                <div className="metric-label">
                  {m.label}
                  <m.icon size={18} />
                </div>
                <strong>{m.value}</strong>
                <small>{m.hint}</small>
              </div>
            ))}
          </div>
          <div className="chart-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Transaction activity</h2>
                  <p>Your lending ecosystem, in motion.</p>
                </div>
                <span className="period">Last 7 days</span>
              </div>
              <div className="chart-legend">
                <span>
                  <i style={{ background: "#58c5ed" }} />
                  All transactions
                </span>
                <span>
                  <i style={{ background: "#ff6477" }} />
                  Blocked
                </span>
              </div>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trends.data || []}
                    margin={{ top: 10, right: 12, left: -24, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="areaGreen"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#499cda"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="#499cda"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 5"
                      vertical={false}
                      stroke="#e9ebe7"
                    />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#82877f", fontSize: 11 }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#82877f", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #e6e9e2",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="transactions"
                      stroke="#58c5ed"
                      strokeWidth={2.5}
                      fill="url(#areaGreen)"
                    />
                    <Area
                      type="monotone"
                      dataKey="blocked"
                      stroke="#ff6477"
                      strokeWidth={2}
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel risk-panel">
              <div className="panel-heading">
                <div>
                  <h2>Risk distribution</h2>
                  <p>Every decision, at a glance.</p>
                </div>
                <ShieldCheck size={19} />
              </div>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={distribution.data || []}
                      innerRadius={65}
                      outerRadius={83}
                      dataKey="value"
                      paddingAngle={4}
                      stroke="none"
                    >
                      {distribution.data?.map((x) => (
                        <Cell key={x.name} fill={colors[x.name]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-label">
                  <strong>{d.flagged_rate}%</strong>
                  <small>flagged for review</small>
                </div>
              </div>
              <div className="risk-legend">
                {["Low", "Medium", "High", "Critical"].map((n) => (
                  <div key={n}>
                    <span>
                      <i style={{ background: colors[n] }} />
                      {n} risk
                    </span>
                    <strong>
                      {distribution.data?.find((x) => x.name === n)?.value || 0}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="panel recent-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  Recent transactions{" "}
                  <span className="live-label">
                    <Radio size={11} />
                    LIVE
                  </span>
                </h2>
                <p>A live feed of decisions across your workspace.</p>
              </div>
              <Link to="/transactions" className="text-link">
                View all transactions <ArrowUpRight size={16} />
              </Link>
            </div>
            {recent.data ? (
              <TransactionTable items={recent.data.items} />
            ) : (
              <Loading />
            )}
          </section>
          <div className="bottom-grid">
            <div className="insight-card">
              <span className="insight-icon">
                <ScanSearch />
              </span>
              <div>
                <h3>{d.open_investigations} cases need a closer look</h3>
                <p>
                  Review the evidence. Give every decision a human perspective.
                </p>
              </div>
              <Link to="/investigations" className="secondary">
                Open investigations <ArrowRight size={16} />
              </Link>
            </div>
            <div className="latency-card">
              <Activity size={22} />
              <div>
                <strong>
                  {number(d.average_processing_ms)}
                  <small> ms</small>
                </strong>
                <span>Average decision time · measured locally</span>
              </div>
            </div>
          </div>
        </>
      )}
    </ScrollStage>
  );
}
