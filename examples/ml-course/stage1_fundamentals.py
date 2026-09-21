#!/usr/bin/env python3
"""
Stage 1 — ML Fundamentals: X, y, features, target, prediction, error.

Lesson refs: ml-01-what-is-machine-learning, ml-02-features-and-target

Pure Python, no libraries, no randomness. We do by hand exactly what a library
would hide: build a dataset, feed features X, get a prediction y_hat, compare it
with the true target y, and measure the error.

Run:  python3 examples/ml-course/stage1_fundamentals.py
"""

from __future__ import annotations

import json

# ---------------------------------------------------------------------------
# Data — the house-price table from lesson 01
# ---------------------------------------------------------------------------

FEATURE_NAMES = ["area_m2", "rooms"]

DATASET = [
    # (features, target)
    ([80, 2], 900_000),
    ([120, 3], 1_400_000),
    ([160, 4], 2_000_000),
    ([200, 5], 2_600_000),
]

# A hand-written "model": the kind of rules we would otherwise write as if/else.
# w = price per square meter and per room, b = base price. These numbers are
# guesses — lesson 03 to 06 is about *learning* them instead of guessing.
GUESSED_WEIGHTS = [10_000, 60_000]
GUESSED_BIAS = 100_000


def predict(features: list[float], weights: list[float], bias: float) -> float:
    """y_hat = w . x + b — the smallest possible model."""
    return sum(w * x for w, x in zip(weights, features)) + bias


def error(true_value: float, prediction: float) -> float:
    """error = y - y_hat (lesson 02)."""
    return true_value - prediction


def main() -> int:
    print("Stage 1 — ML Fundamentals (X, y, prediction, error)")
    print("=" * 62)

    print(f"Features (X): {FEATURE_NAMES}")
    print(f"Target   (y): price")
    print(f"Guessed parameters: w={GUESSED_WEIGHTS} b={GUESSED_BIAS}\n")

    rows = []
    squared_errors = []
    for features, target in DATASET:
        prediction = predict(features, GUESSED_WEIGHTS, GUESSED_BIAS)
        err = error(target, prediction)
        squared_errors.append(err * err)
        rows.append(
            {
                "X": features,
                "y": target,
                "y_hat": prediction,
                "error": err,
            }
        )
        print(
            f"  X={str(features):<10} y={target:>10,.0f}  "
            f"y_hat={prediction:>12,.0f}  error={err:>+11,.0f}"
        )

    mse = sum(squared_errors) / len(squared_errors)
    print(f"\nMSE over {len(rows)} examples = {mse:,.0f}")
    print(f"RMSE                          = {mse ** 0.5:,.0f}")

    # The question from lesson 01: a 140 m2 house with 3 rooms
    question_x = [140, 3]
    question_prediction = predict(question_x, GUESSED_WEIGHTS, GUESSED_BIAS)
    print(
        f"\nQuestion: house with area=140, rooms=3 → y_hat = {question_prediction:,.0f}"
    )
    print("  (the model never saw this example — this is generalization in embryo)")

    # Assertions = evidence, not marketing
    assert len(rows) == 4, "dataset must have 4 examples"
    assert question_prediction == 1_680_000, "10,000*140 + 60,000*3 + 100,000 = 1,680,000"
    assert mse > 0, "guessed parameters must produce a measurable error"

    print("\nRESULT " + json.dumps({
        "stage": 1,
        "name": "fundamentals",
        "status": "PASS",
        "examples": len(rows),
        "mse": round(mse, 2),
        "rmse": round(mse ** 0.5, 2),
        "question": {"X": question_x, "y_hat": question_prediction},
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
