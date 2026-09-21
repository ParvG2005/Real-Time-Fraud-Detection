import { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../App";
import { useData, Notice, Loading } from "../components/shared";
import { Reveal, CountUp, useReducedMotion } from "../components/Motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { number } from "../services/api";
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CircleDot,
  Fingerprint,
  FlaskConical,
  Layers3,
  MapPin,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

type Monitoring = {
  training: {
    model_version: string;
    dataset: string;
    train_rows: number;
    validation_rows: number;
    test_rows: number;
    precision: number;
    recall: number;
    f1: number;
    pr_auc: number;
    roc_auc: number;
    false_positive_rate: number;
    false_negative_rate: number;
    fraud_prevalence: number;
    confusion_matrix: Record<string, number>;
  };
  feedback: Record<string, number>;
  featureDrift: {
    feature: string;
    recentMean: number;
    trainingMean: number;
    standardizedShift: number;
  }[];
  driftSampleSize: number;
  note: string;
};
type Trend = {
  day: string;
  transactions: number;
  blocked: number;
  review: number;
  allowed: number;
};
type Group = { name: string; total: number; flagged: number };
const tooltipStyle = {
  background: "#fff",
  border: "1px solid #e3e8da",
  borderRadius: 12,
  boxShadow: "0 8px 30px #18392510",
  fontSize: 12,
};

export default function Analytics() {
  const { revision } = useSession();
  const reduced = useReducedMotion();
  const model = useData<Monitoring>("/analytics/model", revision);
  const breakdown = useData<Record<string, Group[]>>(
    "/analytics/breakdown",
    revision,
  );
  const trends = useData<Trend[]>("/analytics/fraud-trends", revision);
  const [range, setRange] = useState(7);
  const [chartMode, setChartMode] = useState("volume");
  const [dimension, setDimension] = useState("location");
  const [exported, setExported] = useState(false);
  const m = model.data;
  const series = (trends.data || []).slice(-range);
  const total = series.reduce((sum, x) => sum + x.transactions, 0);
  const flagged = series.reduce((sum, x) => sum + x.blocked + x.review, 0);
  const groups = breakdown.data?.[dimension] || [];
  const metrics = m
    ? [
        {
          name: "Precision",
          value: m.training.precision,
          icon: Target,
          description: "How often a fraud prediction is correct",
          tone: "green",
        },
        {
          name: "Recall",
          value: m.training.recall,
          icon: ScanLine,
          description: "How much of the labeled fraud is found",
          tone: "blue",
        },
        {
          name: "F1 score",
          value: m.training.f1,
          icon: Layers3,
          description: "The balance of precision and recall",
          tone: "violet",
        },
        {
          name: "PR-AUC",
          value: m.training.pr_auc,
          icon: TrendingUp,
          description: "Ranking quality across risk thresholds",
          tone: "amber",
        },
      ]
    : [];
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  }
  function exportReport() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              generatedAt: new Date().toISOString(),
              disclaimer:
                "Synthetic benchmark; no real-world performance claim.",
              monitoring: m,
              trends: series,
              breakdown: breakdown.data,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "fraudshield-analytics.json";
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  }
  return (
    <div className="analytics-page">
      <div className="analytics-topline">
        <div>
          <span className="eyebrow">WORKSPACE / INTELLIGENCE</span>
          <span className="analytics-page-label">Analytics</span>
        </div>
        <button className="secondary" onClick={exportReport} disabled={!m}>
          <ArrowDownToLine size={15} />
          {exported ? "Report exported" : "Export report"}
        </button>
      </div>
      <Notice error={model.error || breakdown.error || trends.error} />
      {!m ? (
        <Loading />
      ) : (
        <>
          <Reveal className="intelligence-hero">
            <div className="hero-mesh" aria-hidden="true" />
            <div className="hero-glow" aria-hidden="true" />
            <svg
              className="hero-waves"
              viewBox="0 0 1440 400"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="waveBlue" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3697ff" stopOpacity="0" />
                  <stop offset="40%" stopColor="#56bbff" stopOpacity=".7" />
                  <stop offset="100%" stopColor="#729dff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="waveRed" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ff465e" stopOpacity="0" />
                  <stop offset="70%" stopColor="#ff6675" stopOpacity=".65" />
                  <stop offset="100%" stopColor="#ff465e" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className="hero-wave-blue">
                <path
                  className="wave-haze"
                  d="M-100 290 C180 50 380 420 720 245 S1120 80 1550 265"
                  stroke="url(#waveBlue)"
                />
                <path
                  d="M-100 290 C180 50 380 420 720 245 S1120 80 1550 265"
                  stroke="url(#waveBlue)"
                />
                <path
                  d="M-100 310 C180 70 380 440 720 265 S1120 100 1550 285"
                  stroke="url(#waveBlue)"
                  opacity=".35"
                />
              </g>
              <g className="hero-wave-red">
                <path
                  className="wave-haze"
                  d="M-90 315 C220 455 440 125 770 285 S1220 400 1560 130"
                  stroke="url(#waveRed)"
                />
                <path
                  d="M-90 315 C220 455 440 125 770 285 S1220 400 1560 130"
                  stroke="url(#waveRed)"
                />
                <path
                  d="M-90 331 C220 471 440 141 770 301 S1220 416 1560 146"
                  stroke="url(#waveRed)"
                  opacity=".3"
                />
              </g>
            </svg>
            <div className="intelligence-copy">
              <div className="intelligence-kicker">
                <Sparkles size={13} />
                <span>SEE BEYOND THE TRANSACTION</span>
                <span className="hero-status">
                  <i />
                  {model.error ? "MODEL OFFLINE" : "MODEL ACTIVE"}
                </span>
              </div>
              <h1>
                Intelligence,
                <br />
                <span>in focus.</span>
              </h1>
              <p>
                Find the patterns. Understand the model.
                <br />
                Turn every signal into a better-informed decision.
              </p>
              <div className="hero-chips">
                <span>
                  <FlaskConical size={12} />
                  Synthetic holdout
                </span>
                <span>{number(m.training.test_rows)} test samples</span>
                <span>{m.training.model_version}</span>
              </div>
              <button
                className="hero-scroll"
                onClick={() => scrollTo("activity")}
              >
                <ArrowDown size={15} />
                Explore the signals
              </button>
            </div>
            <div className="model-orbit">
              <div className="orbit-label">
                <CircleDot size={12} /> MODEL PERFORMANCE
              </div>
              <div className="orbit-visual">
                <svg viewBox="0 0 240 240" aria-hidden="true">
                  <circle className="orbit-guide" cx="120" cy="120" r="111" />
                  <circle className="orbit-track" cx="120" cy="120" r="91" />
                  <circle
                    className="orbit-value"
                    cx="120"
                    cy="120"
                    r="91"
                    strokeDasharray={`${m.training.pr_auc * 572} 572`}
                    transform="rotate(-90 120 120)"
                  />
                  <circle className="orbit-inner" cx="120" cy="120" r="70" />
                </svg>
                <div className="orbit-number">
                  <small>PRECISION–RECALL AUC</small>
                  <strong>
                    <CountUp value={m.training.pr_auc} decimals={3} />
                  </strong>
                  <span>Held-out synthetic evaluation</span>
                </div>
                <span
                  className="orbit-satellite satellite-one"
                  aria-hidden="true"
                />
                <span
                  className="orbit-satellite satellite-two"
                  aria-hidden="true"
                />
              </div>
              <div className="orbit-footer">
                <span>
                  <i />
                  Measured, never hardcoded
                </span>
                <ShieldCheck size={14} />
              </div>
            </div>
          </Reveal>
          <div className="analytics-jumpnav" aria-label="Analytics sections">
            {[
              ["activity", "Activity"],
              ["patterns", "Patterns"],
              ["evaluation", "Model quality"],
              ["feedback", "Human feedback"],
            ].map(([id, label], i) => (
              <button key={id} onClick={() => scrollTo(id)}>
                <span>0{i + 1}</span>
                {label}
                <ArrowDown size={12} />
              </button>
            ))}
            <span className="jumpnav-note">
              <FlaskConical size={12} />
              Local demo · live records
            </span>
          </div>
          <div className="analytics-kpis">
            {metrics.map((metric, i) => (
              <Reveal
                key={metric.name}
                delay={i * 80}
                className={`analytics-kpi ${metric.tone}`}
              >
                <div className="kpi-heading">
                  <span>{metric.name}</span>
                  <span className="kpi-icon">
                    <metric.icon size={17} />
                  </span>
                </div>
                <strong>
                  <CountUp value={metric.value * 100} decimals={2} />
                  <small>%</small>
                </strong>
                <div className="kpi-meter" aria-hidden="true">
                  <i style={{ width: `${metric.value * 100}%` }} />
                </div>
                <p>{metric.description}</p>
                <span className="kpi-footnote">Measured on the test split</span>
              </Reveal>
            ))}
          </div>
          <Reveal className="benchmark-note">
            <FlaskConical size={16} />
            <p>
              <strong>A benchmark, not a promise.</strong> These are measured
              synthetic-data results. They do not establish real-world fraud
              detection performance.
            </p>
          </Reveal>
          <Reveal id="activity" className="panel activity-explorer">
            <div className="analytics-panel-heading">
              <div>
                <div className="section-number">01 / ACTIVITY</div>
                <h2>Follow the flow.</h2>
                <p>
                  See how transaction activity translates into policy decisions.
                </p>
              </div>
              <div className="segmented" aria-label="Chart date range">
                {[7, 3].map((days) => (
                  <button
                    key={days}
                    aria-pressed={range === days}
                    className={range === days ? "selected" : ""}
                    onClick={() => setRange(days)}
                  >
                    Last {days} days
                  </button>
                ))}
              </div>
            </div>
            <div className="activity-summary">
              <div>
                <strong data-testid="activity-total">
                  <CountUp value={total} />
                </strong>
                <span>transactions in view</span>
              </div>
              <div>
                <strong>
                  <CountUp value={flagged} />
                </strong>
                <span>flagged for review</span>
              </div>
              <div>
                <strong>
                  <CountUp
                    value={total ? (flagged / total) * 100 : 0}
                    decimals={1}
                  />
                  <small>%</small>
                </strong>
                <span>flagged share</span>
              </div>
              <div className="chart-mode" aria-label="Chart display">
                <button
                  aria-pressed={chartMode === "volume"}
                  className={chartMode === "volume" ? "selected" : ""}
                  onClick={() => setChartMode("volume")}
                >
                  Volume
                </button>
                <button
                  aria-pressed={chartMode === "decisions"}
                  className={chartMode === "decisions" ? "selected" : ""}
                  onClick={() => setChartMode("decisions")}
                >
                  Decision mix
                </button>
              </div>
            </div>
            <div
              className="analytics-trend-chart"
              data-testid="activity-chart"
              data-range={range}
              data-mode={chartMode}
            >
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === "volume" ? (
                  <AreaChart
                    data={series}
                    margin={{ top: 15, right: 18, left: -15, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="analyticsVolume"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#5c99ec"
                          stopOpacity={0.32}
                        />
                        <stop
                          offset="100%"
                          stopColor="#5c99ec"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="analyticsBlocked"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#ff6d79"
                          stopOpacity={0.14}
                        />
                        <stop
                          offset="100%"
                          stopColor="#ff6d79"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 6"
                      vertical={false}
                      stroke="#e8ede1"
                    />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#839176" }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#839176" }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      name="All transactions"
                      type="monotone"
                      dataKey="transactions"
                      stroke="#64bdf3"
                      strokeWidth={2.5}
                      fill="url(#analyticsVolume)"
                      isAnimationActive={!reduced}
                      animationDuration={1000}
                    />
                    <Area
                      name="Blocked"
                      type="monotone"
                      dataKey="blocked"
                      stroke="#ff6d79"
                      strokeWidth={2}
                      fill="url(#analyticsBlocked)"
                      isAnimationActive={!reduced}
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={series}
                    margin={{ top: 15, right: 18, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 6"
                      vertical={false}
                      stroke="#e8ede1"
                    />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      name="Allowed"
                      dataKey="allowed"
                      stackId="decisions"
                      fill="#52b2dc"
                      isAnimationActive={!reduced}
                    />
                    <Bar
                      name="Review"
                      dataKey="review"
                      stackId="decisions"
                      fill="#cab57c"
                      isAnimationActive={!reduced}
                    />
                    <Bar
                      name="Blocked"
                      dataKey="blocked"
                      stackId="decisions"
                      fill="#ee5b6e"
                      radius={[5, 5, 0, 0]}
                      isAnimationActive={!reduced}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            <div className="analytics-chart-foot">
              <span>
                <i className="legend-green" />
                Actual transaction records
              </span>
              <span>Showing {series.length} daily buckets · server time</span>
            </div>
          </Reveal>
          <div className="analytics-pattern-grid">
            <Reveal id="patterns" className="panel pattern-explorer">
              <div className="analytics-panel-heading">
                <div>
                  <div className="section-number">02 / PATTERNS</div>
                  <h2>Where signals cluster.</h2>
                  <p>Explore flagged activity across your lending ecosystem.</p>
                </div>
                <Fingerprint size={22} />
              </div>
              <div
                className="dimension-tabs"
                aria-label="Group transactions by"
              >
                {[
                  ["location", "Location", MapPin],
                  ["transaction_type", "Type", Layers3],
                  ["device_id", "Device", Fingerprint],
                ].map(([key, label, Icon]) => {
                  const Glyph = Icon as typeof MapPin;
                  return (
                    <button
                      key={String(key)}
                      aria-pressed={dimension === key}
                      className={dimension === key ? "selected" : ""}
                      onClick={() => setDimension(String(key))}
                    >
                      <Glyph size={14} />
                      {String(label)}
                    </button>
                  );
                })}
              </div>
              <div
                className="analytics-breakdown-chart"
                data-testid="breakdown-chart"
                data-dimension={dimension}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={groups}
                    layout="vertical"
                    margin={{ left: 2, right: 24, bottom: 0, top: 10 }}
                  >
                    <CartesianGrid
                      horizontal={false}
                      strokeDasharray="3 6"
                      stroke="#e8ede1"
                    />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#87957b" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={116}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#6b8060" }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar
                      name="All transactions"
                      dataKey="total"
                      fill="#274d6b"
                      radius={[0, 4, 4, 0]}
                      barSize={12}
                      isAnimationActive={!reduced}
                    />
                    <Bar
                      name="Flagged"
                      dataKey="flagged"
                      fill="#59b4e6"
                      radius={[0, 4, 4, 0]}
                      barSize={12}
                      isAnimationActive={!reduced}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="analytics-chart-foot">
                <span>
                  <i className="legend-pale" />
                  All transactions <i className="legend-green" />
                  Flagged
                </span>
                <span>Top {groups.length} groups</span>
              </div>
            </Reveal>
            <Reveal className="feature-observatory" delay={90}>
              <div className="analytics-panel-heading">
                <div>
                  <div className="section-number">BEHAVIORAL OBSERVATORY</div>
                  <h2>Notice the shift.</h2>
                  <p>Recent feature means vs. the training distribution.</p>
                </div>
                <Activity size={22} />
              </div>
              <div className="shift-sample">
                <span className="pulse-dot" />
                <strong>{m.driftSampleSize}</strong> recent records in view
              </div>
              <div className="feature-shift-bars">
                {[...m.featureDrift]
                  .sort((a, b) => b.standardizedShift - a.standardizedShift)
                  .slice(0, 5)
                  .map((f, i) => (
                    <div className="feature-shift-row" key={f.feature}>
                      <div>
                        <span>{f.feature.replaceAll("_", " ")}</span>
                        <strong>
                          {f.standardizedShift.toFixed(2)}
                          <small> σ</small>
                        </strong>
                      </div>
                      <div className="feature-shift-track">
                        <i
                          style={{
                            width: `${Math.min(f.standardizedShift / 4, 1) * 100}%`,
                            transitionDelay: `${i * 70}ms`,
                          }}
                        />
                      </div>
                      <small>
                        Recent {number(f.recentMean)} · training{" "}
                        {number(f.trainingMean)}
                      </small>
                    </div>
                  ))}
              </div>
              <div className="observatory-note">
                <CircleDot size={14} />
                <p>
                  Descriptive screening, not an automated drift alarm. Visual
                  scale: 0–4 standard deviations.
                </p>
              </div>
            </Reveal>
          </div>
          <div className="analytics-bottom-grid">
            <Reveal id="evaluation" className="panel evaluation-panel">
              <div className="analytics-panel-heading">
                <div>
                  <div className="section-number">03 / MODEL QUALITY</div>
                  <h2>Evaluation record</h2>
                  <p>The numbers behind the model. No hidden test split.</p>
                </div>
                <FlaskConical size={21} />
              </div>
              <div className="dataset-split">
                <div className="split-track">
                  <i style={{ width: "60%" }} />
                  <i style={{ width: "20%" }} />
                  <i style={{ width: "20%" }} />
                </div>
                <div>
                  {[
                    ["Training", m.training.train_rows],
                    ["Validation", m.training.validation_rows],
                    ["Test", m.training.test_rows],
                  ].map(([name, value]) => (
                    <span key={name}>
                      <small>{name}</small>
                      <strong>{number(Number(value))}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <dl className="evaluation-stats">
                {[
                  ["ROC-AUC", (m.training.roc_auc * 100).toFixed(2) + "%"],
                  [
                    "False positive rate",
                    (m.training.false_positive_rate * 100).toFixed(2) + "%",
                  ],
                  [
                    "False negative rate",
                    (m.training.false_negative_rate * 100).toFixed(2) + "%",
                  ],
                  [
                    "Synthetic fraud prevalence",
                    (m.training.fraud_prevalence * 100).toFixed(2) + "%",
                  ],
                ].map(([name, value]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="evaluation-model">
                <span>
                  <Check size={14} />
                  Reproducible synthetic benchmark
                </span>
                <code>{m.training.model_version}</code>
              </div>
            </Reveal>
            <Reveal
              id="feedback"
              className="panel feedback-matrix-panel"
              delay={80}
            >
              <div className="analytics-panel-heading">
                <div>
                  <div className="section-number">04 / HUMAN FEEDBACK</div>
                  <h2>Every review teaches us.</h2>
                  <p>
                    {m.feedback.reviewed} analyst-reviewed transactions. A
                    selected subset.
                  </p>
                </div>
                <Users size={21} />
              </div>
              <div
                className="confusion-matrix"
                aria-label="Analyst feedback confusion matrix"
              >
                {[
                  {
                    name: "True positives",
                    value: m.feedback.true_positive,
                    note: "Flagged · confirmed fraud",
                    className: "true-positive",
                  },
                  {
                    name: "False positives",
                    value: m.feedback.false_positive,
                    note: "Flagged · legitimate",
                    className: "false-positive",
                  },
                  {
                    name: "False negatives",
                    value: m.feedback.false_negative,
                    note: "Allowed · confirmed fraud",
                    className: "false-negative",
                  },
                  {
                    name: "True negatives",
                    value: m.feedback.true_negative,
                    note: "Allowed · legitimate",
                    className: "true-negative",
                  },
                ].map((cell) => (
                  <div className={cell.className} key={cell.name}>
                    <span>{cell.name}</span>
                    <strong>
                      <CountUp value={cell.value} />
                    </strong>
                    <small>{cell.note}</small>
                  </div>
                ))}
              </div>
              <div className="feedback-footnote">
                Reviewed cases are not an unbiased sample of all activity.
                Feedback is retained for future model training.
              </div>
              <Link to="/investigations" className="feedback-link">
                Go from insight to investigation <ArrowUpRight size={16} />
              </Link>
            </Reveal>
          </div>
          <Reveal className="analytics-closing">
            <span className="closing-symbol">
              <ShieldCheck size={25} />
            </span>
            <div>
              <h3>Better signals. Clearer decisions.</h3>
              <p>Keep the evidence visible—and the human in the loop.</p>
            </div>
            <Link to="/demo" className="primary">
              Test a scenario <ArrowUpRight size={15} />
            </Link>
          </Reveal>
        </>
      )}
    </div>
  );
}
