#!/usr/bin/env python3
"""
mlmini — the whole ML toolbox of this course in ~150 lines of pure Python.

No numpy, no sklearn, no network: every stage lab in `examples/ml-course/` imports
from here so the maths stays visible. If you can read this file, you can read any
library that hides it.

Contents
    lcg(seed)                  deterministic pseudo-random generator (reproducibility)
    sigmoid / softmax          the two squashing functions (lessons 07, 15)
    standardize / apply_scaling feature scaling with *training* statistics (lesson 06)
    train_linear               linear regression + MSE + gradient descent (lessons 03-06)
    train_logistic             logistic regression + cross-entropy (lesson 07)
    confusion_matrix / metrics evaluation vocabulary (lessons 07, 11, 12)
    split_dataset              train / validation / test split (lesson 12)
"""

from __future__ import annotations

import math
from typing import Callable, Iterable, Sequence


# ---------------------------------------------------------------------------
# Reproducibility: a model that cannot be reproduced cannot be trusted
# ---------------------------------------------------------------------------

def lcg(seed: int) -> Callable[[], float]:
    """Deterministic uniform(0,1) generator — same seed, same experiment."""

    def next_value() -> float:
        nonlocal seed
        seed = (1_103_515_245 * seed + 12_345) % 2_147_483_648
        return seed / 2_147_483_648

    return next_value


# ---------------------------------------------------------------------------
# Activations
# ---------------------------------------------------------------------------

def sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    exp_z = math.exp(z)
    return exp_z / (1.0 + exp_z)


def softmax(scores: Sequence[float]) -> list[float]:
    top = max(scores)
    exps = [math.exp(s - top) for s in scores]
    total = sum(exps)
    return [e / total for e in exps]


def relu(z: float) -> float:
    return max(0.0, z)


# ---------------------------------------------------------------------------
# Feature scaling (lesson 06)
# ---------------------------------------------------------------------------

def standardize(rows: Sequence[Sequence[float]]) -> tuple[list[list[float]], list[float], list[float]]:
    n_features = len(rows[0])
    means = []
    stds = []
    for j in range(n_features):
        values = [row[j] for row in rows]
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        means.append(mean)
        stds.append(variance ** 0.5 or 1.0)
    return apply_scaling(rows, means, stds), means, stds


def apply_scaling(
    rows: Iterable[Sequence[float]], means: Sequence[float], stds: Sequence[float]
) -> list[list[float]]:
    return [[(v - m) / s for v, m, s in zip(row, means, stds)] for row in rows]


# ---------------------------------------------------------------------------
# Losses
# ---------------------------------------------------------------------------

def mse(y_true: Sequence[float], y_pred: Sequence[float]) -> float:
    return sum((t - p) ** 2 for t, p in zip(y_true, y_pred)) / len(y_true)


def binary_cross_entropy(y_true: Sequence[int], probabilities: Sequence[float], eps: float = 1e-12) -> float:
    total = 0.0
    for y, p in zip(y_true, probabilities):
        p = min(max(p, eps), 1 - eps)
        total += -(y * math.log(p) + (1 - y) * math.log(1 - p))
    return total / len(y_true)


def cross_entropy(y_true: Sequence[int], distributions: Sequence[Sequence[float]], eps: float = 1e-12) -> float:
    total = 0.0
    for y, dist in zip(y_true, distributions):
        total += -math.log(max(dist[y], eps))
    return total / len(y_true)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

def linear_predict(row: Sequence[float], weights: Sequence[float], bias: float) -> float:
    return sum(w * x for w, x in zip(weights, row)) + bias


