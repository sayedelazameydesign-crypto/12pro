#!/usr/bin/env python3
"""
Stage 2 — Regression: the first real model.

Lesson ref: ml-03-linear-regression

We answer the question lesson 03 raises: "where do w and b come from?".
Answer: they start as bad guesses and are improved by training.

This lab:
  1. fits y_hat = w1*area + w2*rooms + b on the house dataset with gradient
     descent (implemented by hand, no libraries),
  2. shows the parameters before/after training,
  3. reads the trained weights back in plain language (interpretable model),
  4. predicts a house that was never in the dataset.

Run:  python3 examples/ml-course/stage2_regression.py
"""

from __future__ import annotations

import json

FEATURE_NAMES = ["area_m2", "rooms"]

TRAIN_X = [
    [80, 2],
    [100, 2],
    [120, 3],
    [140, 3],
    [160, 4],
    [180, 4],
    [200, 5],
    [220, 5],
]
TRAIN_Y = [
    900_000,
    1_150_000,
    1_400_000,
    1_700_000,
    2_000_000,
    2_250_000,
    2_600_000,
    2_850_000,
]

EPOCHS = 4_000
LEARNING_RATE = 0.05


def standardize(columns: list[list[float]]) -> tuple[list[list[float]], list[float], list[float]]:
    """Feature scaling (lesson 06): zero mean, unit variance per feature.

    Returns the scaled rows plus the mean/std used, because new data must be
    scaled with the *training* statistics — never with its own.
    """
    n_features = len(columns[0])
    means = []
    stds = []
    for j in range(n_features):
        values = [row[j] for row in columns]
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std = variance ** 0.5 or 1.0
        means.append(mean)
        stds.append(std)

    scaled = [[(row[j] - means[j]) / stds[j] for j in range(n_features)] for row in columns]
    return scaled, means, stds


def apply_scaling(row: list[float], means: list[float], stds: list[float]) -> list[float]:
    return [(value - mean) / std for value, mean, std in zip(row, means, stds)]


def predict(row: list[float], weights: list[float], bias: float) -> float:
    return sum(w * x for w, x in zip(weights, row)) + bias


def mse(y_true: list[float], y_pred: list[float]) -> float:
    return sum((t - p) ** 2 for t, p in zip(y_true, y_pred)) / len(y_true)


def train(
    x_train: list[list[float]],
    y_train: list[float],
    epochs: int = EPOCHS,
    lr: float = LEARNING_RATE,
) -> tuple[list[float], float, list[float]]:
    """Batch gradient descent on MSE — the loop from lesson 05."""
    n_features = len(x_train[0])
    n = len(y_train)
    weights = [0.0] * n_features  # deliberately bad initial parameters
    bias = 0.0
    history = []

    for epoch in range(epochs):
        grad_w = [0.0] * n_features
        grad_b = 0.0
        for row, target in zip(x_train, y_train):
            err = predict(row, weights, bias) - target  # y_hat - y
            for j in range(n_features):
                grad_w[j] += 2 * err * row[j] / n
            grad_b += 2 * err / n
        weights = [w - lr * g for w, g in zip(weights, grad_w)]
        bias -= lr * grad_b

        if epoch % (epochs // 5) == 0 or epoch == epochs - 1:
            loss = mse(y_train, [predict(row, weights, bias) for row in x_train])
            history.append({"epoch": epoch, "loss": loss})

    return weights, bias, history


def main() -> int:
    print("Stage 2 — Regression: learning w and b instead of guessing them")
    print("=" * 68)

    scaled_x, means, stds = standardize(TRAIN_X)
    scaled_y_mean = sum(TRAIN_Y) / len(TRAIN_Y)
    scaled_y_std = (
        sum((v - scaled_y_mean) ** 2 for v in TRAIN_Y) / len(TRAIN_Y)
    ) ** 0.5
    scaled_y = [(v - scaled_y_mean) / scaled_y_std for v in TRAIN_Y]

    initial_loss = mse(scaled_y, [predict(row, [0.0, 0.0], 0.0) for row in scaled_x])
    print(f"Loss before training (w=[0,0], b=0): {initial_loss:,.4f}")

    weights, bias, history = train(scaled_x, scaled_y)
    final_loss = mse(scaled_y, [predict(row, weights, bias) for row in scaled_x])

    print("Loss trace:")
    for point in history:
        print(f"  epoch {point['epoch']:>5} → loss {point['loss']:.6f}")
    print(f"\nTrained parameters (scaled space): w={ [round(w, 4) for w in weights] } b={bias:.4f}")

    # Translate back into real units so the model is interpretable again
    real_weights = [w * scaled_y_std / s for w, s in zip(weights, stds)]
    real_bias = bias * scaled_y_std + scaled_y_mean - sum(
        rw * m for rw, m in zip(real_weights, means)
    )
    print("Trained parameters (real units):")
    for name, value in zip(FEATURE_NAMES, real_weights):
        print(f"  {name:<10} → {value:>10,.0f} per unit")
    print(f"  {'base':<10} → {real_bias:>10,.0f}")

    rmse_before = (initial_loss ** 0.5) * scaled_y_std
    rmse_after = (final_loss ** 0.5) * scaled_y_std
    print(f"\nRMSE before training: {rmse_before:,.0f} EGP")
    print(f"RMSE after training:  {rmse_after:,.0f} EGP")

    # Train-set fit in real units
    real_predictions = [predict(row, real_weights, real_bias) for row in TRAIN_X]
    print("\nFit on training data:")
    for row, target, prediction in zip(TRAIN_X, TRAIN_Y, real_predictions):
        print(f"  X={str(row):<10} y={target:>10,.0f}  y_hat={prediction:>10,.0f}")

    # A house the model never saw
    unseen = [150, 4]
    unseen_scaled = apply_scaling(unseen, means, stds)
    unseen_prediction_scaled = predict(unseen_scaled, weights, bias)
    unseen_prediction = unseen_prediction_scaled * scaled_y_std + scaled_y_mean
    print(f"\nUnseen house X={unseen} → y_hat = {unseen_prediction:,.0f} EGP")

    assert final_loss < initial_loss, "training must reduce the loss"
    assert final_loss < 0.01, f"expected a good fit, got loss {final_loss}"
    assert all(w > 0 for w in real_weights), "area and rooms should both raise the price"
    assert 1_700_000 < unseen_prediction < 2_100_000, "prediction should sit between the 160 m2/4-room and 180 m2/4-room houses"

    print("\nRESULT " + json.dumps({
        "stage": 2,
        "name": "regression",
        "status": "PASS",
        "loss_before": round(initial_loss, 6),
        "loss_after": round(final_loss, 6),
        "rmse_before_egp": round(rmse_before, 2),
        "rmse_after_egp": round(rmse_after, 2),
        "weights_real_units": {name: round(w, 2) for name, w in zip(FEATURE_NAMES, real_weights)},
        "bias_real_units": round(real_bias, 2),
        "unseen_prediction": round(unseen_prediction, 2),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
