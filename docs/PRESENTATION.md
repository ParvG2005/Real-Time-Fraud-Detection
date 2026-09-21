# Interview presentation guide

Start with `./start`, then sign in at http://localhost:3000. Leave Docker Desktop running. All visuals show the actual application and database.

## Seven-minute walkthrough

| Time | Screen / action | What to say |
|---|---|---|
| 0:00–0:35 | Overview | “FraudShield combines model inference, deterministic rules, behavior and historical cases. This is a local demo with synthetic data.” |
| 0:35–1:00 | Architecture slide | “React talks to a FastAPI API. PostgreSQL persists evidence, Redis tracks velocity, and a separate FastAPI ML service serves trained models.” |
| 1:00–1:35 | Demo studio: normal | “This known customer repays ₹2,500. Features are derived server-side. The measured score produces ALLOW.” |
| 1:35–2:00 | High amount | “A familiar device does not make an unusually large payment normal. This case goes to REVIEW.” |
| 2:00–2:40 | Takeover scenario | “The simulator submits seven actual requests, then a large payment from a new device and city. Multiple signals now support BLOCK.” |
| 2:40–3:20 | Evidence tab | “These five components and explicit weights produced the decision. Changing a rule affects future transactions, not past evidence.” |
| 3:20–4:00 | Explainability | “TreeSHAP attributes the XGBoost margin to input features. Values are log-odds, not percentage points. The local prose explanation only summarizes recorded facts.” |
| 4:00–4:35 | Similar cases | “pgvector finds confirmed pattern matches. This local build uses text-hashing vectors; these are explicitly synthetic reference cases.” |
| 4:35–5:15 | Confirm fraud | “A human makes the investigation label. The original policy output stays intact. Feedback can later be exported for retraining.” |
| 5:15–5:50 | Fourth scenario: mark legitimate | “An anomaly is not proof. Here the analyst clears a legitimate unusual payment, demonstrating the false-positive loop.” |
| 5:50–6:30 | Analytics | “Precision, recall and PR-AUC are measured on an untouched synthetic test split. Live reviewed feedback is shown separately.” |
| 6:30–7:00 | Rules / audit | “RBAC protects policy changes, input validation prevents client-supplied scores, and actions are audited. Production would need real-data validation and durable background jobs.” |

## Answers to likely interview questions

**Why FastAPI instead of Spring Boot?** The implementation was explicitly changed to FastAPI to keep the local demo in Python and simplify model integration. The service boundaries and database architecture remain the same.

**Why not ask an LLM to detect fraud?** Authorization requires reproducible, bounded-latency decisions. The model, rules and evidence determine policy. An explanation model must not control the score.

**Is this really machine learning?** Yes. XGBoost and Isolation Forest train during the image build. Native TreeSHAP contributions reconstruct the model margin. Predictions are not hardcoded outputs.

**How do you know the metrics are real?** Training writes `metrics.json` after evaluating the held-out test split. The API serves that artifact. The data is synthetic and therefore does not prove deployment performance.

**Why Redis if PostgreSQL also has transaction history?** Redis demonstrates exact sliding-window state and rate limiting. PostgreSQL is authoritative and permits reconstruction after restart. For this small demo, correctness is prioritized over aggressive caching.

**What happens with concurrent requests?** Per-customer database advisory locks serialize history read and transaction commit. Parallel tests verify velocity counts without undercounting. Idempotency prevents duplicate evaluation of retries.

**What happens if ML is unavailable?** At least REVIEW, a degraded flag, and human-readable evidence. A missing score is not silently treated as a safe transaction.

**What does “historically similar” mean locally?** Cosine similarity over normalized 256-dimensional text-hashing vectors, using pgvector. It is lexical pattern overlap. A neural embedding model is an optional future/local-cloud adaptation, not something this demo pretends to use.

**Is local prose an LLM response?** No. It is explicitly labeled as an evidence template. The optional Bedrock adapter is implemented but cloud execution is disabled for this offline presentation.

**Does analyst feedback retrain automatically?** No. Labels and features are retained and exported. A real retraining pipeline would need label-quality checks, temporal/user splits, calibration, evaluation gates, versioning and rollback.

**How would this scale?** Move notifications to Redis pub/sub or a broker, replace in-process explanation tasks with durable jobs, use a model registry, evaluate approximate vector indexes, and validate drift and fairness on representative data.

## Before entering the interview

- Run `python3 scripts/verify.py` while internet is still available for any first-time setup.
- Confirm `/health` reports all dependencies healthy.
- Run `cd frontend && HEADED=1 npm run test:e2e -- --headed` for a visible guided browser test.
- Keep the Demo studio ready in one tab and the Overview in another to show live updates.
- Avoid changing default rules immediately before the demonstration; scenario expectations depend on them.
- Keep the generated PDF/slides and recorded demo available if screen sharing fails.
- Do not describe synthetic metrics, lexical embeddings, or local templates as validated production AI.

## Presentation files

- `FraudShield-Presentation.pptx`: editable 14-slide deck.
- `FraudShield-Presentation.pdf`: portable slide export.
- `presentation.html`: browser/print version of the same slide content.
- `recorded-demo.webm`: captioned 5–8 minute recording of the actual local application; no voice narration.
- `dashboard.png`, `analytics.png`, `explainability.png`: actual app screenshots.

To regenerate assets after changes:

```bash
# Record the app first to refresh the screenshots used in the slides.
# The browser is visible; RECORD_HEADLESS=1 is optional.
(cd frontend && node scripts/present.mjs)
uv run --with pillow --with python-pptx python scripts/build-presentation.py
(cd frontend && node scripts/export-pdf.mjs)
python3 scripts/package.py
```

The analytics screen includes scroll reveals and interactive group/range controls. During a presentation, pause after scrolling so the metrics finish animating. System reduced-motion preferences are respected.
