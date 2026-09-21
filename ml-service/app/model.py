import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from app.features import FEATURES


class FraudModel:
    def __init__(self):
        root = Path(__file__).resolve().parents[1] / "models"
        self.booster = xgb.Booster()
        self.booster.load_model(root / "fraud_model.ubj")
        self.anomaly = joblib.load(root / "anomaly.joblib")
        self.metrics = json.loads((root / "metrics.json").read_text())

    def predict(self, features):
        frame = pd.DataFrame([[features[x] for x in FEATURES]], columns=FEATURES)
        matrix = xgb.DMatrix(frame)
        probability = float(self.booster.predict(matrix)[0])
        contributions = self.booster.predict(matrix, pred_contribs=True)[0]
        raw = -self.anomaly["model"].score_samples(frame)[0]
        # Empirical percentile, not a calibrated fraud probability.
        anomaly = float(
            np.searchsorted(self.anomaly["reference"], raw)
            / len(self.anomaly["reference"])
        )
        return dict(
            fraud_probability=probability,
            anomaly_score=anomaly,
            model_version=self.metrics["model_version"],
            shap_values=[
                dict(feature=f, value=float(v))
                for f, v in zip(FEATURES, contributions[:-1])
            ],
            shap_base_value=float(contributions[-1]),
            shap_units="log_odds",
        )
