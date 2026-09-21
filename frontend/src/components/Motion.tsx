import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReduced(query.matches);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  return reduced;
}

export function Reveal({
  children,
  className = "",
  delay = 0,
  id,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || !window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [reduced]);
  return (
    <div
      ref={ref}
      id={id}
      className={`scroll-reveal ${className}`}
      data-revealed={visible || reduced}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function CountUp({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const [display, setDisplay] = useState(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      previous.current = value;
      return;
    }
    let frame = 0;
    let observer: IntersectionObserver;
    const start = () => {
      const from = previous.current;
      const began = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - began) / 1000, 1);
        setDisplay(from + (value - from) * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
        else previous.current = value;
      };
      frame = requestAnimationFrame(tick);
    };
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          start();
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [value, reduced]);
  const format = (n: number) =>
    n.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  return (
    <span
      ref={ref}
      className="count-up"
      aria-label={`${format(value)}${suffix}`}
    >
      <span aria-hidden="true">
        {format(display)}
        {suffix}
      </span>
    </span>
  );
}

/** Progressive enhancement: existing dashboard panels reveal once as they enter view. */
export function ScrollStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const root = ref.current;
    if (!root || reduced || !window.IntersectionObserver) return;
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.revealed = "true";
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -18px 0px" },
    );
    const scan = () =>
      root
        .querySelectorAll<HTMLElement>(
          ".metric-card,.chart-grid>.panel,.recent-panel,.bottom-grid",
        )
        .forEach((el, i) => {
          if (seen.has(el)) return;
          seen.add(el);
          el.classList.add("scroll-reveal");
          el.style.setProperty("--reveal-delay", `${(i % 4) * 65}ms`);
          if (el.dataset.revealed !== "true") el.dataset.revealed = "false";
          observer.observe(el);
        });
    scan();
    const mutation = new MutationObserver(scan);
    mutation.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, [reduced]);
  return (
    <div ref={ref} className="scroll-stage">
      {children}
    </div>
  );
}
