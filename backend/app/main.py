import asyncio
import json
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
import bcrypt
from fastapi import FastAPI, Depends, HTTPException, Header, Query, Request, WebSocket
from fastapi.responses import JSONResponse, Response
from fastapi.encoders import jsonable_encoder
from psycopg import IntegrityError
from app.config import pool, cache, ml, migrate, demo_enabled, weights
from app.schemas import (
    Login,
    Registration,
    TransactionInput,
    RuleInput,
    DecisionInput,
    SimulationInput,
    RoleInput,
)
from app.security import (
    current_user,
    roles,
    token_for,
    password_hash,
    rate_limit,
    audit,
)
from app.events import hub
from app.service import (
    process,
    fetch_transaction,
    investigate,
    resolve_investigation,
    executor,
)
from app.seed import seed, simulate


@asynccontextmanager
async def lifespan(app):
    await asyncio.to_thread(migrate)
    await asyncio.to_thread(seed)
    hub.loop = asyncio.get_running_loop()
    yield
    executor.shutdown(wait=True)
    ml.close()
    pool.close()


app = FastAPI(
    title="FraudShield API",
    description="Local interview demo. Synthetic data, real inference and persistence.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(IntegrityError)
async def integrity(request, exc):
    return JSONResponse(
        status_code=409,
        content={"detail": "This operation conflicts with an existing record."},
    )


@app.middleware("http")
async def headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/health")
@app.get("/api/v1/system/health")
def health():
    with pool.connection() as conn:
        conn.execute("SELECT 1")
    try:
        redis_up = bool(cache.ping())
    except Exception:
        redis_up = False
    try:
        model_up = ml.get("/health").is_success
    except Exception:
        model_up = False
    return {
        "status": "UP" if redis_up and model_up else "DEGRADED",
        "database": True,
        "redis": redis_up,
        "ml": model_up,
        "demo": demo_enabled,
    }


@app.post("/api/v1/auth/login")
def login(data: Login, request: Request):
    rate_limit("login:" + str(request.client.host))
    with pool.connection() as conn:
        u = conn.execute(
            "SELECT * FROM app_users WHERE email=%s", (data.email.lower(),)
        ).fetchone()
        # Always perform a bcrypt comparison, including unknown accounts.
        stored = (
            u["password_hash"]
            if u
            else "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5Zjf7rqhrVXPTMOJbCw2AfNVQT9A8ie"
        )
        valid = bcrypt.checkpw(data.password.encode(), stored.encode())
        if not u or not valid:
            raise HTTPException(401, "Invalid email or password")
        audit(conn, u["id"], "LOGIN", u["id"])
    return dict(
        token=token_for(u),
        expiresAt=int(time.time()) + 3600,
        user=dict(id=u["id"], email=u["email"], role=u["role"]),
    )


@app.get("/api/v1/auth/me")
def me(user=Depends(current_user)):
    return user


@app.post("/api/v1/auth/register", status_code=201)
def register(data: Registration, user=Depends(roles("ADMIN"))):
    with pool.connection() as conn:
        row = conn.execute(
            "INSERT INTO app_users(id,email,password_hash,role) VALUES(%s,%s,%s,%s) RETURNING id,email,role",
            (uuid.uuid4(), data.email.lower(), password_hash(data.password), data.role),
        ).fetchone()
        audit(conn, user["id"], "CREATE_USER", row["id"])
    return row


@app.get("/api/v1/users")
def users(user=Depends(roles("ADMIN"))):
    with pool.connection() as conn:
        return conn.execute(
            "SELECT id,email,role,created_at FROM app_users ORDER BY created_at"
        ).fetchall()


@app.put("/api/v1/users/{uid}/role")
def change_role(uid: uuid.UUID, data: RoleInput, user=Depends(roles("ADMIN"))):
    if uid == user["id"]:
        raise HTTPException(400, "Ask another admin to change your role")
    with pool.connection() as conn:
        row = conn.execute(
            "UPDATE app_users SET role=%s WHERE id=%s RETURNING id,email,role",
            (data.role, uid),
        ).fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        audit(conn, user["id"], "CHANGE_ROLE", uid)
    return row


@app.post("/api/v1/transactions", status_code=201)
@app.post("/api/v1/fraud/evaluate", status_code=201)
def create_transaction(
    data: TransactionInput,
    user=Depends(roles("ADMIN", "ANALYST")),
    idempotency_key: str | None = Header(default=None, max_length=100),
):
    rate_limit("transactions:" + str(user["id"]), 120)
    return process(data, user["id"], idempotency_key)


@app.get("/api/v1/transactions")
def transactions(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=100),
    decision: str | None = None,
    riskLevel: str | None = None,
    userId: str | None = None,
    dateFrom: datetime | None = None,
    dateTo: datetime | None = None,
    user=Depends(current_user),
):
    clauses = ["true"]
    args = []
    if search:
        clauses.append(
            "(t.user_id ILIKE %s OR t.id::text ILIKE %s OR t.merchant_id ILIKE %s)"
        )
        args += ["%" + search + "%"] * 3
    if decision:
        if decision not in ("ALLOW", "REVIEW", "BLOCK"):
            raise HTTPException(422, "Invalid decision")
        clauses.append("s.decision=%s")
        args.append(decision)
    if riskLevel:
        bands = {
            "LOW": (0, 40),
            "MEDIUM": (40, 70),
            "HIGH": (70, 90),
            "CRITICAL": (90, 101),
        }
        if riskLevel not in bands:
            raise HTTPException(422, "Invalid risk level")
        clauses.append("s.final_score>=%s AND s.final_score<%s")
        args.extend(bands[riskLevel])
    if userId:
        clauses.append("t.user_id=%s")
        args.append(userId)
    if dateFrom:
        clauses.append("t.timestamp>=%s")
        args.append(dateFrom)
    if dateTo:
        clauses.append("t.timestamp<=%s")
        args.append(dateTo)
    where = " AND ".join(clauses)
    with pool.connection() as conn:
        total = conn.execute(
            "SELECT count(*) n FROM transactions t JOIN fraud_scores s ON s.transaction_id=t.id WHERE "
            + where,
            args,
        ).fetchone()["n"]
        ids = conn.execute(
            "SELECT t.id FROM transactions t JOIN fraud_scores s ON s.transaction_id=t.id WHERE "
            + where
            + " ORDER BY t.timestamp DESC,t.id LIMIT %s OFFSET %s",
            args + [pageSize, (page - 1) * pageSize],
        ).fetchall()
        items = [fetch_transaction(conn, r["id"]) for r in ids]
        audit(conn, user["id"], "LIST_TRANSACTIONS", "transactions")
    return dict(items=items, total=total, page=page, pageSize=pageSize)


