# Specification coverage and agreed changes

`Spec.md` remains the source document. The user's later instructions select **FastAPI for the API**, **fully local interview demonstration**, and **functional verification before final design**.

| Area | Implemented evidence |
|---|---|
| Foundation | React + FastAPI + PostgreSQL; Docker Compose; strict transaction API |
| Fraud engine | Server-derived features; trained XGBoost; Isolation Forest; configurable rules; explicit weighted policy |
| Real time | Redis sliding windows; per-customer concurrency control; authenticated WebSocket events; second-tab browser test |
| Historical retrieval | Actual pgvector cosine queries; five seeded synthetic confirmed cases; newly confirmed cases enter retrieval |
| Explanation | Actual TreeSHAP; observed factors; local template clearly labeled; optional asynchronous Bedrock adapter |
| Investigation | Confirm, clear, escalate, notes, retained policy history, customer transaction history |
| Feedback | Latest analyst label, original model features/version, JSONL export; reversed labels removed from retrieval |
| Security | JWT, bcrypt, ADMIN/ANALYST/VIEWER, strict Pydantic validation, parameterized SQL, HMAC IP hashing, audit records |
| Administration | User creation and role changes; full rule CRUD and toggles |
| Analytics | Volume, policy outcomes, confirmed cases, measured latency, trend/distribution/location/type/device APIs, synthetic metrics, feedback confusion counts and feature shifts |
| Demo | Four independent scenarios; actual burst generation; custom transaction form; local startup launcher |
| Tests | Policy boundaries, ML/TreeSHAP, input validation, live-stack idempotency/concurrency/RBAC; visible browser tests |
| Submission | Source folders, Compose, README, environment template, architecture graphic, presentation materials and demo walkthrough |

## Deliberate adaptations

- FastAPI replaces Spring Boot/Java by direct user request. Pydantic 422 replaces the illustrative Bean Validation 400 response.
- Location is a validated city string in the API rather than the spec's occasional nested city object. The exact schema is documented in OpenAPI.
- Server receive time is authoritative. Clients cannot manipulate velocity by backdating transactions.
- Historical similarity is calculated before final aggregation so it can contribute to the score. The spec shows both pre-aggregation and post-decision retrieval; this implementation resolves that circular ordering explicitly.
- Five-component weights from spec section 11 are used. Illustrative arithmetic/outcome values elsewhere in the spec are not hardcoded.
- The local default uses 256-dimensional hashing vectors. Bedrock Titan is optional and provider-isolated. No cloud invocation is claimed in local mode.
- Local explanations are deterministic evidence templates. The AWS adapter is available but not verified with a live AWS account; there is no local LLM dependency.
- Feedback supports future retraining, not automatic model updates. Synthetic data was explicitly permitted by the spec.
- Presentation artifacts distinguish completed prototype capabilities from future production infrastructure. Kafka, Kubernetes, graph models and cloud deployment are future work, as the spec describes.

## Scope limits to state honestly

This is an offline-capable demonstration of the workflow, not a production lending system. There are no real customer accounts, transfers, irreversible financial actions or real-world model-performance claims. Exact vector search is appropriate at this dataset size. Human notes and labels are mutable current state with audited actions; audit records do not preserve every prior note body. Background explanations and notifications are single-process, best effort, and need durable infrastructure for production.
