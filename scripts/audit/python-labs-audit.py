#!/usr/bin/env python3
"""READ-ONLY python-lab audit (step 4): the labs must pass, and they must pass for the right reasons.

Five properties are verified, because "8/8 PASS" alone proves very little:
  P1 canonical   - run_all.py from the repo root reports 8/8 with status PASS
  P2 determinism - two runs produce byte-identical payloads once timings are removed
  P3 isolation   - passes with an empty environment (`env -i`, `-S -I`): no env vars, no site-packages
  P4 cwd         - passes when invoked from outside the repo (absolute path, cwd=/tmp)
  P5 side effects - the only filesystem change is gitignored __pycache__ bytecode

Usage:
  python3 scripts/audit/python-labs-audit.py --out certification/knowledge/python-labs-audit-raw.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LAB_DIR = REPO / "examples" / "ml-course"
RUN_ALL = LAB_DIR / "run_all.py"
TIMING_KEYS = ("duration_ms", "elapsed_ms", "ran_at", "timestamp")


def strip_timings(node):
    if isinstance(node, dict):
        return {key: strip_timings(value) for key, value in node.items() if not any(marker in key for marker in TIMING_KEYS)}
    if isinstance(node, list):
        return [strip_timings(item) for item in node]
    return node


def run(cmd: list[str], cwd: Path, env: dict | None = None, timeout: int = 240) -> dict:
    started = time.time()
    try:
        proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, env=env)
    except subprocess.TimeoutExpired:
        return {"ok": False, "code": None, "stdout": "", "stderr": "TIMEOUT", "seconds": timeout, "payload": None}
    payload = None
    for line in proc.stdout.splitlines():
        if line.startswith("RESULT "):
            try:
                payload = json.loads(line[len("RESULT ") :])
            except json.JSONDecodeError:
                payload = None
    return {
        "ok": proc.returncode == 0 and payload is not None,
        "code": proc.returncode,
        "stdout": proc.stdout.strip(),
        "stderr": proc.stderr.strip()[:800],
        "seconds": round(time.time() - started, 2),
        "payload": payload,
    }


def tree_state(root: Path) -> dict[str, str]:
    state = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            state[str(path.relative_to(root))] = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
    return state


class Audit:
    def __init__(self) -> None:
        self.payload: dict = {
            "audit": "python-labs",
            "python": sys.version.split()[0],
            "labDir": str(LAB_DIR.relative_to(REPO)),
            "checks": [],
        }

    def add(self, check_id: str, title: str, ok: bool, detail: str, metrics=None) -> None:
        self.payload["checks"].append(
            {"id": check_id, "title": title, "status": "PASS" if ok else "FAIL", "detail": detail,
             **({"metrics": metrics} if metrics is not None else {})}
        )
        print(f"[{'PASS' if ok else 'FAIL'}] {check_id} {title}\n       {detail[:400]}")

    def write(self, out: Path) -> int:
        passed = sum(1 for c in self.payload["checks"] if c["status"] == "PASS")
        total = len(self.payload["checks"])
        self.payload.update(
            {"passed": passed, "total": total, "status": "PASS" if passed == total else "FAIL",
             "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
        )
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(self.payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\n{passed}/{total} checks PASS -> {out}")
        return 0 if passed == total else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    audit = Audit()

    if not RUN_ALL.exists():
        audit.add("P0", "run_all.py present", False, f"missing {RUN_ALL}")
        return audit.write(Path(args.out))

    before = tree_state(LAB_DIR)

    # ---- P1 canonical -------------------------------------------------------
    first = run([sys.executable, str(RUN_ALL)], REPO)
    payload = first["payload"] or {}
    results = payload.get("results", [])
    stages_passed = sum(1 for stage in results if stage.get("status") == "PASS")
    audit.add(
        "P1",
        "canonical run: every stage reports PASS with measured numbers",
        first["ok"] and payload.get("status") == "PASS" and stages_passed == 8 and len(results) == 8,
        f"exit={first['code']} status={payload.get('status')} stages={stages_passed}/{len(results)} in {first['seconds']}s",
        {"exitCode": first["code"], "status": payload.get("status"), "stages": stages_passed,
         "stageNames": [stage.get("name") for stage in results], "stderr": first["stderr"]},
    )

    # ---- P2 determinism -----------------------------------------------------
    second = run([sys.executable, str(RUN_ALL)], REPO)
    a, b = strip_timings(first["payload"] or {}), strip_timings(second["payload"] or {})
    identical = json.dumps(a, sort_keys=True, ensure_ascii=False) == json.dumps(b, sort_keys=True, ensure_ascii=False)
    audit.add(
        "P2",
        "results are deterministic across runs (timings excluded)",
        identical and second["ok"],
        f"two runs compared after removing {TIMING_KEYS}; identical={identical}",
        {"identical": identical, "runSeconds": [first["seconds"], second["seconds"]]},
    )

    # ---- P3 isolation -------------------------------------------------------
    isolated = run([sys.executable, "-S", "-I", str(RUN_ALL)], REPO, env={"PATH": "/usr/bin:/bin"})
    iso_payload = isolated["payload"] or {}
    iso_passed = sum(1 for stage in iso_payload.get("results", []) if stage.get("status") == "PASS")
    audit.add(
        "P3",
        "labs pass with an empty environment (-S -I, no site-packages, no env vars)",
        isolated["ok"] and iso_payload.get("status") == "PASS" and iso_passed == 8,
        f"exit={isolated['code']} status={iso_payload.get('status')} stages={iso_passed}/8 (PATH-only env)",
        {"exitCode": isolated["code"], "stages": iso_passed, "stderr": isolated["stderr"]},
    )

    # ---- P4 cwd independence ------------------------------------------------
    elsewhere = run([sys.executable, "-B", str(RUN_ALL)], Path("/tmp"))
    other_payload = elsewhere["payload"] or {}
    other_passed = sum(1 for stage in other_payload.get("results", []) if stage.get("status") == "PASS")
    audit.add(
        "P4",
        "labs pass when invoked from outside the repository (cwd=/tmp)",
        elsewhere["ok"] and other_payload.get("status") == "PASS" and other_passed == 8,
        f"exit={elsewhere['code']} status={other_payload.get('status')} stages={other_passed}/8 from cwd=/tmp",
        {"exitCode": elsewhere["code"], "stages": other_passed, "stderr": elsewhere["stderr"]},
    )

    # ---- P5 side effects ----------------------------------------------------
    after = tree_state(LAB_DIR)
    new = sorted(set(after) - set(before))
    changed = sorted(key for key in set(before) & set(after) if before[key] != after[key])
    removed = sorted(set(before) - set(after))
    unexpected = [
        path for path in new + changed
        if not (path.startswith("__pycache__/") and path.endswith(".pyc"))
    ]
    audit.add(
        "P5",
        "labs leave no filesystem side effects beyond gitignored bytecode caches",
        not unexpected and not removed,
        f"new={new or 'none'}; changed={changed or 'none'}; removed={removed or 'none'}; "
        f"unexpected (non-__pycache__)={unexpected or 'none'}",
        {"new": new, "changed": changed, "removed": removed, "unexpected": unexpected},
    )

    # keep the canonical numbers available for the report
    audit.payload["canonicalResults"] = results
    return audit.write(Path(args.out))


if __name__ == "__main__":
    raise SystemExit(main())
