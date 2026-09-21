#!/usr/bin/env python3
"""GitHub delivery check for the knowledge audit - records the *exact* blocking reason.

Hard rules:
  * never prints, stores, or asks for a token, password, or 2FA code
  * every captured string passes through a redactor before it touches disk or stdout
  * read-only: it runs `gh auth status`, `git ls-remote` and `git rev-parse` only

Usage:
  python3 scripts/audit/github-delivery-check.py --branch arena/01a0c57e-12pro \
      --out certification/knowledge/github-status-raw.json
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import time
from pathlib import Path

REDACT_PATTERNS = [
    (re.compile(r"\bghp_[A-Za-z0-9]{10,}\b"), "<REDACTED_GH_TOKEN>"),
    (re.compile(r"\bgho_[A-Za-z0-9]{10,}\b"), "<REDACTED_GH_TOKEN>"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{10,}\b"), "<REDACTED_GH_TOKEN>"),
    (re.compile(r"\bgh[su]_[A-Za-z0-9]{10,}\b"), "<REDACTED_GH_TOKEN>"),
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._\-]{8,}"), "Bearer <REDACTED>"),
    (re.compile(r"(?i)\btoken[:=]\s*\S+"), "token=<REDACTED>"),
    (re.compile(r"\b[A-Za-z0-9_\-]{40,}\b"), "_long_secret"),
    (re.compile(r"://[^/\s:@]+:[^/\s:@]+@"), "://<REDACTED_USER>:<REDACTED_SECRET>@"),
]


def _long_secret(match: "re.Match[str]") -> str:
    """Redact long opaque secrets, but keep git object ids (40/64 lowercase hex) - they are evidence."""
    token = match.group(0)
    if re.fullmatch(r"[0-9a-f]{40}", token) or re.fullmatch(r"[0-9a-f]{64}", token):
        return token
    return "<REDACTED_LONG_SECRET>"


CALLABLES = {"_long_secret": _long_secret}


def redact(text: str) -> str:
    for pattern, replacement in REDACT_PATTERNS:
        if callable(replacement):
            text = pattern.sub(replacement, text)
        elif replacement in CALLABLES:
            text = pattern.sub(CALLABLES[replacement], text)
        else:
            text = pattern.sub(replacement, text)
    return text


def run(command: list[str], timeout: int = 45) -> dict:
    if not command[0] or shutil.which(command[0]) is None:
        return {"command": " ".join(command), "available": False, "code": None, "out": "", "err": f"{command[0]} not installed"}
    try:
        proc = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
        return {
            "command": " ".join(command),
            "available": True,
            "code": proc.returncode,
            "out": redact(proc.stdout.strip()),
            "err": redact(proc.stderr.strip()),
        }
    except subprocess.TimeoutExpired:
        return {"command": " ".join(command), "available": True, "code": None, "out": "", "err": f"TIMEOUT after {timeout}s"}
    except Exception as error:  # noqa: BLE001 - audit must never crash on a delivery probe
        return {"command": " ".join(command), "available": True, "code": None, "out": "", "err": redact(f"{type(error).__name__}: {error}")}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()

    checks = {
        "gh_installed": run(["gh", "--version"], 15),
        "gh_auth_status": run(["gh", "auth", "status"], args.timeout),
        "git_remote": run(["git", "remote"], args.timeout),
        "git_ls_remote": run(["git", "ls-remote", "--heads", "origin", args.branch], args.timeout),
        "git_head": run(["git", "rev-parse", "HEAD"], 15),
        "git_branch": run(["git", "rev-parse", "--abbrev-ref", "HEAD"], 15),
        "git_upstream": run(["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], 15),
        "git_unpushed": run(["git", "log", "--oneline", f"origin/{args.branch}..HEAD"], 20),
    }

    gh_auth = checks["gh_auth_status"]
    ls_remote = checks["git_ls_remote"]
    auth_ok = gh_auth["code"] == 0
    remote_reachable = ls_remote["code"] == 0

    if auth_ok and remote_reachable:
        status, reason = "DELIVERY_READY", "gh auth valid and origin reachable - push can proceed"
    elif not auth_ok:
        status = "AUTH_FAILED"
        reason = (gh_auth["err"] or gh_auth["out"] or "gh auth status returned a non-zero exit code")[:600]
    else:
        status = "REMOTE_UNREACHABLE"
        reason = (ls_remote["err"] or ls_remote["out"] or "git ls-remote failed")[:600]

    payload = {
        "audit": "github-delivery",
        "branch": args.branch,
        "status": status,
        "reason": reason,
        "ghAuthenticated": auth_ok,
        "originReachable": remote_reachable,
        "policy": "no token was requested, printed, or stored; all captured output passed through a redactor",
        "probes": checks,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"[{status}] branch={args.branch}")
    print(f"  gh auth status  -> exit={gh_auth['code']} :: {(gh_auth['err'] or gh_auth['out'])[:180]}")
    print(f"  git ls-remote   -> exit={ls_remote['code']} :: {(ls_remote['err'] or ls_remote['out'])[:180]}")
    print(f"  head            -> {checks['git_head']['out'][:64]}")
    print(f"  evidence        -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
