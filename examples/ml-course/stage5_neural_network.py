#!/usr/bin/env python3
"""
Stage 5 — Neural Networks: build one yourself (forward + backpropagation).

Lesson refs: ml-08-neural-networks, ml-09-deep-learning

The classic proof that depth buys something a line cannot:
  A. XOR is not linearly separable → logistic regression stalls at ~50%.
  B. A 2→4→1 network with a non-linear activation solves it at 100%.
  C. We print what the hidden layer *represents* — the network was never told
     the rule, it learned the representation (lesson 08).

Everything is hand-written: forward pass, loss, backward pass, update.
Run:  python3 examples/ml-course/stage5_neural_network.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mlmini import (  # noqa: E402
    binary_cross_entropy,
    classification_metrics,
    lcg,
    sigmoid,
    threshold_decisions,
    train_logistic,
    logistic_predict_proba,
)

XOR_X = [[0.0, 0.0], [0.0, 1.0], [1.0, 0.0], [1.0, 1.0]]
XOR_Y = [0, 1, 1, 0]

HIDDEN_UNITS = 4
EPOCHS = 8_000
LEARNING_RATE = 2.0
SEED = 20260921


class TinyMLP:
    """2 inputs → 4 hidden sigmoid units → 1 sigmoid output.

    Backpropagation is just the chain rule applied backwards (lesson 08):
        forward:  z1 = W1·x + b1 ; h = σ(z1) ; z2 = w2·h + b2 ; o = σ(z2)
        loss:     L = BCE(o, y)
        backward: δ2 = (o - y)
                  δ1 = (δ2 · w2) * h * (1 - h)
        update:   every parameter moves against its gradient (lesson 05)
    """

    def __init__(self, n_inputs: int, n_hidden: int, seed: int = SEED):
        rng = lcg(seed)
        # Random init is required: identical hidden units would learn identically
        self.w1 = [[rng() * 2 - 1 for _ in range(n_inputs)] for _ in range(n_hidden)]
        self.b1 = [rng() * 2 - 1 for _ in range(n_hidden)]
        self.w2 = [rng() * 2 - 1 for _ in range(n_hidden)]
        self.b2 = rng() * 2 - 1

    def forward(self, x: list[float]) -> tuple[list[float], float]:
        hidden = [sigmoid(sum(w * xi for w, xi in zip(row, x)) + b) for row, b in zip(self.w1, self.b1)]
        output = sigmoid(sum(w * h for w, h in zip(self.w2, hidden)) + self.b2)
        return hidden, output

    def predict_proba(self, x: list[float]) -> float:
        return self.forward(x)[1]

    def train_step(self, x: list[float], y: int, lr: float) -> float:
        hidden, output = self.forward(x)

        # dL/do for BCE with a sigmoid output collapses to (o - y) — same shape
        # as logistic regression's gradient (lesson 07)
        delta2 = output - y

        grad_w2 = [delta2 * h for h in hidden]
        grad_b2 = delta2

        deltas1 = [delta2 * w2j * h * (1 - h) for w2j, h in zip(self.w2, hidden)]
        grad_w1 = [[d * xi for xi in x] for d in deltas1]
        grad_b1 = list(deltas1)

        for j in range(len(self.w2)):
            self.w2[j] -= lr * grad_w2[j]
            self.b1[j] -= lr * grad_b1[j]
            for i in range(len(self.w1[j])):
                self.w1[j][i] -= lr * grad_w1[j][i]
        self.b2 -= lr * grad_b2

        eps = 1e-12
        p = min(max(output, eps), 1 - eps)
        return -(y * math.log(p) + (1 - y) * math.log(1 - p))

    def train(self, x_train: list[list[float]], y_train: list[int], epochs: int, lr: float) -> list[dict]:
        history = []
        n = len(y_train)
        for epoch in range(epochs):
            total_loss = 0.0
            for x, y in zip(x_train, y_train):
                total_loss += self.train_step(x, y, lr)
            if epoch % max(1, epochs // 5) == 0 or epoch == epochs - 1:
                predictions = threshold_decisions([self.predict_proba(x) for x in x_train], 0.5)
                history.append({
                    "epoch": epoch,
                    "loss": round(total_loss / n, 6),
                    "accuracy": classification_metrics(y_train, predictions)["accuracy"],
                })
        return history


def main() -> int:
    print("Stage 5 — Neural network from scratch on XOR")
    print("=" * 68)

    # ------------------------------------------------------------------ A
    print("\n[A] Linear model first: XOR is not linearly separable")
    linear_w, linear_b, _ = train_logistic(XOR_X, XOR_Y, epochs=4_000, lr=0.5)
    linear_proba = [logistic_predict_proba(x, linear_w, linear_b) for x in XOR_X]
    linear_metrics = classification_metrics(XOR_Y, threshold_decisions(linear_proba, 0.5))
    linear_loss = binary_cross_entropy(XOR_Y, linear_proba)
    print(f"  logistic regression: loss={linear_loss:.4f} accuracy={linear_metrics['accuracy']:.2f}")
    for x, y, p in zip(XOR_X, XOR_Y, linear_proba):
        print(f"    x={x}  y={y}  p={p:.3f}")

    # ------------------------------------------------------------------ B
    print("\n[B] 2→4→1 network with backpropagation written by hand")
    net = TinyMLP(n_inputs=2, n_hidden=HIDDEN_UNITS)
    history = net.train(XOR_X, XOR_Y, epochs=EPOCHS, lr=LEARNING_RATE)
    for point in history:
        print(f"  epoch {point['epoch']:>5}  loss={point['loss']:.6f}  accuracy={point['accuracy']:.2f}")

    net_proba = [net.predict_proba(x) for x in XOR_X]
    net_metrics = classification_metrics(XOR_Y, threshold_decisions(net_proba, 0.5))
    net_loss = binary_cross_entropy(XOR_Y, net_proba)
    print(f"\n  network: loss={net_loss:.6f} accuracy={net_metrics['accuracy']:.2f}")
    for x, y, p in zip(XOR_X, XOR_Y, net_proba):
        print(f"    x={x}  y={y}  p={p:.4f}")

    # ------------------------------------------------------------------ C
    print("\n[C] What the hidden layer represents (learned, never written)")
    print("      x        " + "  ".join(f"h{j}" for j in range(HIDDEN_UNITS)) + "   output")
    for x in XOR_X:
        hidden, output = net.forward(x)
        print(f"    {str(x):<10} " + "  ".join(f"{h:.3f}" for h in hidden) + f"   {output:.3f}")
    print("\n  The four hidden units are a new internal language: the output unit")
    print("  only has to draw a straight line in *that* space. That is depth.")

    assert net_metrics["accuracy"] == 1.0, "the network must solve XOR"
    assert net_loss < linear_loss, "the network must beat the linear model on loss"
    assert linear_metrics["accuracy"] <= 0.75, "a linear model cannot solve XOR"
    assert history[-1]["loss"] <= history[0]["loss"], "loss must fall during training"

    print("\nRESULT " + json.dumps({
        "stage": 5,
        "name": "neural_network",
        "status": "PASS",
        "architecture": "2-4-1 sigmoid MLP, hand-written backprop",
        "linear_baseline": {"loss": round(linear_loss, 4), "accuracy": linear_metrics["accuracy"]},
        "network": {"loss": round(net_loss, 6), "accuracy": net_metrics["accuracy"], "epochs": EPOCHS},
        "hidden_representation": {
            str(x): [round(h, 4) for h in net.forward(x)[0]] for x in XOR_X
        },
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
