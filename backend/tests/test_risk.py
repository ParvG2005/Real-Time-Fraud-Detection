import math
import pytest
from app.risk import aggregate, rule_signals

WEIGHTS = [0.35, 0.2, 0.25, 0.1, 0.1]


@pytest.mark.parametrize(
    "value,expected",
    [
        (0, "ALLOW"),
        (39.99, "ALLOW"),
        (40, "REVIEW"),
        (69.99, "REVIEW"),
        (70, "BLOCK"),
        (100, "BLOCK"),
    ],
)
def test_policy_boundaries(value, expected):
    assert aggregate([value] * 5, WEIGHTS)[1] == expected


def test_rule_toggle_and_cap():
    rules = [
        dict(
            name="Burst",
            feature="velocity_5min",
            operator="GT",
            threshold=5,
            risk_weight=80,
            enabled=True,
        )
    ] * 2
    assert rule_signals({"velocity_5min": 6}, rules)[0] == 100
    assert rule_signals({"velocity_5min": 5}, rules)[0] == 0
    assert rule_signals({"velocity_5min": 6}, [{**rules[0], "enabled": False}]) == (
        0,
        [],
    )


@pytest.mark.parametrize("bad", [math.nan, math.inf, -1, 101])
def test_invalid_signals_rejected(bad):
    with pytest.raises(ValueError):
        aggregate([bad] * 5, WEIGHTS)


@pytest.mark.parametrize(
    "weights",
    [[0.5] * 5, [math.nan, 0.2, 0.25, 0.1, 0.1], [-0.1, 0.5, 0.4, 0.1, 0.1], [1]],
)
def test_invalid_policy_configuration(weights):
    with pytest.raises(ValueError):
        aggregate([50] * 5, weights)
