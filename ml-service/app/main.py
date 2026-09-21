from contextlib import asynccontextmanager
import hmac
import os
from typing import Literal
from fastapi import FastAPI, Depends, Header, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from app.model import FraudModel
from app.ai import embed, explain


@asynccontextmanager
async def lifespan(app):
    app.state.model = FraudModel()
    yield


app = FastAPI(title="FraudShield ML", version="1.0.0", lifespan=lifespan)


def authorized(x_service_token: str = Header(default="")):
    expected = os.environ.get("ML_SERVICE_TOKEN", "")
    if not expected or not hmac.compare_digest(x_service_token, expected):
        raise HTTPException(401, "Service authentication required")


class Features(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    amount: float = Field(gt=0, le=10000000)
    avg_amount: float = Field(gt=0)
    amount_ratio: float = Field(ge=0)
    velocity_5min: int = Field(ge=0)
    velocity_1hour: int = Field(ge=0)
    velocity_24hour: int = Field(ge=0)
    new_device: int = Field(ge=0, le=1)
    location_change: int = Field(ge=0, le=1)
    failed_attempts: int = Field(ge=0)
    account_age: int = Field(ge=0)
    previous_fraud_count: int = Field(ge=0)
    night_transaction: int = Field(ge=0, le=1)


class Prediction(BaseModel):
    features: Features


class Text(BaseModel):
    text: str = Field(min_length=1, max_length=6000)


class Evidence(BaseModel):
    decision: Literal["ALLOW", "REVIEW", "BLOCK"]
    score: float = Field(ge=0, le=100)
    factors: list[str] = Field(max_length=30)
    similarCases: list[dict] = Field(max_length=5)


@app.get("/health")
def health():
    return {"status": "UP", "modelVersion": app.state.model.metrics["model_version"]}


@app.post("/predict", dependencies=[Depends(authorized)])
def predict(request: Prediction):
    return app.state.model.predict(request.features.model_dump())


@app.get("/metrics", dependencies=[Depends(authorized)])
def metrics():
    return app.state.model.metrics


@app.post("/embed", dependencies=[Depends(authorized)])
def embedding(request: Text):
    return embed(request.text)


@app.post("/explain", dependencies=[Depends(authorized)])
def explanation(request: Evidence):
    return explain(request.model_dump())
