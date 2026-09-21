#!/usr/bin/env python3
"""
READ-ONLY content audit for the knowledge base curriculum `ml-from-zero`.

Deliberately written in Python with its own frontmatter parser so it does NOT trust
the TypeScript loader it is auditing (`packages/knowledge/src/loader.ts`). Two
independent implementations reading the same files must agree - that is the point.

It changes nothing: no writes inside packages/, examples/ or tests/. The only output
is the JSON evidence file given by --output (default: stdout).

Checks
  C1  lesson inventory: 16 files, unique ids/slugs, contiguous order 1..16
  C2  required frontmatter keys present and non-empty
  C3  objectives_ar / objectives_en are equal-length JSON arrays (>= 2)
  C4  body: real Arabic text, "## English recap" present, >= 150 words, no placeholders
  C5  stages: 8, order 1..8, every lesson in exactly one stage, bijective with files
  C6  lesson.terms subset of glossary ids
  C7  glossary: bilingual term + definition (>= 20 chars) + >= 1 alias + valid lesson links
  C8  quizzes: valid lessonId, >= 3 options, answerIndex in range, bilingual text, >= 1 per lesson
  C9  labs: every lesson has a code path that exists, marker present, run command consistent
  C10 labs compile and import stdlib only (no third-party dependency)
  C11 pipeline values are from the canonical 8 steps, and all 8 steps are taught
  C12 curriculum meta complete + attribution present
  C13 no secret-looking strings anywhere in content or labs

Usage
  python3 scripts/audit/knowledge-content-audit.py --output certification/knowledge/content-audit-raw.json
"""

from __future__ import annotations

import argparse
import ast
import json
import py_compile
import re
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "packages" / "knowledge" / "data" / "ml-from-zero"
LESSONS = DATA / "lessons"
LABS = REPO / "examples" / "ml-course"

CANONICAL_PIPELINE = ["problem", "data", "model", "prediction", "loss", "optimization",
                      "evaluation", "iteration"]
PIPELINE_STEPS = set(CANONICAL_PIPELINE)
REQUIRED_KEYS = ("id", "order", "stage", "title_ar", "title_en", "summary_ar", "summary_en",
                 "difficulty", "pipeline", "terms")
SECRET_PATTERNS = [
    r"ghp_[A-Za-z0-9]{20,}", r"github_pat_[A-Za-z0-9]{20,}", r"sk-[A-Za-z0-9]{20,}",
    r"AKIA[0-9A-Z]{16}", r"xox[baprs]-[A-Za-z0-9-]{10,}", r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
]
PLACEHOLDERS = ("TODO", "TBD", "FIXME", "lorem ipsum", "XXX_", "PLACEHOLDER")


def parse_frontmatter(raw: str) -> tuple[dict, str]:
    data: dict[str, object] = {}
    if not raw.startswith("---"):
        return data, raw.strip()
    end = raw.find("\n---", 3)
    if end == -1:
        return data, raw.strip()
    for line in raw[3:end].split("\n"):
        line = line.strip()
        if not line or ":" not in line:
            continue
        key, _, value = line.partition(":")
        key, value = key.strip(), value.strip()
        if value.startswith("[") and value.endswith("]"):
            try:
                parsed = json.loads(value)
                data[key] = [str(item) for item in parsed] if isinstance(parsed, list) else value
                continue
            except json.JSONDecodeError:
                data[key] = [item.strip() for item in value[1:-1].split(",") if item.strip()]
        elif key in ("pipeline", "concepts", "terms", "aliases"):
            data[key] = [item.strip() for item in value.split(",") if item.strip()]
        else:
            data[key] = value
    return data, raw[end + 4:].lstrip("\n").strip()


def has_arabic(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06FF]", text))


