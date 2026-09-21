import hashlib
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from psycopg.types.json import Jsonb
from fastapi import HTTPException
from app.config import pool, cache, ml, weights
from app.risk import rule_signals, behavior_score, aggregate, pattern_text
from app.security import audit, hashed
from app.events import hub

logger = logging.getLogger(__name__)
executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="explanations")


def vector(values):
    if len(values) != 256:
        raise ValueError("Expected 256-dimensional embedding")
    return "[" + ",".join(str(float(x)) for x in values) + "]"


def embedding(text):
    result = ml.post("/embed", json={"text": text})
    result.raise_for_status()
    return result.json()


def fetch_transaction(conn, transaction_id):
    row = conn.execute(
        """SELECT t.*,s.*,f.features FROM transactions t JOIN fraud_scores s ON s.transaction_id=t.id
        JOIN transaction_features f ON f.transaction_id=t.id WHERE t.id=%s""",
        (transaction_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Transaction not found")
    inv = conn.execute(
        "SELECT id,status,notes,assigned_to,created_at,updated_at FROM investigations WHERE transaction_id=%s",
        (transaction_id,),
    ).fetchone()
    f = row["final_score"]
    return dict(
        id=str(row["id"]),
        userId=row["user_id"],
        amount=float(row["amount"]),
        currency=row["currency"],
        merchantId=row["merchant_id"],
        deviceId=row["device_id"],
        location=row["location"],
        transactionType=row["transaction_type"],
        timestamp=row["timestamp"].isoformat(),
        createdAt=row["created_at"].isoformat(),
        status=row["status"],
        decision=row["decision"],
        demo=row["demo"],
        processingMs=row["processing_ms"],
        riskLevel="CRITICAL"
        if f >= 90
        else "HIGH"
        if f >= 70
        else "MEDIUM"
        if f >= 40
        else "LOW",
        risk=dict(
            ml=row["ml_score"],
            rules=row["rule_score"],
            behavior=row["behavior_score"],
            anomaly=row["anomaly_score"],
            historical=row["historical_score"],
            final=f,
        ),
        factors=row["factors"],
        features=row["features"],
        shapValues=row["shap_values"],
        shapBaseValue=row["shap_base_value"],
        modelVersion=row["model_version"],
        explanation=row["explanation"],
        similarCases=row["similar_cases"],
        embeddingProvider=row["embedding_provider"],
        degraded=row["degraded"],
        riskWeights=row["risk_weights"],
        investigation=inv,
    )


def features_for(conn, data, now):
    user = conn.execute("SELECT * FROM users WHERE id=%s", (data.userId,)).fetchone()
    # Only allowed or analyst-cleared activity defines a user's normal baseline.
    profile = conn.execute(
        """SELECT COALESCE(avg(t.amount),2500) avg_amount,
        COALESCE(bool_or(t.device_id=%s),false) known_device,COALESCE(bool_or(lower(t.location)=lower(%s)),false) known_location,count(*) history_count
        FROM transactions t LEFT JOIN model_feedback f ON f.transaction_id=t.id
        WHERE t.user_id=%s AND t.timestamp<%s AND (t.status='APPROVED' OR f.actual_label='LEGITIMATE')
        AND COALESCE(f.actual_label,'LEGITIMATE')<>'FRAUD' """,
        (data.deviceId, data.location, data.userId, now),
    ).fetchone()
    rows = conn.execute(
        """SELECT id,timestamp,status FROM transactions WHERE user_id=%s AND timestamp>=%s AND timestamp<=%s""",
        (data.userId, now - timedelta(hours=24), now),
    ).fetchall()
    counts = {
        str(seconds): sum(
            r["timestamp"] >= now - timedelta(seconds=seconds) for r in rows
        )
        for seconds in (300, 3600, 86400)
    }
    # Redis sorted sets preserve a sliding window. Rebuild from authoritative rows after a restart.
    try:
        key = "velocity:" + data.userId
        pipe = cache.pipeline()
        if rows:
            pipe.zadd(key, {str(r["id"]): r["timestamp"].timestamp() for r in rows})
        pipe.zremrangebyscore(key, "-inf", now.timestamp() - 86400 - 0.001)
        pipe.expire(key, 90000)
        pipe.execute()
        counts = {
            str(s): int(cache.zcount(key, now.timestamp() - s, now.timestamp()))
            for s in (300, 3600, 86400)
        }
    except Exception:
        logger.warning("Redis unavailable; using PostgreSQL velocity counts")
    prior = conn.execute(
        """SELECT count(*) n FROM model_feedback f JOIN transactions t ON t.id=f.transaction_id
        WHERE t.user_id=%s AND f.actual_label='FRAUD' """,
        (data.userId,),
    ).fetchone()["n"]
    amount = float(data.amount)
    avg = float(profile["avg_amount"])
    local_hour = (now + timedelta(hours=5, minutes=30)).hour
    return dict(
        amount=amount,
        avg_amount=avg,
        amount_ratio=round(amount / avg, 6),
        velocity_5min=counts["300"],
        velocity_1hour=counts["3600"],
        velocity_24hour=counts["86400"],
        new_device=int(not profile["known_device"]),
        location_change=int(not profile["known_location"]),
        failed_attempts=sum(
            r["status"] == "BLOCKED" and r["timestamp"] >= now - timedelta(hours=1)
            for r in rows
        ),
        account_age=max(0, (now - user["account_created_at"]).days),
        previous_fraud_count=prior,
        night_transaction=int(local_hour < 6),
    )


def process(
    data, actor, idempotency_key=None, demo=False, event_time=None, explain_async=True
):
    started = time.perf_counter()
    now = event_time or datetime.now(timezone.utc)
    request_hash = hashlib.sha256(data.model_dump_json().encode()).hexdigest()
    tid = uuid.uuid4()
    with pool.connection() as conn:
        # Serializes each user's feature read + write; prevents concurrent velocity undercount.
        if idempotency_key:
            conn.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))",
                ("idempotency:" + idempotency_key,),
            )
            existing = conn.execute(
                "SELECT id,request_hash FROM transactions WHERE idempotency_key=%s",
                (idempotency_key,),
            ).fetchone()
            if existing:
                if existing["request_hash"] != request_hash:
                    raise HTTPException(
                        409, "Idempotency key was already used for a different request"
                    )
                return fetch_transaction(conn, existing["id"])
        conn.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s,1))", (data.userId,)
        )
        conn.execute(
            "INSERT INTO users(id,account_created_at) VALUES(%s,%s) ON CONFLICT DO NOTHING",
            (data.userId, now),
        )
        features = features_for(conn, data, now)
        conn.execute(
            """INSERT INTO transactions(id,user_id,amount,currency,merchant_id,device_id,ip_hash,location,transaction_type,timestamp,status,idempotency_key,request_hash,demo)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'PROCESSING',%s,%s,%s)""",
            (
                tid,
                data.userId,
                data.amount,
                data.currency,
                data.merchantId,
                data.deviceId,
                hashed(data.ipAddress) if data.ipAddress else None,
                data.location,
                data.transactionType,
                now,
                idempotency_key,
                request_hash,
                demo,
            ),
        )
        rules = conn.execute("SELECT * FROM fraud_rules ORDER BY name").fetchall()
        rule_score, factors = rule_signals(features, rules)
        behavior = behavior_score(features)
        degraded = False
        try:
            response = ml.post("/predict", json={"features": features})
            response.raise_for_status()
            prediction = response.json()
            ml_score = prediction["fraud_probability"] * 100
            anomaly = prediction["anomaly_score"] * 100
        except Exception:
            degraded = True
            ml_score = 0
            anomaly = 0
            prediction = dict(
                model_version="unavailable", shap_values=[], shap_base_value=0
            )
            factors.append("ML service unavailable; mandatory human review")
        cases = []
        emb = None
        provider = None
        try:
            result = embedding(pattern_text(features))
            emb = vector(result["embedding"])
            provider = result["provider"]
            found = conn.execute(
                """SELECT c.id,c.fraud_type,c.notes,c.synthetic,1-(e.embedding <=> %s::vector) similarity
                FROM fraud_cases c JOIN fraud_embeddings e ON e.fraud_case_id=c.id
                WHERE c.confirmed=true AND e.provider=%s AND (c.transaction_id IS NULL OR c.transaction_id<>%s)
                ORDER BY e.embedding <=> %s::vector LIMIT 5""",
                (emb, provider, tid, emb),
            ).fetchall()
            cases = [
                dict(
                    id=str(c["id"]),
                    fraudType=c["fraud_type"],
                    notes=c["notes"],
                    synthetic=c["synthetic"],
                    similarity=round(c["similarity"], 4),
                )
                for c in found
                if c["similarity"] >= 0.55
            ]
        except Exception:
            factors.append("Historical similarity is temporarily unavailable")
        historical = (
            max([c["similarity"] * 100 for c in cases], default=0)
            if factors and (rule_score > 0 or behavior > 30)
            else 0
        )
        score, decision, level = aggregate(
            [ml_score, rule_score, behavior, anomaly, historical], weights
        )
        if degraded and decision == "ALLOW":
            score = 40
            decision = "REVIEW"
        if not factors:
            factors = [
                "No configured rule was triggered. The decision also includes model and behavioral signals."
            ]
        explanation = dict(
            source="local-evidence-template",
            summary=f"Policy decision: {decision}. Risk score: {score:.1f}/100.",
            evidence=factors,
            similar_cases=[c["fraudType"] for c in cases],
            recommended_investigation=["Review device ownership and recent activity."],
            inference="Risk signals are not proof of fraud.",
        )
        conn.execute(
            "INSERT INTO transaction_features(transaction_id,features) VALUES(%s,%s)",
            (tid, Jsonb(features)),
        )
        conn.execute(
            """INSERT INTO fraud_scores(transaction_id,ml_score,rule_score,behavior_score,anomaly_score,historical_score,final_score,decision,model_version,
            factors,shap_values,shap_base_value,explanation,similar_cases,embedding,embedding_provider,degraded,risk_weights)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::vector,%s,%s,%s)""",
            (
                tid,
                ml_score,
                rule_score,
                behavior,
                anomaly,
                historical,
                score,
                decision,
                prediction["model_version"],
                Jsonb(factors),
                Jsonb(prediction["shap_values"]),
                prediction["shap_base_value"],
                Jsonb(explanation),
                Jsonb(cases),
                emb,
                provider,
                degraded,
                Jsonb(weights),
            ),
        )
        conn.execute(
            "UPDATE transactions SET status=%s,processing_ms=%s WHERE id=%s",
            (
                {"ALLOW": "APPROVED", "REVIEW": "UNDER_REVIEW", "BLOCK": "BLOCKED"}[
                    decision
                ],
                int((time.perf_counter() - started) * 1000),
                tid,
            ),
        )
        if decision != "ALLOW":
            conn.execute(
                "INSERT INTO investigations(id,transaction_id) VALUES(%s,%s)",
                (uuid.uuid4(), tid),
            )
        audit(conn, actor, "EVALUATE_TRANSACTION", tid)
        result = fetch_transaction(conn, tid)
    # Broadcast and schedule explanations only after the database commit.
    hub.notify("transaction", tid)
    if explain_async:
        executor.submit(
            update_explanation,
            tid,
            dict(decision=decision, score=score, factors=factors, similarCases=cases),
        )
    return result


