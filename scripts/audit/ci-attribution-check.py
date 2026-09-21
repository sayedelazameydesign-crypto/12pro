#!/usr/bin/env python3
"""CI attribution check: are the red checks caused by this branch, or were they already red?

A failing check on a PR means nothing until it is attributed. This script compares the workflow
conclusions of the head branch against the base branch and classifies each failing check as
PRE_EXISTING (also red on base) or REGRESSION (green on base, red here).

Read-only: `gh run list` / `gh run view` only. No secrets are read or printed.

Usage:
  python3 scripts/audit/ci-attribution-check.py --base main --head arena/01a0c57e-12pro \
      --out certification/knowledge/ci-attribution-raw.json
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import time
from pathlib import Path


def gh(*args: str, timeout: int = 120):
    if shutil.which("gh") is None:
        return None
    try:
        proc = subprocess.run(["gh", *args], capture_output=True, text=True, timeout=timeout)
        if proc.returncode != 0:
            return None
        return json.loads(proc.stdout) if proc.stdout.strip() else None
    except (subprocess.TimeoutExpired, json.JSONDecodeError):
        return None


def workflow_conclusions(branch: str, limit: int = 30) -> dict[str, list[str]]:
    rows = gh("run", "list", "--branch", branch, "--limit", str(limit),
              "--json", "workflowName,conclusion,status,createdAt") or []
    grouped: dict[str, list[str]] = {}
    for row in rows:
        grouped.setdefault(row["workflowName"], []).append(row.get("conclusion") or row.get("status") or "unknown")
    return grouped


def job_conclusions(run_id: str) -> dict[str, str]:
    run = gh("run", "view", str(run_id), "--json", "jobs") or {}
    return {job["name"]: job.get("conclusion") or job.get("status") or "unknown" for job in run.get("jobs", [])}


def latest_run_id(branch: str, workflow: str) -> str | None:
    rows = gh("run", "list", "--branch", branch, "--workflow", workflow, "--limit", "1", "--json", "databaseId") or []
    return str(rows[0]["databaseId"]) if rows else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="main")
    parser.add_argument("--head", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    head = workflow_conclusions(args.head)
    base = workflow_conclusions(args.base)

    attribution = []
    for workflow, conclusions in sorted(head.items()):
        latest = conclusions[0]
        base_latest = (base.get(workflow) or ["never-run"])[0]
        if latest == "failure":
            verdict = "PRE_EXISTING" if base_latest == "failure" else (
                "REGRESSION" if base_latest == "success" else "UNATTRIBUTED (base has no run for this workflow)")
        else:
            verdict = "OK"
        attribution.append(
            {"workflow": workflow, "head": latest, "base": base_latest, "verdict": verdict,
             "headHistory": conclusions[:5], "baseHistory": (base.get(workflow) or [])[:5]}
        )

    # job-level detail for the CI workflow, where the typecheck/unit/build gates live
    ci_jobs = {}
    for branch in (args.head, args.base):
        run_id = latest_run_id(branch, "CI - Build / Lint / Typecheck / Unit")
        ci_jobs[branch] = job_conclusions(run_id) if run_id else {"_noRun": "none found"}

    regressions = [entry for entry in attribution if entry["verdict"] == "REGRESSION"]
    pre_existing = [entry for entry in attribution if entry["verdict"] == "PRE_EXISTING"]

    payload = {
        "audit": "ci-attribution",
        "base": args.base,
        "head": args.head,
        "verdict": "NO_REGRESSION" if not regressions else "REGRESSION_DETECTED",
        "regressions": regressions,
        "preExistingFailures": pre_existing,
        "workflows": attribution,
        "ciJobs": ci_jobs,
        "note": "A red check is only meaningful once attributed. Every failing workflow on the head "
                "branch is compared against the same workflow on the base branch.",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"[{payload['verdict']}] head={args.head} base={args.base}")
    for entry in attribution:
        if entry["verdict"] != "OK":
            print(f"  {entry['verdict']:<14} {entry['workflow'][:56]:<58} head={entry['head']} base={entry['base']}")
    print(f"  CI jobs head: {ci_jobs.get(args.head)}")
    print(f"  CI jobs base: {ci_jobs.get(args.base)}")
    print(f"  -> {out}")
    return 1 if regressions else 0


if __name__ == "__main__":
    raise SystemExit(main())
