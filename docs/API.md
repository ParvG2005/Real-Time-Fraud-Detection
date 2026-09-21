# API reference

Base: `http://localhost:8080/api/v1`. OpenAPI UI: `/docs`; machine schema: `/openapi.json`.

Authenticate using `POST /auth/login` with `email` and `password`. Use the returned token as `Authorization: Bearer <token>`. Tokens expire after one hour. Roles are resolved from the database on each request, so changing a role takes effect immediately for subsequent API requests.

| Endpoint | Role | Purpose |
|---|---|---|
| POST /auth/login | Public | Login; rate limited |
| GET /auth/me | Any authenticated | Current account |
| POST /auth/register | ADMIN | Create a team account |
| GET /users; PUT /users/{id}/role | ADMIN | Manage roles |
| POST /transactions; POST /fraud/evaluate | ADMIN, ANALYST | Persist and evaluate a request |
| GET /transactions | All | Paginated history; search, decision, riskLevel, userId, dateFrom/dateTo |
| GET /transactions/{id}; GET /fraud/{id} | All | Full persisted transaction evidence |
| GET /fraud/alerts | All | Top 100 flagged records |
| GET /fraud/{id}/explanation | All | Structured explanation and source |
| GET /fraud/{id}/similar-cases | All | Top five saved matches above 0.55 cosine similarity |
| POST /fraud/{id}/investigate | ADMIN, ANALYST | Open/assign a case |
| GET /investigations; GET /investigations/{id} | All | Case queue and detail |
| POST /investigations/{id}/decision | ADMIN, ANALYST | FRAUD, LEGITIMATE or ESCALATED plus notes |
| GET /rules | All | Configurable rules |
| POST /rules; PUT /rules/{id}; DELETE /rules/{id} | ADMIN | Policy configuration |
| GET /analytics/overview | All | Actual aggregate counts and measured latency |
| GET /analytics/fraud-trends; /risk-distribution; /breakdown | All | Chart series |
| GET /analytics/model | All | Synthetic holdout metrics, human feedback counts, feature shifts |
| GET /feedback/export | ADMIN, ANALYST | JSONL of features, model version and human labels |
| GET /audit | ADMIN | Last 200 recorded actions |
| GET /system/health | All | Live dependency health for the dashboard |
| POST /demo/simulate | ADMIN, ANALYST | NORMAL, HIGH_AMOUNT, TAKEOVER, FALSE_POSITIVE |

`POST /transactions` accepts an optional `Idempotency-Key` header (max 100 characters). Replaying the same payload returns the original transaction. A different payload with the same key returns 409. Both creation and replay currently return 201.

```json
{
  "userId": "DEMO_001",
  "amount": 2500,
  "currency": "INR",
  "merchantId": "LENDWISE",
  "deviceId": "DEVICE_KNOWN",
  "location": "Bangalore",
  "transactionType": "REPAYMENT"
}
```

INR is the only supported demo currency. Amount must be positive, ≤10,000,000, with at most two decimal places. Types: PAYMENT, REPAYMENT, DISBURSEMENT, WITHDRAWAL. Unknown fields are rejected; server receive time is authoritative. `ipAddress` is optional, HMAC-hashed, and never returned. Pydantic request errors return 422 (the FastAPI convention, replacing the spec's illustrative 400). Authentication: 401; role violation: 403; unknown records: 404; conflict: 409; rate limit: 429.

Risk responses include `risk`, `decision`, `riskLevel`, `factors`, `features`, `shapValues`, `shapBaseValue`, `similarCases`, `explanation`, `riskWeights`, `modelVersion`, and `processingMs`. ML probability and anomaly percentile are stored as scores out of 100. Explanations always disclose their source.

WebSocket: connect to `ws://localhost:8080/ws`; send `{"token":"<JWT>"}` within five seconds. Credentials are not sent in the query string. Send a text heartbeat every 20 seconds. Events (`transaction`, `explanation`, `investigation`, `rules`) are notifications; fetch the authenticated REST resource for current data. Expired tokens are disconnected. The UI reconnects and performs a 30-second fallback refresh.

The private ML service accepts `X-Service-Token` and is not published to the host. `/predict`, `/embed`, `/explain`, `/metrics`; `/health` is a minimal unauthenticated health check.
