# Verification record

## Visible browser testing

Run with an actual browser window:

```bash
cd frontend
HEADED=1 npm run test:e2e -- --headed
```

The tests display short on-screen captions and use a slower action speed so a presenter can follow along. The browser is not mocked; it interacts with the live five-service Compose application.

The complete visible run passed all **10 browser suites**: seven workflow suites below and three analytics/motion suites described later. **15 policy tests**, **4 ML tests**, and **14 live API verification groups** also passed.

The seven workflow suites cover:

1. Normal ALLOW, high-amount REVIEW, takeover BLOCK, actual evidence, TreeSHAP, pgvector results, customer history and cross-tab WebSocket updates.
2. False-positive correction, persistence across reload, escalation and feedback download.
3. Rule creation, editing, toggling, deletion and audit-generating actions.
4. Decision filters, empty search results, invalid amount validation, custom transactions, measured analytics and audit pages.
5. Viewer-only access in the UI and a direct 403 response to a prohibited API write.
6. Invalid login, mobile navigation and viewport containment at 390 × 844.
7. Temporarily stopping this project's ML service produces visible degraded-mode REVIEW. Stopping Redis still permits PostgreSQL-based evaluation with local-demo rate limiting. Both services are restored in `finally` blocks and health is verified.

The fault-drill suite stops only this Compose project's `ml-service` and `redis` containers. Run it when no other person is concurrently demonstrating this local instance.

## Model and policy tests

Pytest verifies policy thresholds (including exact 40/70 boundaries), score validation, rule toggles and caps, invalid policy weights, actual model risk ordering, SHAP additivity, normalized deterministic local embeddings, evidence templates, private-service authentication and feature validation.

## Live API verification

`python3 scripts/verify.py` checks 14 groups covering authentication, all four scenarios, weighted-score reconstruction, SHAP consistency, genuine sliding-window counts, vector matches, persistent feedback, original-decision preservation, idempotency conflicts, unknown/invalid input fields, concurrent request serialization, role permissions, rule CRUD and analytics. Machine-readable output: `artifacts/verification.json`.

Observed default-policy scenario scores on this local build: normal 6.48, high amount 64.69, takeover 93.85, unusual legitimate 84.75. These are observed outputs, not fixed assertions in the application. Time-of-day, rule changes and historical feedback can affect future scores.

## Fixes discovered during verification

- Corrected the PostgreSQL trend-query alias so analytics returns a valid series.
- Contained an off-screen accessibility label within the horizontally scrolling ledger, eliminating mobile document overflow.
- Scoped browser selectors to distinguish navigation links and independent status announcements.
- Added a visible pipeline-health state and verified fail-safe ML behavior.
- Preserved the exact policy weights on every scored record.

## Reproducibility and side effects

Tests create synthetic customers, transactions, analyst labels and temporary viewer accounts. Rule tests remove the temporary rule they create. Test-generated activity appears in the database and dashboard; counts will therefore grow across runs. This is expected, not fabricated counter animation. Use the isolated simulator scenarios for repeatable interview results.

Build validation: `npm --prefix frontend run build`. Core Python lint: `uvx ruff check backend ml-service scripts --select F`. Browser reports, traces and failure videos are under gitignored frontend test-output folders.

## Analytics motion and visual interactions

The additional `analytics-motion.spec.ts` suite runs visibly and verifies:

- Viewport-triggered reveal state, the model-performance ring, and animated blue/red SVG waves.
- Animated metrics whose accessible values match the ML API report.
- Three-day/seven-day totals calculated from actual returned daily records.
- Volume/decision-mix chart switching and location/type/device breakdown controls.
- Hover tooltips, feedback-panel reveals, and JSON report export with matching measured values.
- Mobile chart interactions and containment at 390 px.
- OS reduced-motion preference: no ambient/ring/wave animations, all content visible, functional anchor navigation.
- Navigation back to Overview restores scroll position to the top.

Run just these tests: `cd frontend && HEADED=1 npm run test:e2e -- --headed analytics-motion.spec.ts`.

The visual direction draws on MotionSites' atmospheric lighting and layered-card examples, adapted into an original analytics workspace. No paid template or proprietary prompt was copied. Motion uses native IntersectionObserver, requestAnimationFrame, CSS transitions and Recharts; no animation service or external runtime is required.

## One-command launcher

`./start` was exercised on macOS against Docker Desktop with `FRAUDSHIELD_DOCKER_SETUP=1`, forcing configuration generation through Docker rather than host Python. All five services started successfully with existing data and credentials preserved. Dependency installation, model training and frontend compilation completed inside the images. The Windows PowerShell launcher has not been executed on a Windows host.

The final black/white, blue/red theme was checked again in a visible browser: all three analytics suites passed, including both wave animations, mobile controls and reduced-motion fallbacks. Screenshots in this repository show the final theme.

The final guided walkthrough also completed in a visible Chromium window and was saved as `docs/recorded-demo.webm` (5 minutes 23 seconds). It exercises the four scenarios, evidence/history, TreeSHAP, retrieved cases, fraud confirmation, legitimate correction, analytics, rules and audit views.
