import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from app.config import pool, demo_enabled
from app.security import password_hash
from app.schemas import TransactionInput
from app.service import embedding, vector, process
from app.risk import pattern_text

RULES = [
    (
        "Unusual amount",
        "amount_ratio",
        "GT",
        5,
        20,
        "Amount exceeds five times the established average.",
    ),
    (
        "Rapid transaction burst",
        "velocity_5min",
        "GT",
        5,
        20,
        "More than five previous transactions in five minutes.",
    ),
    (
        "Unrecognized device",
        "new_device",
        "EQ",
        1,
        15,
        "Device absent from legitimate transaction history.",
    ),
    (
        "Location changed",
        "location_change",
        "EQ",
        1,
        15,
        "City absent from legitimate transaction history.",
    ),
    (
        "Repeated blocked attempts",
        "failed_attempts",
        "GT",
        3,
        10,
        "More than three blocked requests in the last hour.",
    ),
    (
        "Prior confirmed fraud",
        "previous_fraud_count",
        "GT",
        0,
        10,
        "Previous fraud confirmed by an analyst.",
    ),
]


def baseline(user_id, now, days=240):
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO users(id,account_created_at) VALUES(%s,%s) ON CONFLICT DO NOTHING",
            (user_id, now - timedelta(days=days)),
        )
    # The first cold-start transaction is evaluated honestly; a regular local history follows.
    for i in range(5):
        process(
            TransactionInput(
                userId=user_id,
                amount=Decimal(2400 + i * 50),
                deviceId="DEVICE_KNOWN",
                location="Bangalore",
                transactionType="REPAYMENT",
            ),
            "demo-seed",
            demo=True,
            event_time=now - timedelta(days=6 - i),
            explain_async=False,
        )


def seed():
    with pool.connection() as conn:
        email = os.environ["ADMIN_EMAIL"].lower()
        if not conn.execute(
            "SELECT id FROM app_users WHERE email=%s", (email,)
        ).fetchone():
            conn.execute(
                "INSERT INTO app_users(id,email,password_hash,role) VALUES(%s,%s,%s,'ADMIN')",
                (uuid.uuid4(), email, password_hash(os.environ["ADMIN_PASSWORD"])),
            )
        if not conn.execute("SELECT 1 FROM fraud_rules LIMIT 1").fetchone():
            for name, feature, op, threshold, weight, description in RULES:
                conn.execute(
                    "INSERT INTO fraud_rules(id,name,feature,operator,threshold,risk_weight,description) VALUES(%s,%s,%s,%s,%s,%s,%s)",
                    (uuid.uuid4(), name, feature, op, threshold, weight, description),
                )
    if not demo_enabled:
        return
    with pool.connection() as conn:
        exists = conn.execute(
            "SELECT 1 FROM schema_migrations WHERE version='demo-seed-v1'"
        ).fetchone()
    if exists:
        return
    examples = [
        (
            "Account takeover pattern",
            dict(
                amount_ratio=12,
                new_device=1,
                location_change=1,
                velocity_5min=8,
                failed_attempts=0,
            ),
        ),
        (
            "Rapid disbursement pattern",
            dict(
                amount_ratio=10,
                new_device=1,
                location_change=1,
                velocity_5min=10,
                failed_attempts=4,
            ),
        ),
        (
            "Device change pattern",
            dict(
                amount_ratio=8,
                new_device=1,
                location_change=0,
                velocity_5min=7,
                failed_attempts=0,
            ),
        ),
        (
            "Location anomaly pattern",
            dict(
                amount_ratio=9,
                new_device=0,
                location_change=1,
                velocity_5min=6,
                failed_attempts=0,
            ),
        ),
        (
            "Repeated blocked attempts",
            dict(
                amount_ratio=15,
                new_device=1,
                location_change=1,
                velocity_5min=9,
                failed_attempts=5,
            ),
        ),
    ]
    for label, features in examples:
        e = embedding(pattern_text(features))
        cid = uuid.uuid4()
        with pool.connection() as conn:
            conn.execute(
                "INSERT INTO fraud_cases(id,fraud_type,confirmed,notes,synthetic) VALUES(%s,%s,true,%s,true)",
                (
                    cid,
                    label,
                    "Synthetic reference case for demonstration. "
                    + pattern_text(features),
                ),
            )
            conn.execute(
                "INSERT INTO fraud_embeddings(fraud_case_id,embedding,provider) VALUES(%s,%s::vector,%s)",
                (cid, vector(e["embedding"]), e["provider"]),
            )
    now = datetime.now(timezone.utc)
    for i in range(8):
        uid = f"DEMO_{i + 1:03d}"
        baseline(uid, now)
        process(
            TransactionInput(
                userId=uid,
                amount=Decimal(2500 + i * 100),
                deviceId="DEVICE_KNOWN",
                location="Bangalore",
            ),
            "demo-seed",
            demo=True,
            event_time=now - timedelta(minutes=30 + i),
            explain_async=False,
        )
    for scenario in ["HIGH_AMOUNT", "TAKEOVER", "FALSE_POSITIVE"]:
        simulate(scenario, "demo-seed")
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO schema_migrations(version) VALUES('demo-seed-v1') ON CONFLICT DO NOTHING"
        )


def simulate(scenario, actor):
    now = datetime.now(timezone.utc)
    uid = "SIM_" + uuid.uuid4().hex[:10]
    baseline(uid, now)
    if scenario == "TAKEOVER":
        # Eight real API evaluations create the burst; the final request sees seven prior requests.
        for i in range(7):
            process(
                TransactionInput(
                    userId=uid,
                    amount=Decimal(2450 + i * 10),
                    deviceId="DEVICE_KNOWN",
                    location="Bangalore",
                ),
                actor,
                demo=True,
                explain_async=False,
            )
    amount = (
        2500 if scenario == "NORMAL" else 50000 if scenario == "HIGH_AMOUNT" else 65000
    )
    suspicious = scenario in ("TAKEOVER", "FALSE_POSITIVE")
    return process(
        TransactionInput(
            userId=uid,
            amount=Decimal(amount),
            deviceId="DEVICE_NEW" if suspicious else "DEVICE_KNOWN",
            location="Mumbai" if suspicious else "Bangalore",
            transactionType="DISBURSEMENT" if suspicious else "REPAYMENT",
        ),
        actor,
        demo=True,
    )
