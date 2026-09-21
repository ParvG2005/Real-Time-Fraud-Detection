"""Reproducible synthetic benchmark; not a claim about real lending performance."""

import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    average_precision_score,
    roc_auc_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
from app.features import FEATURES

ROOT = Path(__file__).resolve().parents[1] / "models"


def dataset(n=18000, seed=42):
    r = np.random.default_rng(seed)
    avg = r.lognormal(8.3, 0.55, n)
    ratio = r.lognormal(-0.1, 0.75, n)
    unusual = r.random(n) < 0.12
    ratio[unusual] *= r.uniform(3, 10, unusual.sum())
    velocity = r.poisson(1, n) + unusual * r.poisson(5, n)
    device = (r.random(n) < (0.07 + unusual * 0.7)).astype(int)
    location = (r.random(n) < (0.04 + unusual * 0.7)).astype(int)
    failed = r.poisson(0.15 + unusual * 2, n)
    age = r.integers(1, 1800, n)
    previous = (r.random(n) < 0.025).astype(int)
    night = (r.random(n) < 0.12).astype(int)
    hour = velocity + r.poisson(2, n)
    frame = pd.DataFrame(
        dict(
            amount=avg * ratio,
            avg_amount=avg,
            amount_ratio=ratio,
            velocity_5min=velocity,
            velocity_1hour=hour,
            velocity_24hour=hour + r.poisson(4, n),
            new_device=device,
            location_change=location,
            failed_attempts=failed,
            account_age=age,
            previous_fraud_count=previous,
            night_transaction=night,
        )
    )[FEATURES]
    # Stochastic labels with overlapping classes; no label or post-decision feature leakage.
    logit = (
        -6.5
        + np.minimum(ratio, 15) * 0.55
        + np.minimum(velocity, 12) * 0.55
        + device * 1.3
        + location * 1.1
        + failed * 0.4
        + (age < 7) * 0.7
        + previous * 0.6
        + night * 0.2
    )
    labels = (r.random(n) < 1 / (1 + np.exp(-logit))).astype(int)
    return frame, labels


def train():
    ROOT.mkdir(exist_ok=True)
    X, y = dataset()
    Xdev, Xtest, ydev, ytest = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    Xtrain, Xval, ytrain, yval = train_test_split(
        Xdev, ydev, test_size=0.25, random_state=43, stratify=ydev
    )
    candidates = []
    for depth in (3, 5):
        model = XGBClassifier(
            n_estimators=140,
            max_depth=depth,
            learning_rate=0.06,
            subsample=0.85,
            colsample_bytree=0.9,
            random_state=42,
            n_jobs=2,
            scale_pos_weight=float((ytrain == 0).sum() / (ytrain == 1).sum()) ** 0.5,
            eval_metric="logloss",
        )
        model.fit(Xtrain, ytrain)
        candidates.append(
            (average_precision_score(yval, model.predict_proba(Xval)[:, 1]), model)
        )
    model = max(candidates, key=lambda x: x[0])[1]
    probabilities = model.predict_proba(Xtest)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(ytest, predictions).ravel()
    anomaly = IsolationForest(
        n_estimators=120, contamination=0.05, random_state=42, n_jobs=2
    ).fit(Xtrain[ytrain == 0])
    reference = np.sort(-anomaly.score_samples(Xtrain[ytrain == 0]))
    version = "synthetic-xgb-v1"
    metrics = dict(
        model_version=version,
        dataset="synthetic digital lending; NOT real-world prevalence",
        seed=42,
        total_rows=len(X),
        train_rows=len(Xtrain),
        validation_rows=len(Xval),
        test_rows=len(Xtest),
        fraud_prevalence=float(y.mean()),
        threshold=0.5,
        precision=float(precision_score(ytest, predictions)),
        recall=float(recall_score(ytest, predictions)),
        f1=float(f1_score(ytest, predictions)),
        pr_auc=float(average_precision_score(ytest, probabilities)),
        roc_auc=float(roc_auc_score(ytest, probabilities)),
        false_positive_rate=float(fp / (fp + tn)),
        false_negative_rate=float(fn / (fn + tp)),
        confusion_matrix=dict(tn=int(tn), fp=int(fp), fn=int(fn), tp=int(tp)),
        selected_depth=model.max_depth,
        validation_pr_auc=float(max(c[0] for c in candidates)),
        feature_reference={
            name: dict(mean=float(Xtrain[name].mean()), std=float(Xtrain[name].std()))
            for name in FEATURES
        },
    )
    model.save_model(ROOT / "fraud_model.ubj")
    joblib.dump(dict(model=anomaly, reference=reference), ROOT / "anomaly.joblib")
    (ROOT / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))
    return metrics


if __name__ == "__main__":
    train()
