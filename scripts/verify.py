"""Exercise the live local stack without printing credentials. Generates synthetic test activity."""

import json
import math
import os
from pathlib import Path
import secrets
import time
import urllib.request
import urllib.error
import uuid
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
ENV = dict(
    line.split("=", 1)
    for line in (ROOT / ".env").read_text().splitlines()
    if line and not line.startswith("#")
)
BASE = os.getenv("DEMO_URL", "http://localhost:8080")


def call(path, body=None, token=None, method=None, extra=None, expected=200):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if extra:
        headers.update(extra)
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers,
        method=method or ("POST" if body is not None else "GET"),
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            status = response.status
            raw = response.read().decode()
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read().decode()
    assert status == expected, f"{path}: expected {expected}, got {status}: {raw[:300]}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def main():
    checks = []
    results = {}

    def passed(name):
        checks.append(name)
        print("PASS", name)

    health = call("/health")
    assert health["status"] == "UP"
    passed("All dependencies healthy")
    call("/api/v1/transactions", expected=401)
    call(
        "/api/v1/auth/login",
        {"email": ENV["ADMIN_EMAIL"], "password": "incorrect"},
        expected=401,
    )
    auth = call(
        "/api/v1/auth/login",
        {"email": ENV["ADMIN_EMAIL"], "password": ENV["ADMIN_PASSWORD"]},
    )
    token = auth["token"]
    passed("Authentication rejects missing and invalid credentials")
    for scenario, expected in [
        ("NORMAL", "ALLOW"),
        ("HIGH_AMOUNT", "REVIEW"),
        ("TAKEOVER", "BLOCK"),
        ("FALSE_POSITIVE", "BLOCK"),
    ]:
        t = call("/api/v1/demo/simulate", {"scenario": scenario}, token)
        assert t["decision"] == expected, (scenario, t["decision"], t["risk"])
        assert (
            abs(
                t["risk"]["final"]
                - sum(
                    t["risk"][k] * w
                    for k, w in zip(
                        ["ml", "rules", "behavior", "anomaly", "historical"],
                        [0.35, 0.2, 0.25, 0.1, 0.1],
                    )
                )
            )
            < 0.011
        )
        margin = t["shapBaseValue"] + sum(x["value"] for x in t["shapValues"])
        assert abs(1 / (1 + math.exp(-margin)) * 100 - t["risk"]["ml"]) < 0.001
        results[scenario] = t
        passed(
            f"{scenario}: {expected}, score {t['risk']['final']}, {t['processingMs']} ms; weighted risk and SHAP verified"
        )
    takeover = results["TAKEOVER"]
    assert takeover["features"]["velocity_5min"] == 7
    assert takeover["similarCases"] and takeover["similarCases"][0]["similarity"] > 0.9
    assert (
        call("/api/v1/transactions/" + takeover["id"], token=token)["risk"]
        == takeover["risk"]
    )
    passed("Sliding velocity, pgvector retrieval and persistent transaction evidence")
    iid = takeover["investigation"]["id"]
    t = call(
        f"/api/v1/investigations/{iid}/decision",
        {
            "decision": "FRAUD",
            "notes": "Synthetic integration test: independent device verification failed.",
        },
        token,
    )
    assert t["investigation"]["status"] == "FRAUD" and t["decision"] == "BLOCK"
    export = call("/api/v1/feedback/export", token=token)
    if not isinstance(export, str):
        export = json.dumps(export)
    assert takeover["id"] in export
    passed("Analyst confirmation and feature/label export")
    falsepositive = results["FALSE_POSITIVE"]
    t = call(
        f"/api/v1/investigations/{falsepositive['investigation']['id']}/decision",
        {
            "decision": "LEGITIMATE",
            "notes": "Synthetic demo: verified legitimate customer travel and repayment.",
        },
        token,
    )
    assert t["investigation"]["status"] == "LEGITIMATE" and t["decision"] == "BLOCK"
    passed("False-positive feedback preserves the original policy decision")
    data = dict(
        userId="TEST_" + uuid.uuid4().hex[:12],
        amount=2500,
        deviceId="DEVICE_KNOWN",
        location="Bangalore",
    )
    key = uuid.uuid4().hex
    first = call(
        "/api/v1/transactions",
        data,
        token,
        extra={"Idempotency-Key": key},
        expected=201,
    )
    again = call(
        "/api/v1/transactions",
        data,
        token,
        extra={"Idempotency-Key": key},
        expected=201,
    )
    assert first["id"] == again["id"]
    call(
        "/api/v1/transactions",
        {**data, "amount": 2600},
        token,
        extra={"Idempotency-Key": key},
        expected=409,
    )
    call("/api/v1/transactions", {**data, "amount": -1}, token, expected=422)
    call("/api/v1/transactions", {**data, "fraudScore": 0}, token, expected=422)
    passed("Idempotency, payload mismatch and strict validation")
    parallel = {**data, "userId": "TEST_" + uuid.uuid4().hex[:12]}
    with ThreadPoolExecutor(max_workers=6) as executor:
        burst = list(
            executor.map(
                lambda i: call(
                    "/api/v1/transactions",
                    {**parallel, "amount": 2500 + i},
                    token,
                    expected=201,
                ),
                range(6),
            )
        )
    assert sorted(x["features"]["velocity_5min"] for x in burst) == list(range(6))
    passed("Concurrent requests serialize per customer without velocity undercount")
    email = "viewer-" + uuid.uuid4().hex[:8] + "@demo.local"
    password = secrets.token_urlsafe(18)
    call(
        "/api/v1/auth/register",
        {"email": email, "password": password, "role": "VIEWER"},
        token,
        expected=201,
    )
    viewer = call("/api/v1/auth/login", {"email": email, "password": password})["token"]
    call("/api/v1/analytics/overview", token=viewer)
    call("/api/v1/demo/simulate", {"scenario": "NORMAL"}, viewer, expected=403)
    call("/api/v1/transactions", data, viewer, expected=403)
    call(
        "/api/v1/auth/register",
        {"email": "bad@demo.local", "password": password, "role": "ADMIN"},
        viewer,
        expected=403,
    )
    call(
        f"/api/v1/investigations/{iid}/decision",
        {"decision": "FRAUD", "notes": "Unauthorized attempt"},
        viewer,
        expected=403,
    )
    passed("Viewer cannot submit, investigate, or escalate privileges")
    rule = dict(
        name="Integration amount test",
        feature="amount",
        operator="GT",
        threshold=1000,
        riskWeight=2,
        enabled=True,
        description="Temporary rule used to verify administration.",
    )
    created = call("/api/v1/rules", rule, token, expected=201)
    updated = call(
        "/api/v1/rules/" + created["id"],
        {**rule, "enabled": False},
        token,
        method="PUT",
    )
    assert not updated["enabled"]
    call("/api/v1/rules/" + created["id"], token=token, method="DELETE", expected=204)
    passed("Rule creation, update and deletion")
    for path in [
        "/api/v1/fraud/alerts",
        "/api/v1/analytics/fraud-trends",
        "/api/v1/analytics/risk-distribution",
        "/api/v1/analytics/breakdown",
        "/api/v1/analytics/model",
        "/api/v1/audit",
    ]:
        assert call(path, token=token) is not None
    passed("Analytics, measured model metrics and audit endpoints")
    report = dict(
        checks=checks,
        health=health,
        scenarios={
            k: dict(
                id=v["id"],
                decision=v["decision"],
                risk=v["risk"],
                processingMs=v["processingMs"],
            )
            for k, v in results.items()
        },
        verifiedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )
    (ROOT / "artifacts").mkdir(exist_ok=True)
    (ROOT / "artifacts/verification.json").write_text(json.dumps(report, indent=2))
    print(f"Completed {len(checks)} live-stack checks.")


if __name__ == "__main__":
    main()