@app.get("/api/v1/fraud/alerts")
def alert_list(user=Depends(current_user)):
    with pool.connection() as conn:
        ids = conn.execute(
            "SELECT transaction_id FROM fraud_scores WHERE decision<>'ALLOW' ORDER BY final_score DESC LIMIT 100"
        ).fetchall()
        return [fetch_transaction(conn, r["transaction_id"]) for r in ids]


@app.get("/api/v1/transactions/{tid}")
@app.get("/api/v1/fraud/{tid}")
def transaction(tid: uuid.UUID, user=Depends(current_user)):
    with pool.connection() as conn:
        result = fetch_transaction(conn, tid)
        audit(conn, user["id"], "VIEW_TRANSACTION", tid)
    return result


@app.get("/api/v1/fraud/{tid}/explanation")
def explanation(tid: uuid.UUID, user=Depends(current_user)):
    with pool.connection() as conn:
        return fetch_transaction(conn, tid)["explanation"]


@app.get("/api/v1/fraud/{tid}/similar-cases")
def similar(tid: uuid.UUID, user=Depends(current_user)):
    with pool.connection() as conn:
        return fetch_transaction(conn, tid)["similarCases"]


@app.post("/api/v1/fraud/{tid}/investigate")
def open_investigation(tid: uuid.UUID, user=Depends(roles("ADMIN", "ANALYST"))):
    return investigate(tid, user["id"])


@app.get("/api/v1/investigations")
def investigations(user=Depends(current_user)):
    with pool.connection() as conn:
        ids = conn.execute(
            "SELECT transaction_id FROM investigations ORDER BY updated_at DESC LIMIT 100"
        ).fetchall()
        return [fetch_transaction(conn, r["transaction_id"]) for r in ids]