def train_linear(
    x_train: Sequence[Sequence[float]],
    y_train: Sequence[float],
    epochs: int = 800,
    lr: float = 0.05,
) -> tuple[list[float], float, list[dict]]:
    """Linear regression by batch gradient descent on MSE (lessons 03-06)."""
    n_features = len(x_train[0])
    n = len(y_train)
    weights = [0.0] * n_features
    bias = 0.0
    history: list[dict] = []

    for epoch in range(epochs):
        grad_w = [0.0] * n_features
        grad_b = 0.0
        for row, target in zip(x_train, y_train):
            err = linear_predict(row, weights, bias) - target
            for j in range(n_features):
                grad_w[j] += 2 * err * row[j] / n
            grad_b += 2 * err / n
        weights = [w - lr * g for w, g in zip(weights, grad_w)]
        bias -= lr * grad_b
        if epoch % max(1, epochs // 4) == 0 or epoch == epochs - 1:
            loss = mse(y_train, [linear_predict(r, weights, bias) for r in x_train])
            history.append({"epoch": epoch, "loss": loss})

    return weights, bias, history


def logistic_predict_proba(row: Sequence[float], weights: Sequence[float], bias: float) -> float:
    return sigmoid(linear_predict(row, weights, bias))


def train_logistic(
    x_train: Sequence[Sequence[float]],
    y_train: Sequence[int],
    epochs: int = 600,
    lr: float = 0.2,
) -> tuple[list[float], float, list[dict]]:
    """Logistic regression by batch gradient descent on cross-entropy (lesson 07).

    The gradient has the elegant form (p - y) * x — the same shape as the
    regression gradient, which is not a coincidence.
    """
    n_features = len(x_train[0])
    n = len(y_train)
    weights = [0.0] * n_features
    bias = 0.0
    history: list[dict] = []

    for epoch in range(epochs):
        grad_w = [0.0] * n_features
        grad_b = 0.0
        for row, target in zip(x_train, y_train):
            err = logistic_predict_proba(row, weights, bias) - target
            for j in range(n_features):
                grad_w[j] += err * row[j] / n
            grad_b += err / n
        weights = [w - lr * g for w, g in zip(weights, grad_w)]
        bias -= lr * grad_b
        if epoch % max(1, epochs // 4) == 0 or epoch == epochs - 1:
            loss = binary_cross_entropy(
                y_train, [logistic_predict_proba(r, weights, bias) for r in x_train]
            )
            history.append({"epoch": epoch, "loss": loss})

    return weights, bias, history


# ---------------------------------------------------------------------------
# Evaluation (lessons 07, 11, 12)
# ---------------------------------------------------------------------------

def confusion_matrix(y_true: Sequence[int], y_pred: Sequence[int]) -> dict[str, int]:
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn}


def classification_metrics(y_true: Sequence[int], y_pred: Sequence[int]) -> dict[str, float]:
    cm = confusion_matrix(y_true, y_pred)
    total = cm["tp"] + cm["fp"] + cm["tn"] + cm["fn"]
    accuracy = (cm["tp"] + cm["tn"]) / total if total else 0.0
    precision = cm["tp"] / (cm["tp"] + cm["fp"]) if (cm["tp"] + cm["fp"]) else 0.0
    recall = cm["tp"] / (cm["tp"] + cm["fn"]) if (cm["tp"] + cm["fn"]) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        **cm,
        "total": total,
    }


def threshold_decisions(probabilities: Sequence[float], threshold: float = 0.5) -> list[int]:
    return [1 if p >= threshold else 0 for p in probabilities]


def split_dataset(
    rows: Sequence, labels: Sequence, ratios: tuple[float, float, float] = (0.7, 0.15, 0.15)
) -> dict[str, list]:
    """Deterministic train/validation/test split (lesson 12).

    Shuffling uses a fixed seed so the split — and therefore every metric —
    is reproducible run to run.
    """
    indices = list(range(len(rows)))
    rng = lcg(20_260_921)
    for i in range(len(indices) - 1, 0, -1):
        j = int(rng() * (i + 1))
        indices[i], indices[j] = indices[j], indices[i]

    n = len(indices)
    n_train = int(n * ratios[0])
    n_val = int(n * ratios[1])
    splits = {
        "train": indices[:n_train],
        "validation": indices[n_train : n_train + n_val],
        "test": indices[n_train + n_val :],
    }
    return {
        name: {"X": [rows[i] for i in idx], "y": [labels[i] for i in idx]}
        for name, idx in splits.items()
    }
