import math
import os
import numpy as np
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.model import FraudModel
from app.ai import embed, explain

NORMAL = dict(
    amount=2500,
    avg_amount=2500,
    amount_ratio=1,
    velocity_5min=0,
    velocity_1hour=0,
    velocity_24hour=2,
    new_device=0,
    location_change=0,
    failed_attempts=0,
    account_age=240,
    previous_fraud_count=0,
    night_transaction=0,
)


def test_real_prediction_and_shap_additivity():
    model = FraudModel()
    normal = model.predict(NORMAL)
    suspicious = model.predict(
        {
            **NORMAL,
            "amount": 65000,
            "amount_ratio": 26,
            "velocity_5min": 7,
            "velocity_1hour": 7,
            "velocity_24hour": 7,
            "new_device": 1,
            "location_change": 1,
        }
    )
    assert suspicious["fraud_probability"] > normal["fraud_probability"]
    margin = suspicious["shap_base_value"] + sum(
        x["value"] for x in suspicious["shap_values"]
    )
    assert abs(1 / (1 + math.exp(-margin)) - suspicious["fraud_probability"]) < 1e-5
    assert 0 <= normal["anomaly_score"] <= 1


def test_local_embedding_reproducible_and_normalized():
    a = embed("new device high amount velocity burst")
    assert len(a["embedding"]) == 256
    assert np.linalg.norm(a["embedding"]) == pytest.approx(1)
    assert a == embed("new device high amount velocity burst")
    b = embed("ordinary repayment familiar location")
    assert np.dot(a["embedding"], a["embedding"]) > np.dot(
        a["embedding"], b["embedding"]
    )


def test_local_explanation_uses_actual_evidence():
    result = explain(
        dict(decision="REVIEW", score=49.5, factors=["New device"], similarCases=[])
    )
    assert result["source"] == "local-evidence-template"
    assert result["evidence"] == ["New device"]
    assert "49.5" in result["summary"]


def test_api_auth_and_validation():
    with TestClient(app) as c:
        assert c.get("/health").status_code == 200
        assert c.post("/predict", json={"features": NORMAL}).status_code == 401
        headers = {"X-Service-Token": os.environ["ML_SERVICE_TOKEN"]}
        assert (
            c.post("/predict", json={"features": NORMAL}, headers=headers).status_code
            == 200
        )
        for bad in (
            {**NORMAL, "amount": -1},
            {**NORMAL, "new_device": 2},
            {**NORMAL, "extra": 9},
        ):
            assert (
                c.post("/predict", json={"features": bad}, headers=headers).status_code
                == 422
            )