@app.get("/api/v1/investigations/{iid}")
def investigation(iid: uuid.UUID, user=Depends(current_user)):
    with pool.connection() as conn:
        inv = conn.execute(
            "SELECT transaction_id FROM investigations WHERE id=%s", (iid,)
        ).fetchone()
        if not inv:
            raise HTTPException(404, "Investigation not found")
        return fetch_transaction(conn, inv["transaction_id"])


@app.post("/api/v1/investigations/{iid}/decision")
def decision(
    iid: uuid.UUID, data: DecisionInput, user=Depends(roles("ADMIN", "ANALYST"))
):
    return resolve_investigation(iid, data, user["id"])


@app.get("/api/v1/rules")
def rules(user=Depends(current_user)):
    with pool.connection() as conn:
        return conn.execute("SELECT * FROM fraud_rules ORDER BY name").fetchall()


@app.post("/api/v1/rules", status_code=201)
def add_rule(data: RuleInput, user=Depends(roles("ADMIN"))):
    with pool.connection() as conn:
        row = conn.execute(
            """INSERT INTO fraud_rules(id,name,feature,operator,threshold,risk_weight,enabled,description)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            (
                uuid.uuid4(),
                data.name,
                data.feature,
                data.operator,
                data.threshold,
                data.riskWeight,
                data.enabled,
                data.description,
            ),
        ).fetchone()
        audit(conn, user["id"], "CREATE_RULE", row["id"])
    hub.notify("rules")
    return row


@app.put("/api/v1/rules/{rid}")
def update_rule(rid: uuid.UUID, data: RuleInput, user=Depends(roles("ADMIN"))):
    with pool.connection() as conn:
        row = conn.execute(
            """UPDATE fraud_rules SET name=%s,feature=%s,operator=%s,threshold=%s,risk_weight=%s,enabled=%s,description=%s WHERE id=%s RETURNING *""",
            (
                data.name,
                data.feature,
                data.operator,
                data.threshold,
                data.riskWeight,
                data.enabled,
                data.description,
                rid,
            ),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Rule not found")
        audit(conn, user["id"], "UPDATE_RULE", rid)
    hub.notify("rules")
    return row


@app.delete("/api/v1/rules/{rid}", status_code=204)
def delete_rule(rid: uuid.UUID, user=Depends(roles("ADMIN"))):
    with pool.connection() as conn:
        if not conn.execute(
            "DELETE FROM fraud_rules WHERE id=%s RETURNING id", (rid,)
        ).fetchone():
            raise HTTPException(404, "Rule not found")
        audit(conn, user["id"], "DELETE_RULE", rid)
    hub.notify("rules")


@app.get("/api/v1/analytics/overview")
def overview(user=Depends(current_user)):
    with pool.connection() as conn:
        row = conn.execute("""SELECT count(*) total, count(*) FILTER(WHERE s.decision='BLOCK') blocked,
            count(*) FILTER(WHERE s.decision='REVIEW') review,count(*) FILTER(WHERE s.decision='ALLOW') allowed,
            COALESCE(avg(s.final_score),0) average_risk,COALESCE(avg(t.processing_ms),0) average_processing_ms,
            COALESCE(sum(t.amount),0) volume, COALESCE(sum(t.amount) FILTER(WHERE s.decision='BLOCK'),0) blocked_volume,
            (SELECT count(*) FROM model_feedback WHERE actual_label='FRAUD') confirmed_fraud,
            (SELECT count(*) FROM investigations WHERE status IN ('OPEN','ESCALATED')) open_investigations
            FROM transactions t JOIN fraud_scores s ON s.transaction_id=t.id""").fetchone()
    return dict(
        **row,
        flagged_rate=round(
            100 * (row["blocked"] + row["review"]) / max(row["total"], 1), 2
        ),
        weights=weights,
    )


@app.get("/api/v1/analytics/fraud-trends")
def trends(user=Depends(current_user)):
    with pool.connection() as conn:
        return conn.execute("""SELECT to_char(d.day,'Mon DD') AS day, count(t.id) transactions,
        count(t.id) FILTER(WHERE s.decision='BLOCK') blocked,count(t.id) FILTER(WHERE s.decision='REVIEW') review,
        count(t.id) FILTER(WHERE s.decision='ALLOW') allowed
        FROM generate_series(date_trunc('day',now())-interval '6 days',date_trunc('day',now()),interval '1 day') d(day)
        LEFT JOIN transactions t ON t.timestamp>=d.day AND t.timestamp<d.day+interval '1 day'
        LEFT JOIN fraud_scores s ON s.transaction_id=t.id GROUP BY d.day ORDER BY d.day""").fetchall()


@app.get("/api/v1/analytics/risk-distribution")
def distribution(user=Depends(current_user)):
    with pool.connection() as conn:
        return conn.execute("""SELECT CASE WHEN final_score<40 THEN 'Low' WHEN final_score<70 THEN 'Medium'
        WHEN final_score<90 THEN 'High' ELSE 'Critical' END name,count(*) value FROM fraud_scores GROUP BY 1""").fetchall()


@app.get("/api/v1/analytics/breakdown")
def breakdown(user=Depends(current_user)):
    with pool.connection() as conn:
        results = {}
        for dimension in ["location", "transaction_type", "device_id"]:
            results[dimension] = (
                conn.execute(f"""SELECT t.{dimension} name,count(*) total,count(*) FILTER(WHERE s.decision<>'ALLOW') flagged
                FROM transactions t JOIN fraud_scores s ON t.id=s.transaction_id GROUP BY t.{dimension} ORDER BY flagged DESC LIMIT 8""").fetchall()
            )
        results["patterns"] = conn.execute(
            "SELECT fraud_type name,count(*) value FROM fraud_cases WHERE confirmed GROUP BY fraud_type"
        ).fetchall()
        return results


@app.get("/api/v1/analytics/model")
def model_monitoring(user=Depends(current_user)):
    try:
        response = ml.get("/metrics")
        response.raise_for_status()
        metrics = response.json()
    except Exception:
        raise HTTPException(503, "Model metrics unavailable")
    with pool.connection() as conn:
        feedback = conn.execute("""SELECT count(*) reviewed,
            count(*) FILTER(WHERE predicted_label<>'ALLOW' AND actual_label='LEGITIMATE') false_positive,
            count(*) FILTER(WHERE predicted_label='ALLOW' AND actual_label='FRAUD') false_negative,
            count(*) FILTER(WHERE predicted_label<>'ALLOW' AND actual_label='FRAUD') true_positive,
            count(*) FILTER(WHERE predicted_label='ALLOW' AND actual_label='LEGITIMATE') true_negative FROM model_feedback""").fetchone()
        recent = conn.execute(
            "SELECT features FROM transaction_features f JOIN transactions t ON f.transaction_id=t.id ORDER BY t.timestamp DESC LIMIT 500"
        ).fetchall()
    shifts = []
    for name, reference in metrics["feature_reference"].items():
        if recent:
            mean = sum(r["features"][name] for r in recent) / len(recent)
            shifts.append(
                dict(
                    feature=name,
                    recentMean=mean,
                    trainingMean=reference["mean"],
                    standardizedShift=abs(mean - reference["mean"])
                    / max(reference["std"], 1e-6),
                )
            )
    return dict(
        training=metrics,
        feedback=feedback,
        featureDrift=shifts,
        driftSampleSize=len(recent),
        note="Synthetic holdout metrics and analyst-reviewed subset are separate. Feature mean shifts are screening indicators, not validated drift alarms.",
    )


@app.get("/api/v1/feedback/export")
def export_feedback(user=Depends(roles("ADMIN", "ANALYST"))):
    with pool.connection() as conn:
        rows = conn.execute("""SELECT f.transaction_id,f.predicted_label,f.actual_label,f.created_at,x.features,s.model_version
            FROM model_feedback f JOIN transaction_features x ON x.transaction_id=f.transaction_id JOIN fraud_scores s ON s.transaction_id=f.transaction_id""").fetchall()
        audit(conn, user["id"], "EXPORT_FEEDBACK", "feedback")
    return Response(
        "\n".join(json.dumps(jsonable_encoder(r)) for r in rows),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=feedback.jsonl"},
    )


@app.get("/api/v1/audit")
def audit_logs(user=Depends(roles("ADMIN"))):
    with pool.connection() as conn:
        return conn.execute(
            "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200"
        ).fetchall()


@app.post("/api/v1/demo/simulate")
def simulation(data: SimulationInput, user=Depends(roles("ADMIN", "ANALYST"))):
    if not demo_enabled:
        raise HTTPException(404, "Demo mode is disabled")
    rate_limit("demo:" + str(user["id"]), 20)
    return simulate(data.scenario, user["id"])


@app.websocket("/ws")
async def websocket(socket: WebSocket):
    await hub.connect(socket)
