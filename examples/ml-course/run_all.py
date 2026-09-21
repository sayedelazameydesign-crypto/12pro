#!/usr/bin/env python3
"""
run_all — execute the whole Machine Learning course loop in one command.

Lesson ref: ml-14-the-full-ml-loop (Problem → Data → Model → Loss → Optimization
→ Evaluation → Iteration). Each stage is a separate, dependency-free Python lab
that prints a machine-readable `RESULT {...}` line; this runner collects them all
into one evidence summary.

Usage:
    python3 examples/ml-course/run_all.py                 # run all 8 stages
    python3 examples/ml-course/run_all.py --stage 3       # run one stage
    python3 examples/ml-course/run_all.py --verbose       # show each lab's output
    python3 examples/ml-course/run_all.py --output evidence.json
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent

STAGES = [
    (1, "fundamentals", "stage1_fundamentals.py", "ml-01, ml-02"),
    (2, "regression", "stage2_regression.py", "ml-03"),
    (3, "loss_and_gradient_descent", "stage3_loss_and_gradient_descent.py", "ml-04, ml-05, ml-06"),
    (4, "classification", "stage4_classification.py", "ml-07"),
    (5, "neural_network", "stage5_neural_network.py", "ml-08, ml-09"),
    (6, "data_centric", "stage6_data_centric.py", "ml-10 … ml-14"),
    (7, "attention_and_llm", "stage7_attention_and_llm.py", "ml-15"),
    (8, "agent_loop", "stage8_agent_loop.py", "ml-16"),
]

RESULT_PREFIX = "RESULT "


def run_stage(script: str, verbose: bool) -> dict:
    path = HERE / script
    started = time.time()
    try:
        completed = subprocess.run(
            [sys.executable, str(path)],
            capture_output=True,
            text=True,
            timeout=300,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {"status": "TIMEOUT", "duration_ms": int((time.time() - started) * 1000)}

    duration_ms = int((time.time() - started) * 1000)
    stdout = completed.stdout or ""
    stderr = completed.stderr or ""

    if verbose:
        print(stdout)
        if stderr:
            print(stderr, file=sys.stderr)

    payload = None
    for line in stdout.splitlines():
        if line.startswith(RESULT_PREFIX):
            try:
                payload = json.loads(line[len(RESULT_PREFIX):])
            except json.JSONDecodeError:
                payload = None

    if completed.returncode != 0:
        return {
            "status": "FAIL",
            "exit_code": completed.returncode,
            "duration_ms": duration_ms,
            "error": (stderr or stdout).strip().splitlines()[-1:] or ["unknown error"],
        }

    if payload is None:
        return {"status": "FAIL", "exit_code": 0, "duration_ms": duration_ms, "error": "no RESULT line"}

    payload["duration_ms"] = duration_ms
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Run every ML course lab and report evidence")
    parser.add_argument("--stage", type=int, help="run a single stage number (1-8)")
    parser.add_argument("--verbose", action="store_true", help="print each lab's full output")
    parser.add_argument("--output", type=str, help="write the JSON evidence summary to this path")
    args = parser.parse_args()

    stages = [stage for stage in STAGES if args.stage is None or stage[0] == args.stage]
    if not stages:
        print(f"Unknown stage {args.stage}", file=sys.stderr)
        return 2

    print("Machine Learning from Zero — running every stage lab")
    print("=" * 78)
    print(f"{'#':>2}  {'stage':<26} {'lessons':<16} {'status':<8} {'ms':>7}")
    print("-" * 78)

    results = []
    for number, name, script, lessons in stages:
        outcome = run_stage(script, args.verbose)
        status = outcome.get("status", "FAIL")
        results.append({
            "stage": number,
            "name": name,
            "script": f"examples/ml-course/{script}",
            "lessons": lessons,
            **outcome,
        })
        print(f"{number:>2}  {name:<26} {lessons:<16} {status:<8} {outcome.get('duration_ms', 0):>7}")

    passed = sum(1 for item in results if item.get("status") == "PASS")
    total = len(results)
    summary = {
        "suite": "ml-from-zero",
        "ran_at_python": sys.version.split()[0],
        "stages_run": total,
        "stages_passed": passed,
        "status": "PASS" if passed == total else "FAIL",
        "results": results,
    }

    print("-" * 78)
    print(f"{passed}/{total} stages PASS")

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False))
        print(f"evidence written to {out_path}")

    # Single machine-readable line with the full per-stage payload, so CI and the
    # knowledge-base tests can assert on the evidence without re-running each lab.
    print("\nRESULT " + json.dumps(summary, ensure_ascii=False))
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
