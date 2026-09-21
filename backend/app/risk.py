import math


def rule_signals(features, rules):
    score = 0
    factors = []
    for rule in rules:
        if not rule["enabled"]:
            continue
        value = features[rule["feature"]]
        threshold = rule["threshold"]
        hit = {
            "GT": value > threshold,
            "LT": value < threshold,
            "EQ": value == threshold,
        }[rule["operator"]]
        if hit:
            score += rule["risk_weight"]
            factors.append(
                f"{rule['name']}: {rule['feature']} = {value:.2f} ({rule['operator']} {threshold:g})"
            )
    return min(100, score), factors


def behavior_score(f):
    return min(
        100,
        max(0, f["amount_ratio"] - 1) * 6
        + max(0, f["velocity_5min"] - 2) * 8
        + f["new_device"] * 20
        + f["location_change"] * 20
        + min(f["failed_attempts"], 5) * 4
        + f["night_transaction"] * 5,
    )


def aggregate(signals, weights):
    if (
        len(weights) != 5
        or any(not math.isfinite(x) or x < 0 for x in weights)
        or abs(sum(weights) - 1) > 1e-6
    ):
        raise ValueError("Five finite non-negative weights must sum to one")
    if len(signals) != 5 or any(
        not math.isfinite(x) or not 0 <= x <= 100 for x in signals
    ):
        raise ValueError("Signals must be finite and between 0 and 100")
    score = round(sum(x * w for x, w in zip(signals, weights)), 2)
    decision = "BLOCK" if score >= 70 else "REVIEW" if score >= 40 else "ALLOW"
    return (
        score,
        decision,
        (
            "CRITICAL"
            if score >= 90
            else "HIGH"
            if score >= 70
            else "MEDIUM"
            if score >= 40
            else "LOW"
        ),
    )


def pattern_text(f):
    parts = ["digital lending transaction"]
    if f["amount_ratio"] > 5:
        parts += ["high amount unusual amount deviation"]
    if f["new_device"]:
        parts += ["new unrecognized device device change"]
    if f["location_change"]:
        parts += ["unusual location location change"]
    if f["velocity_5min"] > 5:
        parts += ["high velocity rapid transactions burst"]
    if f["failed_attempts"] > 3:
        parts += ["repeated blocked attempts"]
    if len(parts) == 1:
        parts += ["normal amount known device usual location regular activity"]
    return " ".join(parts)
