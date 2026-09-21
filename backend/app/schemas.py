from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Literal
from decimal import Decimal
import re


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Login(Strict):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def password_bytes(cls, v):
        if len(v.encode()) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return v

    @field_validator("email")
    @classmethod
    def email_format(cls, v):
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", v):
            raise ValueError("Enter a valid email address")
        return v.lower()


class Registration(Login):
    password: str = Field(min_length=12, max_length=72)
    role: Literal["ADMIN", "ANALYST", "VIEWER"] = "VIEWER"


class TransactionInput(Strict):
    userId: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    amount: Decimal = Field(gt=0, le=10000000, max_digits=14, decimal_places=2)
    currency: Literal["INR"] = "INR"
    merchantId: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$", default="LENDWISE")
    deviceId: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    location: str = Field(min_length=1, max_length=80)
    transactionType: Literal["PAYMENT", "REPAYMENT", "DISBURSEMENT", "WITHDRAWAL"] = (
        "PAYMENT"
    )
    ipAddress: str | None = Field(default=None, max_length=45)

    @field_validator("location")
    @classmethod
    def clean_location(cls, v):
        if not re.fullmatch(r"[\w .,-]+", v):
            raise ValueError("Use a city name")
        return v.strip()


class RuleInput(Strict):
    name: str = Field(min_length=1, max_length=100)
    feature: Literal[
        "amount_ratio",
        "velocity_5min",
        "new_device",
        "location_change",
        "failed_attempts",
        "account_age",
        "amount",
        "previous_fraud_count",
        "night_transaction",
    ]
    operator: Literal["GT", "LT", "EQ"] = "GT"
    threshold: float = Field(ge=0, le=10000000)
    riskWeight: float = Field(ge=0, le=100)
    enabled: bool = True
    description: str = Field(min_length=1, max_length=300)


class DecisionInput(Strict):
    decision: Literal["FRAUD", "LEGITIMATE", "ESCALATED"]
    notes: str = Field(min_length=5, max_length=4000)

    @field_validator("notes")
    @classmethod
    def meaningful_notes(cls, v):
        if len(v.strip()) < 5:
            raise ValueError("Write at least five non-whitespace characters")
        return v.strip()


class SimulationInput(Strict):
    scenario: Literal["NORMAL", "HIGH_AMOUNT", "TAKEOVER", "FALSE_POSITIVE"] = "NORMAL"


class RoleInput(Strict):
    role: Literal["ADMIN", "ANALYST", "VIEWER"]