class Audit:
    def __init__(self) -> None:
        self.checks: list[dict] = []
        self.violations: list[str] = []

    def check(self, cid: str, title: str, ok: bool, detail: str, evidence: dict | None = None) -> bool:
        # evidence is nested so a key like {"id": ...} can never overwrite the check id
        self.checks.append({"id": cid, "title": title, "status": "PASS" if ok else "FAIL",
                            "detail": detail, "evidence": evidence or {}})
        if not ok:
            self.violations.append(f"{cid}: {detail}")
        return ok


def main() -> int:
    parser = argparse.ArgumentParser(description="READ-ONLY knowledge content audit")
    parser.add_argument("--output", help="write JSON evidence here (default: stdout)")
    args = parser.parse_args()

    audit = Audit()
    curriculum = json.loads((DATA / "curriculum.json").read_text(encoding="utf-8"))
    glossary_file = json.loads((DATA / "glossary.json").read_text(encoding="utf-8"))
    glossary = glossary_file["terms"]
    term_ids = {term["id"] for term in glossary}
    stages = curriculum["stages"]
    quizzes = curriculum["quizzes"]

    lesson_files = sorted(LESSONS.glob("*.md"))
    lessons = []
    for file in lesson_files:
        data, body = parse_frontmatter(file.read_text(encoding="utf-8"))
        lessons.append({"file": file.name, "data": data, "body": body})

    by_id = {str(l["data"].get("id")): l for l in lessons}

    # ------------------------------------------------------------------ C1
    ids = [str(l["data"].get("id")) for l in lessons]
    slugs = [str(l["data"].get("slug")) for l in lessons]
    orders = [int(l["data"].get("order", 0)) for l in lessons]
    audit.check("C1", "lesson inventory", 
                len(lessons) == 16 and len(set(ids)) == 16 and len(set(slugs)) == 16
                and orders == list(range(1, 17)),
                f"{len(lessons)} lesson files, unique ids={len(set(ids))}, unique slugs={len(set(slugs))}, orders={orders[:3]}..{orders[-1]}",
                {"lesson_files": len(lessons), "orders": orders})

    # ------------------------------------------------------------------ C2
    missing = []
    for lesson in lessons:
        for key in REQUIRED_KEYS:
            value = lesson["data"].get(key)
            if value is None or value == "" or value == []:
                missing.append(f"{lesson['file']}:{key}")
    audit.check("C2", "required frontmatter keys", not missing,
                "all present" if not missing else f"missing {missing[:6]}", {"missing": missing})

    # ------------------------------------------------------------------ C3
    objective_issues = []
    objective_counts = []
    for lesson in lessons:
        ar = lesson["data"].get("objectives_ar")
        en = lesson["data"].get("objectives_en")
        if not isinstance(ar, list) or not isinstance(en, list) or len(ar) != len(en) or len(ar) < 2:
            objective_issues.append(lesson["file"])
        else:
            objective_counts.append(len(ar))
            if any(not str(x).strip() for x in ar + en):
                objective_issues.append(f"{lesson['file']}:empty-objective")
    audit.check("C3", "bilingual objectives", not objective_issues,
                f"{sum(objective_counts)} objectives across {len(objective_counts)} lessons"
                if not objective_issues else f"issues: {objective_issues[:5]}",
                {"total_objectives": sum(objective_counts), "issues": objective_issues})

    # ------------------------------------------------------------------ C4
    body_issues = []
    word_counts = []
    for lesson in lessons:
        body = lesson["body"]
        words = len(body.split())
        word_counts.append(words)
        if not has_arabic(body):
            body_issues.append(f"{lesson['file']}:no-arabic")
        if "## English recap" not in body:
            body_issues.append(f"{lesson['file']}:no-english-recap")
        if words < 150:
            body_issues.append(f"{lesson['file']}:too-short({words})")
        for placeholder in PLACEHOLDERS:
            if placeholder.lower() in body.lower():
                body_issues.append(f"{lesson['file']}:placeholder:{placeholder}")
    audit.check("C4", "lesson bodies (arabic + english recap + substance)", not body_issues,
                f"total {sum(word_counts)} words, min {min(word_counts)}, max {max(word_counts)}"
                if not body_issues else f"issues: {body_issues[:6]}",
                {"total_words": sum(word_counts), "min_words": min(word_counts),
                 "max_words": max(word_counts), "issues": body_issues})

    # ------------------------------------------------------------------ C5
    stage_ids = [s["id"] for s in stages]
    stage_orders = [s["order"] for s in stages]
    referenced = [lid for s in stages for lid in s["lessonIds"]]
    stage_of = {}
    duplicates = []
    for lid in referenced:
        if lid in stage_of:
            duplicates.append(lid)
        stage_of[lid] = lid
    bijective = set(referenced) == set(ids) and not duplicates
    stage_field_ok = all(str(l["data"].get("stage")) in stage_ids for l in lessons)
    stage_field_matches = all(
        l["data"].get("stage") == next((s["id"] for s in stages if l["data"].get("id") in s["lessonIds"]), None)
        for l in lessons
    )
    audit.check("C5", "stage/lesson mapping",
                len(stages) == 8 and stage_orders == list(range(1, 9)) and bijective
                and stage_field_ok and stage_field_matches,
                f"{len(stages)} stages, orders {stage_orders}, referenced={len(referenced)}, "
                f"bijective={bijective}, stage field matches={stage_field_matches}, duplicates={duplicates}",
                {"stages": len(stages), "stage_ids": stage_ids, "duplicates": duplicates})

    # ------------------------------------------------------------------ C6
    unknown_terms = []
    for lesson in lessons:
        for term in lesson["data"].get("terms", []) or []:
            if term not in term_ids:
                unknown_terms.append(f"{lesson['data'].get('id')}:{term}")
    terms_used = {t for l in lessons for t in (l["data"].get("terms") or [])}
    audit.check("C6", "lesson terms resolve to glossary", not unknown_terms,
                f"{len(terms_used)} distinct terms used, all resolve" if not unknown_terms
                else f"unknown: {unknown_terms[:6]}",
                {"distinct_terms_used": len(terms_used), "unknown": unknown_terms})

    # ------------------------------------------------------------------ C7
    glossary_issues = []
    alias_counts = []
    for term in glossary:
        alias_counts.append(len(term.get("aliases", [])))
        if not term.get("term", {}).get("ar") or not term.get("term", {}).get("en"):
            glossary_issues.append(f"{term['id']}:term-not-bilingual")
        for lang in ("ar", "en"):
            if len(term.get("definition", {}).get(lang, "")) < 20:
                glossary_issues.append(f"{term['id']}:definition-{lang}-too-short")
        if len(term.get("aliases", [])) < 1:
            glossary_issues.append(f"{term['id']}:no-aliases")
        for lid in term.get("lessonIds", []):
            if lid not in by_id:
                glossary_issues.append(f"{term['id']}:bad-lesson-ref:{lid}")
        if not has_arabic(term.get("definition", {}).get("ar", "")):
            glossary_issues.append(f"{term['id']}:arabic-definition-not-arabic")
    audit.check("C7", "glossary quality (bilingual + aliases + links)", not glossary_issues,
                f"{len(glossary)} terms, {sum(alias_counts)} aliases (avg {sum(alias_counts)/max(1,len(alias_counts)):.1f})"
                if not glossary_issues else f"issues: {glossary_issues[:6]}",
                {"terms": len(glossary), "aliases": sum(alias_counts), "issues": glossary_issues})

    # ------------------------------------------------------------------ C8
    quiz_issues = []
    covered = set()
    for quiz in quizzes:
        lid = quiz.get("lessonId")
        covered.add(lid)
        if lid not in by_id:
            quiz_issues.append(f"{quiz.get('id')}:bad-lesson:{lid}")
        options = quiz.get("options", [])
        if len(options) < 3:
            quiz_issues.append(f"{quiz.get('id')}:too-few-options")
        answer = quiz.get("answerIndex")
        if not isinstance(answer, int) or not (0 <= answer < len(options)):
            quiz_issues.append(f"{quiz.get('id')}:answerIndex-out-of-range({answer})")
        for field in ("question", "explanation"):
            for lang in ("ar", "en"):
                if len(quiz.get(field, {}).get(lang, "")) < 10:
                    quiz_issues.append(f"{quiz.get('id')}:{field}-{lang}-too-short")
        for option in options:
            if not option.get("ar") or not option.get("en"):
                quiz_issues.append(f"{quiz.get('id')}:option-not-bilingual")
    lessons_without_quiz = sorted(set(ids) - covered)
    audit.check("C8", "quiz bank validity + coverage",
                not quiz_issues and not lessons_without_quiz,
                f"{len(quizzes)} quizzes covering {len(covered & set(ids))}/{len(ids)} lessons"
                if not quiz_issues and not lessons_without_quiz
                else f"issues={quiz_issues[:5]} lessons_without_quiz={lessons_without_quiz}",
                {"quizzes": len(quizzes), "lessons_covered": len(covered & set(ids)),
                 "lessons_without_quiz": lessons_without_quiz, "issues": quiz_issues})

    # ------------------------------------------------------------------ C9
    lab_issues = []
    lab_paths = set()
    for lesson in lessons:
        data = lesson["data"]
        code = data.get("code")
        if not code:
            lab_issues.append(f"{data.get('id')}:no-lab")
            continue
        lab_paths.add(code)
        path = REPO / code
        if not path.exists():
            lab_issues.append(f"{data.get('id')}:lab-missing:{code}")
            continue
        text = path.read_text(encoding="utf-8")
        marker = data.get("code_marker") or "RESULT"
        if marker not in text:
            lab_issues.append(f"{data.get('id')}:marker-{marker}-absent")
        run = data.get("code_run") or ""
        if code not in run:
            lab_issues.append(f"{data.get('id')}:run-command-mismatch:{run}")
    stages_with_lab = {next((s["id"] for s in stages if lid in s["lessonIds"]), None)
                       for lid, l in by_id.items() if l["data"].get("code")}
    audit.check("C9", "lab linkage (path exists, marker present, run command consistent)",
                not lab_issues,
                f"{len(lab_paths)} distinct labs referenced by 16 lessons, {len(stages_with_lab)} stages covered"
                if not lab_issues else f"issues: {lab_issues[:6]}",
                {"distinct_labs": sorted(lab_paths), "issues": lab_issues})

    # ------------------------------------------------------------------ C10
    stdlib = set(sys.stdlib_module_names)
    local_modules = {p.stem for p in LABS.glob("*.py")}
    dependency_issues = []
    compile_issues = []
    lab_files = sorted(LABS.glob("*.py"))
    for lab in lab_files:
        try:
            with tempfile.TemporaryDirectory() as tmp:
                py_compile.compile(str(lab), cfile=str(Path(tmp) / "lab.pyc"), doraise=True)
        except py_compile.PyCompileError as exc:
            compile_issues.append(f"{lab.name}: {exc.msg.splitlines()[0][:80]}")
        tree = ast.parse(lab.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            modules = []
            if isinstance(node, ast.Import):
                modules = [alias.name.split(".")[0] for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                modules = [node.module.split(".")[0]]
            for module in modules:
                if module not in stdlib and module not in local_modules:
                    dependency_issues.append(f"{lab.name}:{module}")
    audit.check("C10", "labs compile + stdlib-only (zero third-party deps)",
                not compile_issues and not dependency_issues,
                f"{len(lab_files)} lab files compile; imports limited to stdlib + local mlmini"
                if not compile_issues and not dependency_issues
                else f"compile={compile_issues[:3]} deps={dependency_issues[:5]}",
                {"lab_files": [lab.name for lab in lab_files],
                 "compile_issues": compile_issues, "third_party_imports": dependency_issues})

    # ------------------------------------------------------------------ C11
    pipeline_issues = []
    covered_steps = set()
    for lesson in lessons:
        steps = lesson["data"].get("pipeline") or []
        if not steps:
            pipeline_issues.append(f"{lesson['data'].get('id')}:no-pipeline")
        for step in steps:
            if step not in PIPELINE_STEPS:
                pipeline_issues.append(f"{lesson['data'].get('id')}:bad-step:{step}")
            covered_steps.add(step)
    uncovered = sorted(PIPELINE_STEPS - covered_steps)
    audit.check("C11", "pipeline mapping valid and complete",
                not pipeline_issues and not uncovered,
                f"steps taught: {sorted(covered_steps)}" if not pipeline_issues and not uncovered
                else f"issues={pipeline_issues[:5]} uncovered={uncovered}",
                {"steps_taught": sorted(covered_steps), "uncovered": uncovered, "issues": pipeline_issues})

    # ------------------------------------------------------------------ C12
    meta = curriculum
    meta_ok = (meta.get("id") == "ml-from-zero" and bool(meta.get("version"))
               and meta.get("title", {}).get("ar") and meta.get("title", {}).get("en")
               and len(meta.get("description", {}).get("ar", "")) > 40
               and len(meta.get("description", {}).get("en", "")) > 40
               and meta.get("pipeline") == CANONICAL_PIPELINE
               and "Andrew Ng" in meta.get("attribution", {}).get("ar", "")
               and "Andrew Ng" in meta.get("attribution", {}).get("en", ""))
    audit.check("C12", "curriculum meta + attribution", bool(meta_ok),
                f"id={meta.get('id')} version={meta.get('version')} pipeline={len(meta.get('pipeline', []))} steps, "
                f"attribution mentions Andrew Ng in ar+en",
                {"id": meta.get("id"), "version": meta.get("version"), "pipeline": meta.get("pipeline")})

    # ------------------------------------------------------------------ C13
    secret_hits = []
    scanned = list(DATA.rglob("*.md")) + list(DATA.rglob("*.json")) + list(LABS.glob("*.py"))
    for file in scanned:
        text = file.read_text(encoding="utf-8", errors="ignore")
        for pattern in SECRET_PATTERNS:
            if re.search(pattern, text):
                secret_hits.append(f"{file.relative_to(REPO)}:{pattern}")
    audit.check("C13", "no secret-looking strings", not secret_hits,
                f"scanned {len(scanned)} files, no credential patterns" if not secret_hits
                else f"hits: {secret_hits[:4]}",
                {"files_scanned": len(scanned), "hits": secret_hits})

    # ------------------------------------------------------------------ summary
    passed = sum(1 for check in audit.checks if check["status"] == "PASS")
    total = len(audit.checks)
    result = {
        "audit": "knowledge-content",
        "mode": "READ-ONLY (independent Python parser; does not use the TS loader under audit)",
        "target": {
            "package": "@agi-system/knowledge",
            "curriculum": meta.get("id"),
            "version": meta.get("version"),
            "data_dir": str(DATA.relative_to(REPO)),
            "commit": __import__("subprocess").run(
                ["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True
            ).stdout.strip(),
        },
        "counts": {
            "stages": len(stages),
            "lessons": len(lessons),
            "glossary_terms": len(glossary),
            "glossary_aliases": sum(alias_counts),
            "quizzes": len(quizzes),
            "labs": len(lab_files),
            "lesson_words": sum(word_counts),
            "objectives": sum(objective_counts),
        },
        "checks": audit.checks,
        "passed": passed,
        "total": total,
        "violations": audit.violations,
        "status": "PASS" if passed == total else "FAIL",
        "python": sys.version.split()[0],
    }

    payload = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(payload + "\n", encoding="utf-8")
        print(f"[content-audit] {passed}/{total} checks PASS → {out}")
    else:
        print(payload)

    for check in audit.checks:
        mark = "✅" if check["status"] == "PASS" else "❌"
        print(f"  {mark} {check['id']:<4} {check['title']:<58} {check['status']}")
    if audit.violations:
        print("\nViolations:")
        for violation in audit.violations:
            print(f"  - {violation}")

    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
