# Persistence and consistency

`database/migrations/001_schema.sql` creates PostgreSQL tables and the pgvector extension. Startup applies each unapplied migration inside a transaction protected by an advisory lock; `schema_migrations` tracks versions. Demo seed completion is separately marked.

| Table | Responsibility |
|---|---|
| app_users | Analyst/admin/viewer accounts with bcrypt password hashes |
| users | Pseudonymous lending-customer identifiers and account age |
| transactions | Decimal amount, request metadata, status, idempotency key and payload hash |
| transaction_features | Immutable decision-time feature snapshot in JSONB |
| fraud_scores | Component scores, model version, decision, TreeSHAP, saved matches and explanation |
| fraud_rules | Allowlisted feature/operator, threshold, weight, enabled state |
| investigations | One case per transaction, current status, assigned analyst and notes |
| model_feedback | Latest human FRAUD/LEGITIMATE label and original prediction |
| fraud_cases | Analyst-confirmed cases or explicitly synthetic reference cases |
| fraud_embeddings | 256-dimensional vectors and embedding-provider identity |
| audit_logs | Actor, action, resource and time |

Transaction evaluation holds a per-customer advisory lock from history read until commit. Feature extraction excludes future activity and uses only prior ALLOW or analyst-cleared records for average amount, known device and known city. Analyst-confirmed fraud is excluded from legitimate profiles. Counts include all prior submitted attempts, including blocked attempts; `failed_attempts` means recent **blocked transaction requests**, not login failures.

The cold-start average defaults to ₹2,500. Unknown devices and cities are treated as new. No trusted profile is fabricated for a submitted customer. The simulator explicitly generates its own synthetic historical records before the current request.

Redis sorted sets keep timestamped transaction IDs and support exact sliding windows. Before reading counts the API reconciles the last day from committed PostgreSQL rows. A Redis miss, outage, or restart does not change the underlying source of truth. This intentionally favors correctness over maximum throughput in the demonstration.

Scores and investigation changes are committed atomically. WebSocket notifications and asynchronous explanations begin after commit. An explanation failure leaves the original evidence template available. Feedback revisions do not mutate the original model output or policy decision. Marking a case legitimate or escalating it withdraws that case from future confirmed-fraud retrieval. Saved historical matches remain as decision-time evidence.

All variable SQL values are bound parameters. The three analytics grouping columns are a fixed server-side allowlist, not user input. Secrets and raw IP addresses are not persisted in audit records.

Tables have basic checks, uniqueness constraints and foreign keys. Transaction history is indexed by customer/time and time. Vector retrieval is an exact cosine scan suitable for the small demo dataset; production-scale approximate indexing is future work.
