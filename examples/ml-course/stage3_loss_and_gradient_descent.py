#!/usr/bin/env python3
"""
Stage 3 — Loss + Gradient Descent + Learning Rate.

Lesson refs: ml-04-loss-function, ml-05-gradient-descent, ml-06-learning-rate

Three experiments, all in pure Python:
  A. Loss: one example error vs MSE over the dataset, and why we square.
  B. Gradient descent trace: watch the loss fall, and check that the gradient
     really points uphill (we step *against* it).
  C. Learning rate: too large diverges, well chosen converges, too small crawls.

Run:  python3 examples/ml-course/stage3_loss_and_gradient_descent.py
"""

from __future__ import annotations

import json
import math

X = [80.0, 120.0, 160.0, 200.0]
Y = [900_000.0, 1_400_000.0, 2_000_000.0, 2_600_000.0]

# Work in scaled units so the numbers are readable and the learning rates are
# the ones practitioners actually use (lesson 06: scale first).
X_MEAN = sum(X) / len(X)
X_STD = (sum((v - X_MEAN) ** 2 for v in X) / len(X)) ** 0.5
Y_MEAN = sum(Y) / len(Y)
Y_STD = (sum((v - Y_MEAN) ** 2 for v in Y) / len(Y)) ** 0.5

XS = [(v - X_MEAN) / X_STD for v in X]
YS = [(v - Y_MEAN) / Y_STD for v in Y]


def predict(x: float, w: float, b: float) -> float:
    return w * x + b


def mse(y_true: list[float], y_pred: list[float]) -> float:
    return sum((t - p) ** 2 for t, p in zip(y_true, y_pred)) / len(y_true)


def gradients(x_train: list[float], y_train: list[float], w: float, b: float) -> tuple[float, float]:
    """dL/dw and dL/db for MSE with a linear model (lesson 05)."""
    n = len(y_train)
    grad_w = 0.0
    grad_b = 0.0
    for xi, yi in zip(x_train, y_train):
        err = predict(xi, w, b) - yi
        grad_w += 2 * err * xi / n
        grad_b += 2 * err / n
    return grad_w, grad_b


