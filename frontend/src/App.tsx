import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from "react";
import {
  Routes,
  Route,
  NavLink,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  ShieldCheck,
  LayoutDashboard,
  ArrowLeftRight,
  TriangleAlert,
  ScanSearch,
  ChartNoAxesCombined,
  SlidersHorizontal,
  LogOut,
  ArrowUpRight,
  Plus,
  Menu,
  X,
  Radio,
  Bell,
  BookOpen,
  Users,
  ScrollText,
} from "lucide-react";
import { api, message } from "./services/api";
import type { User, Transaction } from "./types";
import { Notice } from "./components/shared";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Detail from "./pages/Detail";
import Analytics from "./pages/Analytics";
import Rules from "./pages/Rules";
import Demo from "./pages/Demo";
import Admin from "./pages/Admin";
const Session = createContext<{
  user: User;
  revision: number;
  refresh: () => void;
}>({
  user: { id: "", email: "", role: "VIEWER" },
  revision: 0,
  refresh: () => {},
});
export const useSession = () => useContext(Session);
function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("admin@fraudshield.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <section className="login-story">
        <div className="brand">
          <ShieldCheck />
          <span>
            fraudshield<span className="brand-ai">AI</span>
          </span>
        </div>
        <div>
          <span className="eyebrow">TRUST, AT THE SPEED OF TRANSACTIONS</span>
          <h1>
            See the signal.
            <br />
            Stop the fraud.
          </h1>
          <p>
            Real-time intelligence that connects every signal to a clear,
            explainable decision.
          </p>
          <div className="login-flow">
            <span>Detect</span>
            <ArrowUpRight />
            <span>Explain</span>
            <ArrowUpRight />
            <span>Investigate</span>
          </div>
        </div>
        <small>LOCAL DEMO · SYNTHETIC DATA · REAL INFERENCE</small>
      </section>
      <section className="login-form">
        <div className="login-form-inner">
          <span className="eyebrow">YOUR INTELLIGENCE WORKSPACE</span>
          <h2>Welcome back.</h2>
          <p>Sign in to your fraud operations console.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const { data } = await api.post("/auth/login", {
                  email,
                  password,
                });
                sessionStorage.setItem("token", data.token);
                onLogin(data.user);
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email address
              <input
                autoComplete="username"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <Notice error={error} />
            <button className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Enter workspace"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <p className="login-help">
            Use the local credentials generated in <code>.env</code>.<br />
            See the README for the interview walkthrough.
          </p>
        </div>
      </section>
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(!!sessionStorage.getItem("token"));
  const [revision, setRevision] = useState(0);
  const [connected, setConnected] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const refresh = useCallback(() => setRevision((x) => x + 1), []);
  useEffect(() => {
    if (sessionStorage.getItem("token"))
      api
        .get("/auth/me")
        .then((r) => setUser(r.data))
        .catch(() => sessionStorage.removeItem("token"))
        .finally(() => setChecking(false));
    const expired = () => {
      sessionStorage.removeItem("token");
      setUser(null);
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    setMobile(false);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    let socket: WebSocket;
    let reconnect: ReturnType<typeof setTimeout>;
    let debounce: ReturnType<typeof setTimeout>;
    let ping: ReturnType<typeof setInterval>;
    function connect() {
      socket = new WebSocket(
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`,
      );
      socket.onopen = () => {
        socket.send(JSON.stringify({ token: sessionStorage.getItem("token") }));
        ping = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send("ping");
        }, 20000);
      };
      socket.onmessage = (e) => {
        const event = JSON.parse(e.data);
        if (event.type === "connected") setConnected(true);
        else if (event.type !== "pong") {
          clearTimeout(debounce);
          debounce = setTimeout(refresh, 350);
        }
      };
      socket.onclose = () => {
        setConnected(false);
        clearInterval(ping);
        if (!stopped) reconnect = setTimeout(connect, 3000);
      };
    }
    connect();
    const fallback = setInterval(refresh, 30000);
    return () => {
      stopped = true;
      clearTimeout(reconnect);
      clearTimeout(debounce);
      clearInterval(ping);
      clearInterval(fallback);
      socket?.close();
    };
  }, [user, refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  if (checking) return <div className="loading">Opening workspace…</div>;
  if (!user)
    return (
      <Login
        onLogin={(u) => {
          setUser(u);
          navigate("/");
        }}
      />
    );
  const links = [
    ["/", "Overview", LayoutDashboard],
    ["/transactions", "Transactions", ArrowLeftRight],
    ["/alerts", "Fraud alerts", TriangleAlert],
    ["/investigations", "Investigations", ScanSearch],
    ["/analytics", "Analytics", ChartNoAxesCombined],
    ["/rules", "Detection rules", SlidersHorizontal],
    ["/demo", "Demo studio", BookOpen],
  ] as const;
  return (
    <Session.Provider value={{ user, revision, refresh }}>
      <div className="app-shell">
        <aside className={`sidebar ${mobile ? "open" : ""}`}>
          <Link to="/" className="brand">
            <span className="brand-icon">
              <ShieldCheck size={23} />
            </span>
            <span>
              fraudshield<span className="brand-ai">AI</span>
            </span>
          </Link>
          <div className="workspace-select">
            <span className="workspace-avatar">F</span>
            <div>
              Fraud operations<small>Local workspace</small>
            </div>
            <span className="workspace-dot" />
          </div>
          <div className="nav-caption">WORKSPACE</div>
          <nav>
            {links.map(([path, label, Icon]) => (
              <NavLink end={path === "/"} key={path} to={path}>
                <Icon size={19} />
                {label}
                {path === "/demo" && <span className="nav-new">LIVE</span>}
              </NavLink>
            ))}
            {user.role === "ADMIN" && (
              <>
                <div className="nav-caption">ADMINISTRATION</div>
                <NavLink to="/users">
                  <Users size={19} />
                  Team access
                </NavLink>
                <NavLink to="/audit">
                  <ScrollText size={19} />
                  Audit trail
                </NavLink>
              </>
            )}
          </nav>
          <div className="sidebar-bottom">
            <div className="demo-note">
              <ShieldCheck size={20} />
              <strong>Built for human oversight</strong>
              <p>
                Every signal is explainable.
                <br />
                Every case is reviewable.
              </p>
              <Link to="/demo">
                Explore the demo <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="profile">
              <span className="avatar">
                {user.email.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>
                  {user.role === "ADMIN"
                    ? "Workspace admin"
                    : user.role === "ANALYST"
                      ? "Fraud analyst"
                      : "Viewer"}
                </strong>
                <small>{user.email}</small>
              </div>
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={() => {
                  sessionStorage.removeItem("token");
                  setUser(null);
                }}
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-toggle"
                onClick={() => setMobile(!mobile)}
                aria-label="Toggle navigation"
              >
                {mobile ? <X /> : <Menu />}
              </button>
              Workspace<span>/</span>
              <strong>
                {links.find(([p]) =>
                  p === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(p),
                )?.[1] || "Case details"}
              </strong>
            </div>
            <div className="topbar-actions">
              <span className={`connection ${connected ? "online" : ""}`}>
                <i />
                {connected ? "Live connection" : "Reconnecting…"}
              </span>
              <span className="demo-tag">DEMO ENVIRONMENT</span>
              <Link
                to="/alerts"
                className="icon-button"
                aria-label="Open fraud alerts"
              >
                <Bell size={19} />
              </Link>
            </div>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/transactions"
                element={<Transactions mode="transactions" />}
              />
              <Route path="/transactions/:id" element={<Detail />} />
              <Route path="/alerts" element={<Transactions mode="alerts" />} />
              <Route
                path="/investigations"
                element={<Transactions mode="investigations" />}
              />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/rules" element={<Rules />} />
              <Route
                path="/demo"
                element={
                  <Demo
                    onResult={(t: Transaction) => {
                      refresh();
                      setToast(
                        `${t.decision} · Risk ${t.risk.final.toFixed(1)} · Transaction evaluated`,
                      );
                    }}
                  />
                }
              />
              <Route path="/users" element={<Admin mode="users" />} />
              <Route path="/audit" element={<Admin mode="audit" />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <h1>Page not found</h1>
                    <Link to="/">Back to overview</Link>
                  </div>
                }
              />
            </Routes>
            <footer className="footer">
              <span>
                <ShieldCheck size={14} /> FraudShield AI
              </span>
              <span>
                Synthetic demonstration data · Decisions require human oversight
              </span>
            </footer>
          </main>
        </div>
        {toast && (
          <div className="toast" role="status">
            <ShieldCheck size={20} />
            {toast}
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </Session.Provider>
  );
}
