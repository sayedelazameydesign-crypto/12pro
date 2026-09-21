#!/usr/bin/env python3
"""
Stage 6 — Data-Centric AI: the model is fixed, the data changes.

Lesson refs: ml-10-where-data-comes-from, ml-11-data-centric-ai,
             ml-12-evaluation-splits, ml-13-overfitting-generalization

Three controlled experiments, same architecture and same hyperparameters each
time — only the *data* changes. That is the whole point of data-centric AI.

  A. Label noise  — flip 20% of the training labels and watch quality fall.
  B. Coverage gap — train on "day" only, then evaluate on slices: the overall
                    number looks fine while the night slice collapses.
  C. Leakage      — duplicated examples across train/test inflate the score;
                    an honest split tells the truth.

Run:  python3 examples/ml-course/stage6_data_centric.py
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
    logistic_predict_proba,
    split_dataset,
    standardize,
    threshold_decisions,
    train_logistic,
)

EPOCHS = 800
LR = 0.5


# ---------------------------------------------------------------------------
# Data generation — deterministic, with an explicit "slice" attribute
# ---------------------------------------------------------------------------

def day_samples(n: int, seed: int) -> tuple[list[list[float]], list[int], list[str]]:
    """Day rule: positive when x1 > x2."""
    rng = lcg(seed)
    rows, labels = [], []
    while len(rows) < n:
        x1 = rng() * 4 - 2
        x2 = rng() * 4 - 2
        rows.append([x1, x2])
        labels.append(1 if x1 - x2 > 0.15 else 0)
    return rows, labels, ["day"] * n


def night_samples(n: int, seed: int) -> tuple[list[list[float]], list[int], list[str]]:
    """Night rule: positive when x1 + x2 > 0 — a *different* boundary.

    A model trained only on day data cannot know this. Nothing is wrong with the
    model; the training data simply never contained this situation.
    """
    rng = lcg(seed + 991)
    rows, labels = [], []
    while len(rows) < n:
        x1 = rng() * 4 - 2
        x2 = rng() * 4 - 2
        rows.append([x1, x2])
        labels.append(1 if x1 + x2 > 0.15 else 0)
    return rows, labels, ["night"] * n


def fit_and_evaluate(
    x_train: list[list[float]],
    y_train: list[int],
    x_eval: list[list[float]],
    y_eval: list[int],
) -> dict:
    scaled_train, means, stds = standardize(x_train)
    scaled_eval = apply_scaling(x_eval, means, stds)  # training statistics only
    weights, bias, _ = train_logistic(scaled_train, y_train, epochs=EPOCHS, lr=LR)
    proba = [logistic_predict_proba(row, weights, bias) for row in scaled_eval]
    train_proba = [logistic_predict_proba(row, weights, bias) for row in scaled_train]
    return {
        "train": classification_metrics(y_train, threshold_decisions(train_proba, 0.5)),
        "eval": classification_metrics(y_eval, threshold_decisions(proba, 0.5)),
    }


def main() -> int:
    print("Stage 6 — Data-Centric AI (same model, different data)")
    print("=" * 68)

    # ------------------------------------------------------------------ A
    print("\n[A] Label noise: 20% of the training labels are wrong")
    clean_x, clean_y, _ = day_samples(600, seed=101)
    held_x, held_y, _ = day_samples(200, seed=555)

    clean = fit_and_evaluate(clean_x, clean_y, held_x, held_y)

    rng = lcg(4242)
    noisy_y = list(clean_y)
    flipped = 0
    for i in range(len(noisy_y)):
        if rng() < 0.20:
            noisy_y[i] = 1 - noisy_y[i]
            flipped += 1

    noisy = fit_and_evaluate(clean_x, noisy_y, held_x, held_y)

    print(f"  flipped labels:        {flipped}/{len(noisy_y)} ({flipped / len(noisy_y):.0%})")
    print(f"  clean  → held-out accuracy={clean['eval']['accuracy']:.3f} f1={clean['eval']['f1']:.3f}")
    print(f"  noisy  → held-out accuracy={noisy['eval']['accuracy']:.3f} f1={noisy['eval']['f1']:.3f}")
    print("  Same model, same hyperparameters, same epochs — only the labels changed.")

    # ------------------------------------------------------------------ B
    print("\n[B] Coverage gap + slice-based evaluation")
    train_x, train_y, _ = day_samples(600, seed=202)  # training only ever sees "day"
    # A realistic operating mix: 90% of traffic is the case we collected, 10%
    # is the case we forgot. The average then *looks* good — lesson 11.
    day_x, day_y, day_slice = day_samples(360, seed=777)
    night_x, night_y, night_slice = night_samples(40, seed=888)

    mixed_x = day_x + night_x
    mixed_y = day_y + night_y
    mixed_slice = day_slice + night_slice

    scaled_train, means, stds = standardize(train_x)
    weights, bias, _ = train_logistic(scaled_train, train_y, epochs=EPOCHS, lr=LR)
    scaled_mixed = apply_scaling(mixed_x, means, stds)
    mixed_proba = [logistic_predict_proba(row, weights, bias) for row in scaled_mixed]
    mixed_pred = threshold_decisions(mixed_proba, 0.5)

    overall = classification_metrics(mixed_y, mixed_pred)
    slices = {}
    for name in ("day", "night"):
        idx = [i for i, s in enumerate(mixed_slice) if s == name]
        slices[name] = classification_metrics(
            [mixed_y[i] for i in idx], [mixed_pred[i] for i in idx]
        )
        print(
            f"  slice {name:<6} n={len(idx):<4} ({len(idx) / len(mixed_slice):>4.0%} of traffic) "
            f"accuracy={slices[name]['accuracy']:.3f} "
            f"recall={slices[name]['recall']:.3f} f1={slices[name]['f1']:.3f}"
        )
    print(f"  OVERALL       n={overall['total']:<4} accuracy={overall['accuracy']:.3f} f1={overall['f1']:.3f}")
    print("  The headline number hides the slice that operationally matters (night).")

    # ------------------------------------------------------------------ C
    print("\n[C] Leakage: duplicates across train/test inflate every metric")
    leak_x = train_x + held_x          # training examples copied into the test set
    leak_y = train_y + held_y
    leaked = fit_and_evaluate(train_x, train_y, leak_x, leak_y)
    honest = fit_and_evaluate(train_x, train_y, held_x, held_y)
    print(f"  leaked  test (contains train copies): accuracy={leaked['eval']['accuracy']:.3f}")
    print(f"  honest  test (unseen examples):       accuracy={honest['eval']['accuracy']:.3f}")

    splits = split_dataset(train_x, train_y)
    print(
        f"  split sizes → train={len(splits['train']['y'])} "
        f"validation={len(splits['validation']['y'])} test={len(splits['test']['y'])}"
    )
    val_result = fit_and_evaluate(
        splits["train"]["X"], splits["train"]["y"], splits["validation"]["X"], splits["validation"]["y"]
    )
    gap = val_result["train"]["accuracy"] - val_result["eval"]["accuracy"]
    print(f"  train accuracy={val_result['train']['accuracy']:.3f} vs validation={val_result['eval']['accuracy']:.3f} → gap={gap:+.3f}")
    print("  A big gap is overfitting; a near-zero gap with low scores is underfitting (lesson 13).")

    # ------------------------------------------------------------------ evidence
    assert clean["eval"]["accuracy"] > noisy["eval"]["accuracy"], "label noise must hurt"
    assert slices["day"]["accuracy"] > slices["night"]["accuracy"] + 0.2, "night slice must be clearly worse"
    assert overall["accuracy"] > 0.85, "the headline number must still look good"
    assert slices["night"]["accuracy"] < 0.6, "while the forgotten slice is close to a coin flip"
    assert leaked["eval"]["accuracy"] > honest["eval"]["accuracy"], "leakage must inflate the score"
    assert flipped > 100, "we must actually have flipped a meaningful number of labels"

    print("\n  Diagnosis order from lesson 11: labels → coverage → duplicates →")
    print("  only then ask for a bigger model.")

    print("\nRESULT " + json.dumps({
        "stage": 6,
        "name": "data_centric",
        "status": "PASS",
        "label_noise": {
            "flipped": flipped,
            "clean_accuracy": clean["eval"]["accuracy"],
            "noisy_accuracy": noisy["eval"]["accuracy"],
        },
        "slice_evaluation": {
            "overall": {k: overall[k] for k in ("accuracy", "precision", "recall", "f1")},
            "day": {k: slices["day"][k] for k in ("accuracy", "precision", "recall", "f1")},
            "night": {k: slices["night"][k] for k in ("accuracy", "precision", "recall", "f1")},
        },
        "leakage": {
            "leaked_accuracy": leaked["eval"]["accuracy"],
            "honest_accuracy": honest["eval"]["accuracy"],
            "train_validation_gap": round(gap, 4),
        },
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