def update_explanation(tid, evidence):
    try:
        response = ml.post("/explain", json=evidence, timeout=30)
        response.raise_for_status()
        with pool.connection() as conn:
            conn.execute(
                "UPDATE fraud_scores SET explanation=%s WHERE transaction_id=%s",
                (Jsonb(response.json()), tid),
            )
        hub.notify("explanation", tid)
    except Exception:
        logger.warning("Explanation unavailable; keeping evidence template for %s", tid)


def investigate(tid, actor):
    with pool.connection() as conn:
        fetch_transaction(conn, tid)
        row = conn.execute(
            """INSERT INTO investigations(id,transaction_id,assigned_to) VALUES(%s,%s,%s)
            ON CONFLICT(transaction_id) DO UPDATE SET assigned_to=EXCLUDED.assigned_to,updated_at=now() RETURNING *""",
            (uuid.uuid4(), tid, actor),
        ).fetchone()
        audit(conn, actor, "OPEN_INVESTIGATION", tid)
    hub.notify("investigation", tid)
    return row


def resolve_investigation(iid, data, actor):
    with pool.connection() as conn:
        inv = conn.execute(
            "SELECT * FROM investigations WHERE id=%s FOR UPDATE", (iid,)
        ).fetchone()
        if not inv:
            raise HTTPException(404, "Investigation not found")
        tid = inv["transaction_id"]
        row = conn.execute(
            "SELECT * FROM fraud_scores WHERE transaction_id=%s", (tid,)
        ).fetchone()
        conn.execute(
            "UPDATE investigations SET status=%s,notes=%s,assigned_to=%s,updated_at=now() WHERE id=%s",
            (data.decision, data.notes, actor, iid),
        )
        if data.decision in ("FRAUD", "LEGITIMATE"):
            conn.execute(
                """INSERT INTO model_feedback(id,transaction_id,predicted_label,actual_label,analyst_id) VALUES(%s,%s,%s,%s,%s)
                ON CONFLICT(transaction_id) DO UPDATE SET actual_label=EXCLUDED.actual_label,analyst_id=EXCLUDED.analyst_id,created_at=now()""",
                (uuid.uuid4(), tid, row["decision"], data.decision, actor),
            )
        else:
            # Reopening a case withdraws its previous label from training and retrieval.
            conn.execute("DELETE FROM model_feedback WHERE transaction_id=%s", (tid,))
        conn.execute(
            "UPDATE fraud_cases SET confirmed=false WHERE transaction_id=%s", (tid,)
        )
        if data.decision == "FRAUD":
            case = conn.execute(
                """INSERT INTO fraud_cases(id,transaction_id,fraud_type,confirmed,analyst_id,notes,synthetic)
                VALUES(%s,%s,'Analyst-confirmed suspicious pattern',true,%s,%s,(SELECT demo FROM transactions WHERE id=%s))
                ON CONFLICT(transaction_id) DO UPDATE SET confirmed=true,analyst_id=EXCLUDED.analyst_id,notes=EXCLUDED.notes RETURNING id""",
                (uuid.uuid4(), tid, actor, data.notes, tid),
            ).fetchone()
            if row["embedding"] is not None:
                conn.execute(
                    """INSERT INTO fraud_embeddings(fraud_case_id,embedding,provider) VALUES(%s,%s::vector,%s)
                    ON CONFLICT(fraud_case_id) DO UPDATE SET embedding=EXCLUDED.embedding,provider=EXCLUDED.provider""",
                    (case["id"], str(row["embedding"]), row["embedding_provider"]),
                )
        audit(conn, actor, "INVESTIGATION_" + data.decision, tid)
        result = fetch_transaction(conn, tid)
    hub.notify("investigation", tid)
    return result
