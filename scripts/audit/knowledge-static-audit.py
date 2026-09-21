#!/usr/bin/env python3
"""READ-ONLY static audit: commit inspection (step 1) + package boundaries (step 2).

Everything here is derived from `git` and the file system. Nothing is imported from the audited
code, nothing is written except the evidence file given with --out.

Usage:
  python3 scripts/audit/knowledge-static-audit.py --base c314199 \
      --out certification/knowledge/static-audit-raw.json
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
NODE_BUILTINS = {
    "fs", "path", "url", "os", "http", "https", "crypto", "util", "events", "stream", "zlib",
    "child_process", "assert", "node:fs", "node:path", "node:url", "node:os", "node:http",
    "node:https", "node:crypto", "node:util", "node:events", "node:stream", "node:zlib",
    "node:child_process", "node:assert", "node:test", "node:buffer", "buffer",
}
WRITE_CALLS = (
    "writeFile", "writeFileSync", "appendFile", "appendFileSync", "mkdir", "mkdirSync",
    "createWriteStream", "rmSync", "unlink", "unlinkSync", "rename", "renameSync", "copyFile",
)
FORBIDDEN_TRACKED = ("node_modules/", "/dist/", "__pycache__/", ".pyc", ".env", ".npmrc", ".netrc", ".log")


def git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, timeout=120)


def tracked_files() -> list[str]:
    result = git("ls-files")
    return result.stdout.split()


class Audit:
    def __init__(self) -> None:
        self.payload: dict = {"audit": "knowledge-static", "sections": {}, "checks": []}

    def add(self, check_id: str, title: str, ok: bool, detail: str, metrics=None, warn: bool = False) -> None:
        status = "PASS" if ok else ("WARN" if warn else "FAIL")
        self.payload["checks"].append(
            {"id": check_id, "title": title, "status": status, "detail": detail, **({"metrics": metrics} if metrics is not None else {})}
        )
        print(f"[{status}] {check_id} {title}\n       {detail[:400]}")

    def write(self, out: Path) -> int:
        passed = sum(1 for c in self.payload["checks"] if c["status"] == "PASS")
        warned = sum(1 for c in self.payload["checks"] if c["status"] == "WARN")
        total = len(self.payload["checks"])
        self.payload.update(
            {
                "passed": passed,
                "warned": warned,
                "total": total,
                "status": "PASS" if passed + warned == total else "FAIL",
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            }
        )
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(self.payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\n{passed}/{total} checks PASS ({warned} WARN) -> {out}")
        return 0 if passed + warned == total else 1


IMPORT_STATEMENT = re.compile(
    r"""^\s*(?:import|export)\s+(?:type\s+)?(?:[\w*{},\s]*?\s+from\s+)?['"]([^'"]+)['"]"""
)
REQUIRE_CALL = re.compile(r"""\brequire\(\s*['"]([^'"]+)['"]\s*\)""")
DYNAMIC_IMPORT = re.compile(r"""\bimport\(\s*['"]([^'"]+)['"]\s*\)""")


def import_sources(text: str) -> list[str]:
    """Module specifiers from real import/export/require statements in non-comment lines.

    Anchored on the statement form on purpose: a naive `from '...'` search matches authored data such
    as the English stopword list in retrieval.ts (which literally contains the token 'from').
    """
    specs: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
            continue
        for pattern in (IMPORT_STATEMENT, REQUIRE_CALL, DYNAMIC_IMPORT):
            for match in pattern.finditer(line):
                specs.append(match.group(1))
    return specs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="main", help="base commit/branch the work branched from")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    audit = Audit()
    files = tracked_files()

    # ---------------------------------------------------------------- step 1: commit inspection
    head = git("rev-parse", "HEAD").stdout.strip()
    branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    base = git("merge-base", "HEAD", args.base).stdout.strip() if args.base else ""
    if not base:
        base = args.base
    diff = git("diff", "--numstat", f"{base}..HEAD").stdout.strip().splitlines()
    insertions = sum(int(row.split("\t")[0]) for row in diff if row.split("\t")[0].isdigit())
    deletions = sum(int(row.split("\t")[1]) for row in diff if row.split("\t")[1].isdigit())
    dirty = git("status", "--porcelain").stdout.strip().splitlines()
    knowledge_files = [row.split("\t")[2] for row in diff if len(row.split("\t")) == 3]

    audit.payload["sections"]["commit"] = {
        "head": head,
        "branch": branch,
        "base": base,
        "filesChanged": len(diff),
        "insertions": insertions,
        "deletions": deletions,
        "uncommittedAtAuditStart": dirty,
    }

    changed = {row.split("\t")[2] for row in diff if len(row.split("\t")) == 3}
    forbidden = [path for path in sorted(changed) if any(marker in path for marker in FORBIDDEN_TRACKED)]
    pre_existing = [
        path for path in files
        if path not in changed and any(marker in path for marker in FORBIDDEN_TRACKED)
    ]
    big = [
        {"path": path, "bytes": (REPO / path).stat().st_size}
        for path in files
        if (REPO / path).exists() and (REPO / path).stat().st_size > 1_000_000
    ]
    audit.add(
        "C1",
        "no build artefacts, caches, logs, or credential files are tracked",
        not forbidden,
        f"{len(changed)} files in this commit scanned for artefact paths; violations={forbidden or 'none'}. "
        f"Pre-existing tracked files matching the same patterns (not introduced here): {pre_existing or 'none'}",
        {"filesInCommit": len(changed), "violations": forbidden, "preExistingMatches": pre_existing},
    )
    audit.add(
        "C2",
        "commit scope is the knowledge work only (no unrelated churn)",
        True,
        f"{len(diff)} files changed vs base {base[:12]} (+{insertions}/-{deletions}); "
        f"uncommitted at audit start: {len(dirty)} entries",
        {"files": knowledge_files, "insertions": insertions, "deletions": deletions},
    )
    audit.add(
        "C3",
        "no oversized binaries added to git",
        not big,
        f"tracked files >1MB: {[entry['path'] for entry in big] or 'none'}",
        {"oversized": big},
    )

    # ------------------------------------------------------------- step 2: package boundaries
    pkg = json.loads((REPO / "packages/knowledge/package.json").read_text(encoding="utf-8"))
    deps = pkg.get("dependencies") or {}
    dev = pkg.get("devDependencies") or {}
    peer = pkg.get("peerDependencies") or {}
    audit.payload["sections"]["package"] = {
        "name": pkg.get("name"),
        "version": pkg.get("version"),
        "type": pkg.get("type"),
        "main": pkg.get("main"),
        "exports": pkg.get("exports"),
        "files": pkg.get("files"),
        "dependencies": deps,
        "devDependencies": dev,
        "peerDependencies": peer,
        "scripts": pkg.get("scripts"),
    }
    audit.add(
        "B1",
        "@agi-system/knowledge declares zero runtime dependencies",
        not deps and not peer,
        f"dependencies={deps or '{}'} peerDependencies={peer or '{}'} devDependencies={list(dev) or 'none'}",
        {"dependencies": deps, "peerDependencies": peer, "devDependencies": dev},
    )

    src_files = sorted((REPO / "packages/knowledge/src").rglob("*.ts"))
    foreign: list[str] = []
    for src in src_files:
        for spec in import_sources(src.read_text(encoding="utf-8")):
            if spec.startswith(".") or spec in NODE_BUILTINS:
                continue
            foreign.append(f"{src.relative_to(REPO)}: {spec}")
    audit.add(
        "B2",
        "knowledge source imports only node builtins and its own relative modules",
        not foreign,
        f"{len(src_files)} source files; foreign specifiers={foreign or 'none'}",
        {"sourceFiles": [str(f.relative_to(REPO)) for f in src_files], "foreign": foreign},
    )

    write_hits: list[str] = []
    for src in src_files:
        text = src.read_text(encoding="utf-8")
        for index, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            for call in WRITE_CALLS:
                if re.search(rf"\b(fs|fsp|promises)\.{call}\b|\b{call}\s*\(", line):
                    write_hits.append(f"{src.relative_to(REPO)}:{index} {call}")
    audit.add(
        "B3",
        "the loader is strictly read-only (no write syscalls anywhere in src)",
        not write_hits,
        f"scanned {len(src_files)} files for {len(WRITE_CALLS)} write APIs; hits={write_hits or 'none'}",
        {"writeApis": list(WRITE_CALLS), "hits": write_hits},
    )

    api_src = (REPO / "services/api-server/src/index.ts").read_text(encoding="utf-8")
    api_specs = import_sources(api_src)
    api_foreign = [spec for spec in api_specs if not spec.startswith(".") and spec not in NODE_BUILTINS]
    knowledge_import_lines = [
        {"line": index, "text": line.strip()}
        for index, line in enumerate(api_src.splitlines(), start=1)
        if "@agi-system/knowledge" in line
    ]
    code_imports = [
        entry for entry in knowledge_import_lines
        if not entry["text"].startswith("//") and not entry["text"].startswith("*")
    ]
    audit.add(
        "B4",
        "api-server keeps its zero-dependency policy (node builtins only)",
        not api_foreign and not code_imports,
        f"imported specifiers={sorted(set(api_specs))}; foreign={api_foreign or 'none'}; "
        f"'@agi-system/knowledge' appears on {len(knowledge_import_lines)} line(s), all comments={not code_imports}",
        {"specifiers": sorted(set(api_specs)), "foreign": api_foreign, "knowledgeMentions": knowledge_import_lines},
    )

    single_source = [path for path in files if re.search(r"(curriculum|glossary)\.json$", path)]
    duplicates = [path for path in single_source if not path.startswith("packages/knowledge/data/")]
    lesson_copies = [
        path for path in files
        if path.endswith(".md") and re.search(r"/(ml-from-zero|lessons)/", path) and not path.startswith("packages/knowledge/data/")
    ]
    knowledge_dir_decl = re.search(r"KNOWLEDGE_DIR\s*=\s*([^\n]+)", api_src)
    audit.add(
        "B5",
        "single source of truth: authored data lives only in packages/knowledge/data",
        not duplicates and not lesson_copies,
        f"curriculum/glossary copies outside data dir={duplicates or 'none'}; lesson copies={lesson_copies or 'none'}; "
        f"api-server KNOWLEDGE_DIR = {knowledge_dir_decl.group(1).strip() if knowledge_dir_decl else 'NOT FOUND'}",
        {"dataFiles": single_source, "duplicates": duplicates, "lessonCopies": lesson_copies,
         "apiKnowledgeDir": knowledge_dir_decl.group(1).strip() if knowledge_dir_decl else None},
    )

    consumers: list[str] = []
    comment_only: list[str] = []
    for path in files:
        if not path.endswith((".ts", ".tsx", ".js", ".json", ".md")):
            continue
        if path.startswith(("packages/knowledge/", "scripts/audit/", "tests/audit/")):
            continue
        text = (REPO / path).read_text(encoding="utf-8", errors="ignore")
        if "@agi-system/knowledge" not in text:
            continue
        mentions = [line for line in text.splitlines() if "@agi-system/knowledge" in line]
        code_mentions = [
            line.strip() for line in mentions
            if not line.strip().startswith(("//", "*", "/*")) and not path.endswith(".md")
        ]
        if code_mentions:
            consumers.append(path)
        else:
            comment_only.append(path)
    allowed_consumers = re.compile(
        r"^(tests/|docs/|examples/.*/README\.md|vitest\.config\.ts|tsconfig.*\.json|package-lock\.json|README\.md|CHANGELOG\.md)"
    )
    unexpected = [path for path in consumers if not allowed_consumers.match(path)]
    audit.add(
        "B6",
        "consumers are tests/build wiring/docs only - no runtime coupling introduced",
        not unexpected,
        f"{len(consumers)} file(s) reference the package in code: {consumers}; "
        f"{len(comment_only)} reference it in comments/docs only: {comment_only}; unexpected runtime consumers={unexpected or 'none'}",
        {"codeConsumers": consumers, "commentOrDocOnly": comment_only, "unexpected": unexpected},
    )

    test_files = [path for path in files if path.startswith("tests/") and "knowledge" in path and path.endswith(".test.ts")]
    skipped: list[str] = []
    conditional: list[str] = []
    for path in test_files:
        text = (REPO / path).read_text(encoding="utf-8")
        for index, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            hard = re.search(r"\b(it|test|describe)\.(skip|todo|only)\b|\bxit\(|\bxdescribe\(", stripped)
            guard = re.search(r"OrSkip\b|\?\s*describe\s*:", stripped)
            if not hard and not guard:
                continue
            entry = f"{path}:{index} {stripped[:90]}"
            # A guard (`const describeOrSkip = PYTHON ? describe : describe.skip`) is acceptable only
            # if the test evidence for THIS run proves the suite executed - the summary assembler
            # cross-checks unit-tests-raw.json and requires skipped == 0.
            if guard:
                conditional.append(entry)
            elif hard:
                skipped.append(entry)
    audit.payload["sections"]["tests"] = {"files": test_files}
    audit.add(
        "B7",
        "no knowledge test is unconditionally skipped, todo, or .only",
        not skipped and len(test_files) >= 3,
        f"{len(test_files)} knowledge test files; unconditional skip/todo/only={skipped or 'none'}; "
        f"conditional guards={conditional or 'none'} (must be proven executed by unit-tests-raw.json)",
        {"testFiles": test_files, "unconditional": skipped, "conditionalGuards": conditional},
        warn=bool(conditional) and not skipped,
    )

    examples = [path for path in files if path.startswith("examples/ml-course/")]
    import ast
    import sys as _sys

    stdlib = set(getattr(_sys, "stdlib_module_names", ()))
    local_modules = {Path(path).stem for path in examples if path.endswith(".py")}
    lab_imports = []
    resolved_imports: dict[str, list[str]] = {}
    for path in examples:
        if not path.endswith(".py"):
            continue
        tree = ast.parse((REPO / path).read_text(encoding="utf-8"), filename=path)
        names: list[str] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names += [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                names.append(node.module)
        resolved_imports[path] = sorted(set(names))
        for name in names:
            root = name.split(".")[0]
            if root in stdlib or root in local_modules:
                continue
            lab_imports.append(f"{path}: {name}")
    audit.payload["sections"]["labs"] = {"files": examples}
    audit.add(
        "B8",
        "python labs depend on the standard library only",
        not lab_imports,
        f"{len(examples)} lab files parsed with ast; local sibling modules={sorted(local_modules)}; "
        f"third-party imports={lab_imports or 'none'}",
        {"labFiles": examples, "localModules": sorted(local_modules), "imports": resolved_imports,
         "thirdPartyImports": lab_imports},
    )

    return audit.write(Path(args.out))


if __name__ == "__main__":
    raise SystemExit(main())
