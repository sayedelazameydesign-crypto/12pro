#!/usr/bin/env python3
"""
Stage 4 — Classification: from a number to a decision.

Lesson ref: ml-07-classification

Three experiments:
  A. Train logistic regression (sigmoid + cross-entropy + gradient descent) on a
     balanced dataset and read the confusion matrix.
  B. Move the decision threshold and watch precision trade against recall.
  C. Rare class (1% positives): a lazy classifier scores 99% accuracy and 0%
     recall — the number that hides the failure.

Run:  python3 examples/ml-course/stage4_classification.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mlmini import (  # noqa: E402
    apply_scaling,
    classification_metrics,
    lcg,
    sigmoid,
    split_dataset,
    standardize,
    threshold_decisions,
    train_logistic,
    logistic_predict_proba,
)


def make_dataset(n: int, seed: int = 7, positive_ratio: float = 0.5) -> tuple[list[list[float]], list[int]]:
    """Deterministic 2-feature dataset.

    The underlying rule is a straight line in feature space, so a linear model
    with a sigmoid is the right hypothesis — the point of the lab is the
    decision and its measurement, not the architecture.
    """
    rng = lcg(seed)
    rows: list[list[float]] = []
    labels: list[int] = []
    positives_target = int(n * positive_ratio)

    while len(rows) < n:
        x1 = rng() * 4 - 2
        x2 = rng() * 4 - 2
        score = 1.6 * x1 - 1.2 * x2 - 0.4
        natural = 1 if score > 0 else 0
        # Force the requested class balance so the imbalance experiment is exact
        positives_so_far = sum(labels)
        negatives_so_far = len(labels) - positives_so_far
        if natural == 1 and positives_so_far >= positives_target:
            continue
        if natural == 0 and negatives_so_far >= n - positives_target:
            continue
        rows.append([x1, x2])
        labels.append(natural)

    return rows, labels


def report(name: str, metrics: dict) -> None:
    print(
        f"  {name:<22} accuracy={metrics['accuracy']:.3f}  precision={metrics['precision']:.3f}  "
        f"recall={metrics['recall']:.3f}  f1={metrics['f1']:.3f}  "
        f"[tp={metrics['tp']} fp={metrics['fp']} tn={metrics['tn']} fn={metrics['fn']}]"
    )


def main() -> int:
    print("Stage 4 — Classification: sigmoid, threshold, confusion matrix")
    print("=" * 68)

    # ------------------------------------------------------------------ A
    print("\n[A] Balanced dataset: train logistic regression and read the matrix")
    rows, labels = make_dataset(400, seed=11)
    splits = split_dataset(rows, labels)

    x_train_raw, y_train = splits["train"]["X"], splits["train"]["y"]
    x_test_raw, y_test = splits["test"]["X"], splits["test"]["y"]

    scaled_train, means, stds = standardize(x_train_raw)
    scaled_test = apply_scaling(x_test_raw, means, stds)  # training statistics only

    weights, bias, history = train_logistic(scaled_train, y_train, epochs=600, lr=0.5)
    print("  cross-entropy loss trace:")
    for point in history:
        print(f"    epoch {point['epoch']:>4} → loss {point['loss']:.4f}")
    print(f"  learned weights={ [round(w, 3) for w in weights] } bias={bias:.3f}")

    test_proba = [logistic_predict_proba(row, weights, bias) for row in scaled_test]
    baseline_metrics = classification_metrics(y_test, threshold_decisions(test_proba, 0.5))
    report("logistic @0.5", baseline_metrics)

    # ------------------------------------------------------------------ B
    print("\n[B] The threshold is an engineering decision, not a constant")
    sweep = {}
    for threshold in (0.2, 0.35, 0.5, 0.65, 0.8):
        metrics = classification_metrics(y_test, threshold_decisions(test_proba, threshold))
        sweep[str(threshold)] = {k: metrics[k] for k in ("accuracy", "precision", "recall", "f1")}
        report(f"threshold={threshold}", metrics)

    lenient = classification_metrics(y_test, threshold_decisions(test_proba, 0.2))
    strict = classification_metrics(y_test, threshold_decisions(test_proba, 0.8))
    assert lenient["recall"] >= strict["recall"], "a lower threshold must not lose recall"
    assert strict["precision"] >= lenient["precision"], "a higher threshold must not lose precision"

    # ------------------------------------------------------------------ C
    print("\n[C] Rare class (1% positives): accuracy lies, recall tells the truth")
    rare_rows, rare_labels = make_dataset(1_000, seed=23, positive_ratio=0.01)
    positives = sum(rare_labels)
    print(f"  dataset: {len(rare_rows)} examples, {positives} positive ({positives / len(rare_rows):.1%})")

    lazy_predictions = [0] * len(rare_labels)  # "never fraud" — the lazy model
    lazy_metrics = classification_metrics(rare_labels, lazy_predictions)
    report("lazy: always negative", lazy_metrics)

    scaled_rare, rare_means, rare_stds = standardize(rare_rows)
    rare_weights, rare_bias, _ = train_logistic(scaled_rare, rare_labels, epochs=1_200, lr=0.5)
    rare_proba = [logistic_predict_proba(row, rare_weights, rare_bias) for row in scaled_rare]
    trained_metrics = classification_metrics(rare_labels, threshold_decisions(rare_proba, 0.5))
    report("trained @0.5", trained_metrics)
    trained_lenient = classification_metrics(rare_labels, threshold_decisions(rare_proba, 0.15))
    report("trained @0.15", trained_lenient)

    assert lazy_metrics["accuracy"] > 0.98, "the lazy model must look excellent on accuracy"
    assert lazy_metrics["recall"] == 0.0, "and catch none of the rare class"
    assert trained_metrics["recall"] > lazy_metrics["recall"], "the trained model must beat lazy on recall"

    print("\n  Reading: a 99% accuracy headline with 0% recall on the class that")
    print("  matters is the exact failure mode lesson 11 (Data-Centric AI) warns about.")

    print("\nRESULT " + json.dumps({
        "stage": 4,
        "name": "classification",
        "status": "PASS",
        "balanced_test_metrics": baseline_metrics,
        "threshold_sweep": sweep,
        "rare_class": {
            "positives": positives,
            "total": len(rare_labels),
            "lazy_accuracy": lazy_metrics["accuracy"],
            "lazy_recall": lazy_metrics["recall"],
            "trained_accuracy": trained_metrics["accuracy"],
            "trained_recall": trained_metrics["recall"],
            "trained_lenient_recall": trained_lenient["recall"],
        },
        "sigmoid_sanity": {"sigmoid(0)": sigmoid(0.0), "sigmoid(5)": round(sigmoid(5.0), 4)},
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