def gradient_descent(
    x_train: list[float],
    y_train: list[float],
    lr: float,
    epochs: int,
    w0: float = 0.0,
    b0: float = 0.0,
) -> dict:
    w, b = w0, b0
    trace = []
    diverged = False

    for epoch in range(epochs):
        loss = mse(y_train, [predict(xi, w, b) for xi in x_train])
        if math.isnan(loss) or math.isinf(loss):
            diverged = True
            trace.append({"epoch": epoch, "loss": None})
            break
        if abs(loss) > 1e12:
            diverged = True
            trace.append({"epoch": epoch, "loss": loss})
            break

        if epoch % max(1, epochs // 5) == 0 or epoch == epochs - 1:
            trace.append({"epoch": epoch, "loss": loss, "w": w, "b": b})

        grad_w, grad_b = gradients(x_train, y_train, w, b)
        w -= lr * grad_w
        b -= lr * grad_b

    final_loss = mse(y_train, [predict(xi, w, b) for xi in x_train])
    return {
        "lr": lr,
        "epochs": epochs,
        "w": w,
        "b": b,
        "first_loss": trace[0]["loss"] if trace and trace[0]["loss"] is not None else None,
        "final_loss": None if diverged or math.isnan(final_loss) or math.isinf(final_loss) else final_loss,
        "diverged": diverged,
        "trace": trace,
    }


def main() -> int:
    print("Stage 3 — Loss, Gradient Descent, Learning Rate")
    print("=" * 68)

    # ------------------------------------------------------------------ A
    print("\n[A] Loss: one error is not a score; MSE is")
    w_guess, b_guess = 0.5, 0.0  # deliberately imperfect parameters
    errors = []
    for xi, yi in zip(XS, YS):
        y_hat = predict(xi, w_guess, b_guess)
        errors.append((yi, y_hat, yi - y_hat))
        print(f"  x={xi:+.3f}  y={yi:+.3f}  y_hat={y_hat:+.3f}  error={yi - y_hat:+.3f}")

    naive_mean = sum(e for _, _, e in errors) / len(errors)
    loss = mse(YS, [predict(xi, w_guess, b_guess) for xi in XS])
    print(f"\n  mean of raw errors (y - y_hat) = {naive_mean:+.6f}  ← can hide big mistakes")
    print(f"  MSE                            = {loss:.6f}  ← always >= 0, punishes big errors")
    assert loss >= 0, "MSE must be non-negative"
    assert loss > abs(naive_mean), "MSE must expose what averaging hides here"

    # ------------------------------------------------------------------ B
    print("\n[B] Gradient descent: the gradient points uphill, so we step against it")
    grad_w, grad_b = gradients(XS, YS, w_guess, b_guess)
    print(f"  at w={w_guess}, b={b_guess}: dL/dw={grad_w:+.4f}  dL/db={grad_b:+.4f}")

    # Numerical check of the analytic gradient (finite differences)
    eps = 1e-6
    numeric_grad_w = (
        mse(YS, [predict(xi, w_guess + eps, b_guess) for xi in XS])
        - mse(YS, [predict(xi, w_guess - eps, b_guess) for xi in XS])
    ) / (2 * eps)
    numeric_grad_b = (
        mse(YS, [predict(xi, w_guess, b_guess + eps) for xi in XS])
        - mse(YS, [predict(xi, w_guess, b_guess - eps) for xi in XS])
    ) / (2 * eps)
    print(f"  finite-difference check:  dL/dw={numeric_grad_w:+.4f}  dL/db={numeric_grad_b:+.4f}")
    assert abs(grad_w - numeric_grad_w) < 1e-3, "analytic gradient must match numeric gradient"
    assert abs(grad_b - numeric_grad_b) < 1e-3, "analytic gradient must match numeric gradient"

    good = gradient_descent(XS, YS, lr=0.1, epochs=500, w0=w_guess, b0=b_guess)
    print("\n  trace (lr=0.1):")
    for point in good["trace"]:
        print(
            f"    epoch {point['epoch']:>4}  loss={point['loss']:.6f}  "
            f"w={point.get('w', float('nan')):+.4f}  b={point.get('b', float('nan')):+.4f}"
        )
    assert good["final_loss"] is not None, "must not diverge"
    assert good["final_loss"] < 0.005, f"should converge near the best linear fit, got {good['final_loss']}"
    assert good["final_loss"] < loss / 100, "gradient descent must cut the loss by two orders of magnitude"

    # One manual update, exactly as in lesson 05
    lr_manual = 0.1
    w_new = w_guess - lr_manual * grad_w
    b_new = b_guess - lr_manual * grad_b
    loss_after = mse(YS, [predict(xi, w_new, b_new) for xi in XS])
    print(f"\n  one manual step: w {w_guess} → {w_new:.4f}, b {b_guess} → {b_new:.4f}")
    print(f"  loss {loss:.6f} → {loss_after:.6f} (must decrease)")
    assert loss_after < loss, "a step against the gradient must reduce the loss"

    # ------------------------------------------------------------------ C
    print("\n[C] Learning rate: too big, just right, too small")
    runs = {
        "too_large": gradient_descent(XS, YS, lr=5.0, epochs=200, w0=w_guess, b0=b_guess),
        "good": gradient_descent(XS, YS, lr=0.1, epochs=200, w0=w_guess, b0=b_guess),
        "too_small": gradient_descent(XS, YS, lr=0.0005, epochs=200, w0=w_guess, b0=b_guess),
    }
    for label, run in runs.items():
        final = run["final_loss"]
        print(
            f"  {label:<10} lr={run['lr']:<8} epochs={run['epochs']:<4} "
            f"final_loss={'DIVERGED' if run['diverged'] else f'{final:.6f}'}"
        )

    assert runs["too_large"]["diverged"] or (runs["too_large"]["final_loss"] or 0) > 1.0, \
        "an oversized step must overshoot or blow up"
    assert runs["good"]["final_loss"] < runs["too_small"]["final_loss"], \
        "a well-chosen rate must beat a tiny rate in the same number of epochs"

    print("\nRESULT " + json.dumps({
        "stage": 3,
        "name": "loss_and_gradient_descent",
        "status": "PASS",
        "mse_initial": round(loss, 6),
        "gradient_matches_finite_difference": True,
        "converged_loss": round(good["final_loss"], 10),
        "learning_rate_comparison": {
            label: {
                "lr": run["lr"],
                "diverged": run["diverged"],
                "final_loss": None if run["final_loss"] is None else round(run["final_loss"], 6),
            }
            for label, run in runs.items()
        },
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
