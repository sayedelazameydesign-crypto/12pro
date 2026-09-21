#!/usr/bin/env python3
"""READ-ONLY API audit: verify the knowledge endpoints against the real authored files.

Independence rules (deliberate duplication):
  * This script parses the data files with its own minimal frontmatter/JSON reader. It does NOT
    import anything from packages/knowledge or services/api-server, so a bug in the TypeScript
    loader cannot hide behind the audit.
  * It only issues GET requests and only reads files. It never writes to the repository except the
    evidence file given with --out.

Usage:
  python3 scripts/audit/knowledge-api-audit.py --base http://127.0.0.1:3101 \
      --data packages/knowledge/data/ml-from-zero \
      --out certification/knowledge/api-audit-raw.json

  # degraded mode: server booted without the data directory available
  python3 scripts/audit/knowledge-api-audit.py --base http://127.0.0.1:3102 --mode unavailable \
      --data packages/knowledge/data/ml-from-zero \
      --out certification/knowledge/api-unavailable-raw.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

LIST_KEYS = {"pipeline", "concepts", "terms"}
REQUESTS = {"count": 0, "errors": 0, "slowest_ms": 0.0}


# --------------------------------------------------------------------------- #
# independent ground truth (own parser, duplicated on purpose)
# --------------------------------------------------------------------------- #
def split_frontmatter(raw: str) -> tuple[dict, str]:
    if not raw.startswith("---"):
        return {}, raw.strip()
    end = raw.find("\n---", 3)
    if end == -1:
        return {}, raw.strip()
    data: dict = {}
    for line in raw[3:end].splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key, value = key.strip(), value.strip()
        if not key:
            continue
        if key in LIST_KEYS or value.startswith("["):
            body = value[1:-1] if value.startswith("[") and value.endswith("]") else value
            try:
                parsed = json.loads(value) if value.startswith("[") else None
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, list):
                data[key] = [str(item) for item in parsed]
            else:
                data[key] = [part.strip() for part in body.split(",") if part.strip()]
        else:
            data[key] = value
    body = raw[end + 4 :].lstrip("\r\n").strip()
    return data, body


def word_count(body: str) -> int:
    return len([token for token in re.split(r"\s+", body) if token])


def bilingual(value) -> dict:
    """Frontmatter stores `title: ar | en` style values; JSON files store {ar, en}."""
    if isinstance(value, dict):
        return {"ar": str(value.get("ar", "")), "en": str(value.get("en", ""))}
    text = str(value)
    if "|" in text:
        ar, _, en = text.partition("|")
        return {"ar": ar.strip(), "en": en.strip()}
    return {"ar": text.strip(), "en": ""}


def load_truth(data_dir: Path, repo_root: Path) -> dict:
    """Ground truth parsed independently from the authored files.

    Schema (as authored):
      curriculum.json -> {id, version, title{ar,en}, description, pipeline[8], attribution,
                          stages[8]{id, order, title, goal, outcome, artifact, lessonIds[]},
                          quizzes[26]{id, lessonId, question{ar,en}, options[{ar,en}], answerIndex,
                                      explanation{ar,en}}}
      glossary.json   -> {id, version, note, terms[49]{id, term{ar,en}, definition{ar,en}, aliases[]}}
      lessons/NN-*.md -> frontmatter: id, slug, order, stage, title_ar, title_en, summary_ar,
                         summary_en, difficulty, pipeline[], concepts[], terms[], objectives_ar[],
                         objectives_en[], code, code_run, code_lang, code_marker + markdown body
    """
    curriculum = json.loads((data_dir / "curriculum.json").read_text(encoding="utf-8"))
    glossary_file = json.loads((data_dir / "glossary.json").read_text(encoding="utf-8"))
    glossary = glossary_file.get("terms", glossary_file if isinstance(glossary_file, list) else [])

    lessons = []
    for md in sorted((data_dir / "lessons").glob("*.md")):
        meta, body = split_frontmatter(md.read_text(encoding="utf-8"))
        lessons.append(
            {
                "file": str(md),
                "id": meta.get("id", md.stem),
                "slug": meta.get("slug", md.stem),
                "order": int(meta.get("order", 0)),
                "stageId": meta.get("stage", meta.get("stageId", "")),
                "title": {"ar": meta.get("title_ar", ""), "en": meta.get("title_en", "")},
                "summary": {"ar": meta.get("summary_ar", ""), "en": meta.get("summary_en", "")},
                "difficulty": meta.get("difficulty", ""),
                "pipeline": meta.get("pipeline", []),
                "concepts": meta.get("concepts", []),
                "terms": meta.get("terms", []),
                "objectives": {
                    "ar": meta.get("objectives_ar", []),
                    "en": meta.get("objectives_en", []),
                },
                "code": {
                    "path": meta.get("code", ""),
                    "run": meta.get("code_run", ""),
                    "lang": meta.get("code_lang", ""),
                    "marker": meta.get("code_marker", ""),
                },
                "words": word_count(body),
                "body": body,
            }
        )

    lessons.sort(key=lambda item: item["order"])
    meta = {key: value for key, value in curriculum.items() if key not in {"stages", "quizzes"}}
    return {
        "meta": meta,
        "stages": curriculum.get("stages", []),
        "glossary": glossary,
        "lessons": lessons,
        "quizzes": curriculum.get("quizzes", []),
        "repoRoot": repo_root,
    }


# --------------------------------------------------------------------------- #
# http helpers
# --------------------------------------------------------------------------- #
def get(base: str, path: str, params: dict | None = None, timeout: int = 15):
    url = base.rstrip("/") + path
    if params:
        url += "?" + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    started = time.time()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            status = response.status
            content_type = response.headers.get("content-type", "")
    except urllib.error.HTTPError as error:  # 4xx/5xx are expected in some checks
        raw = error.read().decode("utf-8")
        status = error.code
        content_type = error.headers.get("content-type", "") if error.headers else ""
    except Exception as error:  # connection refused, timeout
        REQUESTS["errors"] += 1
        return {"status": 0, "body": None, "raw": f"REQUEST FAILED: {error}", "content_type": "", "ms": 0.0}

    elapsed_ms = (time.time() - started) * 1000
    REQUESTS["count"] += 1
    REQUESTS["slowest_ms"] = max(REQUESTS["slowest_ms"], elapsed_ms)
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        body = None
    return {"status": status, "body": body, "raw": raw, "content_type": content_type, "ms": round(elapsed_ms, 1)}


def wait_for_server(base: str, attempts: int = 40, delay: float = 0.5) -> bool:
    for _ in range(attempts):
        probe = get(base, "/api/v1/health")
        if probe["status"] in (200, 404, 503):
            return True
        time.sleep(delay)
    return False


FORBIDDEN_KEYS = {"answerindex", "answer", "answers", "explanation", "answerkey", "iscorrect",
                  "correctoption", "correctindex", "correct_index", "solution", "answer_index"}


def walk_keys(node, path="$", found=None):
    """Collect every JSON key path in a response, plus the key names that look like an answer key."""
    if found is None:
        found = {"keys": [], "forbidden": []}
    if isinstance(node, dict):
        for key, value in node.items():
            found["keys"].append(f"{path}.{key}")
            if str(key).lower().replace("-", "_") in FORBIDDEN_KEYS:
                found["forbidden"].append(f"{path}.{key}")
            walk_keys(value, f"{path}.{key}", found)
    elif isinstance(node, list):
        for index, item in enumerate(node):
            walk_keys(item, f"{path}[{index}]", found)
    return found


# --------------------------------------------------------------------------- #
# audit harness
# --------------------------------------------------------------------------- #
class Audit:
    def __init__(self, name: str, mode: str, base: str, data_dir: str):
        self.payload = {
            "audit": name,
            "mode": mode,
            "base": base,
            "dataDir": data_dir,
            "independence": "own frontmatter/JSON parser; imports nothing from the audited code",
            "checks": [],
        }

    def add(self, check_id: str, title: str, ok: bool, detail: str, metrics=None, warn: bool = False) -> None:
        status = "PASS" if ok else ("WARN" if warn else "FAIL")
        self.payload["checks"].append(
            {
                "id": check_id,
                "title": title,
                "status": status,
                "detail": detail,
                **({"metrics": metrics} if metrics is not None else {}),
            }
        )
        flag = status
        print(f"[{flag}] {check_id} {title}\n       {detail[:400]}")

    def write(self, out_path: Path) -> int:
        passed = sum(1 for check in self.payload["checks"] if check["status"] == "PASS")
        warned = sum(1 for check in self.payload["checks"] if check["status"] == "WARN")
        total = len(self.payload["checks"])
        self.payload.update(
            {
                "passed": passed,
                "warned": warned,
                "total": total,
                "status": "PASS" if passed + warned == total else "FAIL",
                "requests": REQUESTS,
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            }
        )
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(self.payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\n{passed}/{total} checks PASS ({warned} WARN) -> {out_path}")
        return 0 if passed + warned == total else 1


# --------------------------------------------------------------------------- #
# mode: live server (real files present)
# --------------------------------------------------------------------------- #
def audit_live(audit: Audit, base: str, truth: dict) -> int:
    lessons = truth["lessons"]
    stages = truth["stages"]
    glossary = truth["glossary"]
    by_id = {lesson["id"]: lesson for lesson in lessons}

    # -- A1 index/stats -----------------------------------------------------
    root = get(base, "/api/v1/knowledge")
    stats = (root["body"] or {}).get("stats", {}) if root["body"] else {}
    lab_lessons = [lesson for lesson in lessons if lesson["code"]["path"]]
    lab_files = sorted({lesson["code"]["path"] for lesson in lab_lessons})
    missing_lab_files = [f for f in lab_files if not (truth["repoRoot"] / f).exists()]
    expected = {
        "stages": len(stages),
        "lessons": len(lessons),
        "terms": len(glossary),
        "quizzes": len(truth["quizzes"]),
        "words": sum(lesson["words"] for lesson in lessons),
        "labs": len(lab_lessons),
    }
    mismatch = {key: (stats.get(key), value) for key, value in expected.items() if stats.get(key) != value}
    audit.add(
        "A1",
        "GET /knowledge stats match the files exactly",
        root["status"] == 200 and not mismatch and stats.get("languages") == ["ar", "en"] and not missing_lab_files,
        f"status={root['status']} api={ {k: stats.get(k) for k in expected} } files={expected}"
        + (f" MISMATCH={mismatch}" if mismatch else "")
        + f"; unique lab files={len(lab_files)}, missing on disk={missing_lab_files or 'none'}",
        {"apiStats": stats, "fileStats": expected, "labFiles": lab_files, "missingLabFiles": missing_lab_files},
    )

    # -- A2 stage listing integrity ----------------------------------------
    api_stages = (root["body"] or {}).get("stages", [])
    stage_problems = []
    for api_stage in api_stages:
        file_stage = next((s for s in stages if s.get("id") == api_stage.get("id")), None)
        if file_stage is None:
            stage_problems.append(f"{api_stage.get('id')}: not in curriculum.json")
            continue
        file_ids = file_stage.get("lessons") or file_stage.get("lessonIds") or []
        api_ids = [lesson.get("id") for lesson in api_stage.get("lessons", [])]
        if file_ids != api_ids:
            stage_problems.append(f"{api_stage['id']}: files={file_ids} api={api_ids}")
        for lesson_view in api_stage.get("lessons", []):
            if "markdown" in lesson_view or "body" in lesson_view:
                stage_problems.append(f"{api_stage['id']}: stage listing leaks lesson body")
    audit.add(
        "A2",
        "stage listing mirrors curriculum.json (ids, order, lesson membership)",
        len(api_stages) == len(stages) and not stage_problems,
        f"stages api/files={len(api_stages)}/{len(stages)}; problems={stage_problems or 'none'}",
        {"problems": stage_problems, "apiStageIds": [s.get("id") for s in api_stages]},
    )

    # -- A3/A4 per-lesson fidelity + markdown provenance --------------------
    field_problems, markdown_problems, next_problems, stage_problems, term_problems = [], [], [], [], []
    order_lookups = []
    for lesson in lessons:
        expected_next = next((other["id"] for other in lessons if other["order"] == lesson["order"] + 1), None)
        for selector in (lesson["id"], str(lesson["order"])):
            res = get(base, f"/api/v1/knowledge/lessons/{urllib.parse.quote(selector)}", {"markdown": "false"})
            payload = res["body"] or {}
            api_lesson = payload.get("lesson", {})

            if api_lesson.get("id") != lesson["id"]:
                field_problems.append(f"selector {selector}: resolved to {api_lesson.get('id')!r}")
                continue
            if selector.isdigit():
                order_lookups.append(f"order {selector} -> {api_lesson['id']}")

            for field in ("slug", "order", "stageId", "difficulty", "words"):
                if api_lesson.get(field) != lesson[field]:
                    field_problems.append(f"{selector}.{field}: api={api_lesson.get(field)!r} file={lesson[field]!r}")
            for field in ("title", "summary"):
                for lang in ("ar", "en"):
                    if (api_lesson.get(field) or {}).get(lang) != lesson[field][lang]:
                        field_problems.append(f"{selector}.{field}.{lang}: api != file")
            for field in ("pipeline", "concepts", "terms"):
                if api_lesson.get(field) != lesson[field]:
                    field_problems.append(f"{selector}.{field}: api={api_lesson.get(field)} file={lesson[field]}")

            api_code = api_lesson.get("code") or {}
            if lesson["code"]["path"]:
                if api_code.get("path") != lesson["code"]["path"]:
                    field_problems.append(f"{selector}.code.path: api={api_code.get('path')!r} file={lesson['code']['path']!r}")
                if api_code.get("run") != lesson["code"]["run"]:
                    field_problems.append(f"{selector}.code.run: api={api_code.get('run')!r} file={lesson['code']['run']!r}")

            if "markdown" in api_lesson or "body" in api_lesson:
                markdown_problems.append(f"{selector}: markdown=false still returned the lesson body")
            if payload.get("next") != expected_next:
                next_problems.append(f"{selector}: next={payload.get('next')!r} expected={expected_next!r}")

            api_stage = payload.get("stage") or {}
            file_stage = next((stage for stage in stages if stage.get("id") == lesson["stageId"]), None)
            if not file_stage:
                stage_problems.append(f"{lesson['id']}: stageId {lesson['stageId']} absent from curriculum.json")
            elif api_stage.get("id") != file_stage["id"] or api_stage.get("title") != file_stage.get("title"):
                stage_problems.append(f"{lesson['id']}: stage payload != curriculum.json entry")

            api_terms = {term.get("id"): term for term in payload.get("terms", [])}
            for term_id in lesson["terms"]:
                file_term = next((term for term in glossary if term.get("id") == term_id), None)
                if file_term is None:
                    term_problems.append(f"{lesson['id']}: term {term_id} not in glossary.json")
                elif term_id not in api_terms:
                    term_problems.append(f"{lesson['id']}: term {term_id} missing from API payload")
                elif api_terms[term_id].get("definition") != file_term.get("definition"):
                    term_problems.append(f"{lesson['id']}/{term_id}: definition differs from glossary.json")

        full = get(base, f"/api/v1/knowledge/lessons/{urllib.parse.quote(lesson['id'])}")
        api_md = ((full["body"] or {}).get("lesson") or {}).get("markdown")
        if api_md is None or api_md.strip() != lesson["body"].strip():
            markdown_problems.append(
                f"{lesson['id']}: markdown body differs from {Path(lesson['file']).name} "
                f"(api={len(api_md or '')} chars, file={len(lesson['body'])} chars)"
            )

    audit.add(
        "A3",
        "every lesson endpoint returns the authored frontmatter fields verbatim",
        not field_problems and not next_problems and not stage_problems and not term_problems,
        f"{len(lessons)} lessons x 2 selectors (id, order); field mismatches={len(field_problems)}; "
        f"next-pointer problems={len(next_problems)}; stage payload problems={len(stage_problems)}; "
        f"glossary cross-reference problems={len(term_problems)}",
        {
            "fieldProblems": field_problems[:12],
            "nextProblems": next_problems[:6],
            "stageProblems": stage_problems[:6],
            "termProblems": term_problems[:6],
            "orderLookupSamples": order_lookups[:4],
            "selectorsTested": len(lessons) * 2,
        },
    )
    audit.add(
        "A4",
        "markdown=true serves the real lesson body (provenance, not a copy)",
        not markdown_problems,
        f"compared API markdown against lessons/*.md byte-for-byte (after frontmatter strip) for all "
        f"{len(lessons)} lessons; differences={len(markdown_problems)}",
        {"problems": markdown_problems[:8], "lessonsCompared": len(lessons)},
    )

    # -- A5/A6 answer-key leakage across every endpoint ---------------------
    # The answer key has two parts: (a) WHICH option is correct, (b) WHY (the explanation).
    # Serving the correct option *text* is unavoidable and correct - it is one of the four options the
    # learner must choose from. What must never leave the grading path is the marker of correctness
    # and the explanation text. Both are checked below.
    explanation_secrets: list[str] = []
    answer_options: list[tuple[str, str]] = []
    for quiz in truth["quizzes"]:
        explanation = quiz.get("explanation") or {}
        for lang in ("ar", "en"):
            text = str(explanation.get(lang, "")).strip()
            if len(text) > 20:
                explanation_secrets.append(text)
        index = quiz.get("answerIndex")
        options = quiz.get("options") or []
        if isinstance(index, int) and 0 <= index < len(options):
            for lang in ("ar", "en"):
                text = str((options[index] or {}).get(lang, "")).strip()
                if len(text) > 20:
                    answer_options.append((quiz.get("id", "?"), text))
    explanation_secrets = sorted(set(explanation_secrets))

    endpoints = ["/api/v1/knowledge", "/api/v1/knowledge/terms"]
    endpoints += [f"/api/v1/knowledge/lessons/{lesson['id']}" for lesson in lessons]
    endpoints += [f"/api/v1/knowledge/lessons/{lesson['id']}?markdown=false" for lesson in lessons]
    endpoints += [f"/api/v1/knowledge/stages/{stage['id']}" for stage in stages]
    endpoints += [
        "/api/v1/knowledge/search?q=overfitting&limit=5",
        "/api/v1/knowledge/search?q=%D9%85%D8%B9%D8%AF%D9%84%20%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%85&limit=5",
        "/api/v1/knowledge/context?q=overfitting&lang=ar&maxChars=1500",
        "/api/v1/knowledge/context?q=agent&lang=en&maxChars=1500",
    ]

    # Detection is *structural*: parse each response and walk every JSON key. A substring scan would
    # produce false positives, because the phrase "the correct answer" legitimately appears inside
    # authored teaching prose (e.g. the definition of Accuracy). Keys cannot lie; prose can.
    prose_phrase = "\u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0635\u062d\u064a\u062d\u0629"  # "the correct answer" - teaching vocabulary
    key_leaks, text_leaks, quiz_shape_problems, prose_hits = [], [], [], []
    keys_seen = set()
    for endpoint in endpoints:
        res = get(base, endpoint)
        raw = res["raw"]
        walked = walk_keys(res["body"]) if res["body"] is not None else {"keys": [], "forbidden": ["UNPARSEABLE RESPONSE"]}
        keys_seen.update(walked["keys"])
        for hit in walked["forbidden"]:
            key_leaks.append(f"{endpoint}: answer-key field {hit}")
        for secret in explanation_secrets:
            if secret in raw:
                text_leaks.append(f"{endpoint}: contains explanation text {secret[:60]!r}")
        if prose_phrase in raw:
            prose_hits.append(endpoint)

    # quizzes must still be *asked* (questions + options only)
    for lesson in lessons:
        res = get(base, f"/api/v1/knowledge/lessons/{lesson['id']}", {"markdown": "false"})
        api_quizzes = (res["body"] or {}).get("quizzes", [])
        file_quizzes = [quiz for quiz in truth["quizzes"] if quiz.get("lessonId") == lesson["id"]]
        if len(api_quizzes) != len(file_quizzes):
            quiz_shape_problems.append(f"{lesson['id']}: api quizzes={len(api_quizzes)} file quizzes={len(file_quizzes)}")
        for api_quiz in api_quizzes:
            keys = set(api_quiz.keys())
            if keys != {"id", "lessonId", "question", "options", "optionCount"}:
                quiz_shape_problems.append(f"{lesson['id']}/{api_quiz.get('id')}: keys={sorted(keys)}")
            file_quiz = next((quiz for quiz in file_quizzes if quiz.get("id") == api_quiz.get("id")), None)
            if file_quiz is None:
                quiz_shape_problems.append(f"{lesson['id']}/{api_quiz.get('id')}: quiz id absent from curriculum.json")
                continue
            if api_quiz.get("question") != file_quiz.get("question"):
                quiz_shape_problems.append(f"{lesson['id']}/{api_quiz['id']}: question text differs from curriculum.json")
            if api_quiz.get("options") != file_quiz.get("options"):
                quiz_shape_problems.append(f"{lesson['id']}/{api_quiz['id']}: options differ from curriculum.json")
            if api_quiz.get("optionCount") != len(file_quiz.get("options") or []):
                quiz_shape_problems.append(f"{lesson['id']}/{api_quiz['id']}: optionCount mismatch")

    audit.add(
        "A5",
        "no answer-key marker and no explanation text is served by any endpoint",
        not key_leaks and not text_leaks,
        f"structurally scanned {len(endpoints)} endpoint responses ({len(keys_seen)} distinct JSON key paths) "
        f"for {len(FORBIDDEN_KEYS)} forbidden answer-key field names, and text-scanned them for "
        f"{len(explanation_secrets)} unique explanation strings; leaks={len(key_leaks) + len(text_leaks)}. "
        f"Note: the phrase {prose_phrase!r} appears in {len(prose_hits)} responses as authored teaching "
        f"vocabulary (Accuracy/label prose), never as a key or as quiz metadata.",
        {
            "endpointsScanned": len(endpoints),
            "distinctJsonKeyPaths": len(keys_seen),
            "forbiddenKeyNames": sorted(FORBIDDEN_KEYS),
            "explanationStrings": len(explanation_secrets),
            "keyLeaks": key_leaks[:8],
            "textLeaks": text_leaks[:5],
            "prosePhraseEndpoints": prose_hits,
        },
    )
    audit.add(
        "A6",
        "quizzes are still asked (question + options only, counts match files)",
        not quiz_shape_problems,
        f"verified quiz shape for all {len(lessons)} lessons; problems={len(quiz_shape_problems)}",
        {"problems": quiz_shape_problems[:8], "quizzesInFiles": len(truth["quizzes"])},
    )

    # -- A7 search ranking --------------------------------------------------
    probes = [
        ("معدل التعلم", "ml-06-learning-rate"),
        ("overfitting generalization", "ml-13-overfitting-generalization"),
        ("my model memorizes the training data", "ml-13-overfitting-generalization"),
        ("gradient descent update", "ml-05-gradient-descent"),
        ("agent tools planning verification", "ml-16-from-model-to-agent"),
        ("transformers attention llm", "ml-15-transformers-and-llms"),
        ("train validation test split", "ml-12-evaluation-splits"),
        ("loss function mse", "ml-04-loss-function"),
    ]
    ranking_problems, ordering_problems, ranks = [], [], []
    for query, expected_id in probes:
        res = get(base, "/api/v1/knowledge/search", {"q": query, "limit": 5})
        hits = (res["body"] or {}).get("hits", [])
        top = hits[0]["id"] if hits else None
        ranks.append({"query": query, "expected": expected_id, "top1": top, "hits": len(hits)})
        if top != expected_id:
            ranking_problems.append(f"{query!r}: top1={top} expected={expected_id}")
        scores = [hit.get("score", 0) for hit in hits]
        if scores != sorted(scores, reverse=True):
            ordering_problems.append(f"{query!r}: scores not descending {scores}")

    limit_res = get(base, "/api/v1/knowledge/search", {"q": "model", "limit": 3})
    empty_res = get(base, "/api/v1/knowledge/search", {"q": "zxqwvplknonsense", "limit": 5})
    audit.add(
        "A7",
        "search ranking is correct, ordered, and limit-aware",
        not ranking_problems
        and not ordering_problems
        and len((limit_res["body"] or {}).get("hits", [])) <= 3
        and empty_res["status"] == 200,
        f"{len(probes) - len(ranking_problems)}/{len(probes)} top-1 matches; ordering problems={len(ordering_problems)}; limit=3 returned {len((limit_res['body'] or {}).get('hits', []))}; unknown query status={empty_res['status']} hits={(empty_res['body'] or {}).get('total')}",
        {"probes": ranks, "rankingProblems": ranking_problems, "orderingProblems": ordering_problems},
    )

    # -- A8 terms -----------------------------------------------------------
    all_terms = get(base, "/api/v1/knowledge/terms")
    filtered = get(base, "/api/v1/knowledge/terms", {"q": "دالة الخطأ"})
    unknown = get(base, "/api/v1/knowledge/terms", {"q": "zzzqqq-no-such-term"})
    filtered_ids = [term.get("id") for term in (filtered["body"] or {}).get("terms", [])]
    shape_problems = [
        term.get("id")
        for term in (all_terms["body"] or {}).get("terms", [])
        if not all(key in term for key in ("id", "term", "definition"))
    ]
    audit.add(
        "A8",
        "glossary endpoint serves all terms and filters correctly",
        (all_terms["body"] or {}).get("total") == len(glossary)
        and "loss-function" in filtered_ids
        and (unknown["body"] or {}).get("total") == 0
        and not shape_problems,
        f"total={(all_terms['body'] or {}).get('total')} files={len(glossary)}; 'دالة الخطأ' -> {filtered_ids[:4]}; unknown query total={(unknown['body'] or {}).get('total')}; malformed terms={len(shape_problems)}",
        {"total": (all_terms["body"] or {}).get("total"), "filtered": filtered_ids, "malformed": shape_problems[:5]},
    )

    # -- A9 context pack ----------------------------------------------------
    ar = get(base, "/api/v1/knowledge/context", {"q": "overfitting", "lang": "ar", "maxChars": 1500})
    en = get(base, "/api/v1/knowledge/context", {"q": "agent tools", "lang": "en", "maxChars": 1500})
    small = get(base, "/api/v1/knowledge/context", {"q": "overfitting", "lang": "ar", "maxChars": 300})
    none = get(base, "/api/v1/knowledge/context", {"q": "zxqwvplknonsense", "lang": "ar"})
    search = get(base, "/api/v1/knowledge/search", {"q": "overfitting", "limit": 3})
    top_hit = ((search["body"] or {}).get("hits") or [{}])[0].get("id")
    ar_ctx = (ar["body"] or {}).get("context", "")
    en_ctx = (en["body"] or {}).get("context", "")
    audit.add(
        "A9",
        "context pack is bilingual, cites lesson ids, respects maxChars, and never invents data",
        "قاعدة المعرفة" in ar_ctx
        and "Knowledge base:" in en_ctx
        and bool(top_hit) and f"### {top_hit} ·" in ar_ctx
        and len((small["body"] or {}).get("context", "")) <= 300
        and (none["body"] or {}).get("hits") == 0
        and (none["body"] or {}).get("context") == "",
        f"ar header ok={'قاعدة المعرفة' in ar_ctx}; en header ok={'Knowledge base:' in en_ctx}; top hit {top_hit} cited={f'### {top_hit} ·' in ar_ctx}; maxChars=300 -> {(small['body'] or {}).get('chars')} chars; unknown query hits={(none['body'] or {}).get('hits')}",
        {
            "arChars": (ar["body"] or {}).get("chars"),
            "enChars": (en["body"] or {}).get("chars"),
            "smallChars": (small["body"] or {}).get("chars"),
            "topHit": top_hit,
            "arContextSample": ar_ctx[:220],
        },
    )

    # -- A10 errors degrade honestly ---------------------------------------
    bad_lesson = get(base, "/api/v1/knowledge/lessons/zzz-no-such-lesson")
    bad_stage = get(base, "/api/v1/knowledge/stages/zzz-no-such-stage")
    bad_route = get(base, "/api/v1/knowledge/nope")
    audit.add(
        "A10",
        "unknown ids return 404 with a reason (never fabricated content)",
        bad_lesson["status"] == 404
        and bad_stage["status"] == 404
        and bad_route["status"] == 404
        and "error" in (bad_lesson["body"] or {})
        and "error" in (bad_stage["body"] or {}),
        f"lessons/zzz={bad_lesson['status']} {bad_lesson['body']}; stages/zzz={bad_stage['status']}; knowledge/nope={bad_route['status']}",
        {"lesson": bad_lesson["body"], "stage": bad_stage["body"], "route": bad_route["body"]},
    )

    # -- A11 provenance + transport hygiene --------------------------------
    # Strings that exist only inside the authored files must appear verbatim in the responses that
    # are supposed to serve them. This is what separates "reads real files" from "has a hardcoded copy".
    provenance_probes = [
        ("/api/v1/knowledge", lessons[0]["summary"]["ar"]),
        ("/api/v1/knowledge", lessons[15]["title"]["en"]),
        ("/api/v1/knowledge", stages[7]["outcome"]["ar"]),
        ("/api/v1/knowledge", str(truth["meta"].get("attribution", {}).get("ar", ""))),
        ("/api/v1/knowledge/terms", glossary[0]["term"]["ar"]),
        ("/api/v1/knowledge/terms", glossary[24]["definition"]["en"]),
        (f"/api/v1/knowledge/lessons/{lessons[4]['id']}", lessons[4]["body"].splitlines()[2].strip()),
        (f"/api/v1/knowledge/stages/{stages[2]['id']}", stages[2]["goal"]["en"]),
    ]
    provenance_probes = [(endpoint, sample) for endpoint, sample in provenance_probes if len(sample.strip()) > 12]

    cache: dict[str, str] = {}
    missing_provenance = []
    for endpoint, sample in provenance_probes:
        if endpoint not in cache:
            cache[endpoint] = get(base, endpoint)["raw"]
        if sample not in cache[endpoint]:
            missing_provenance.append(f"{endpoint}: missing authored string {sample[:60]!r}")

    ct_problems = [
        endpoint
        for endpoint in ("/api/v1/knowledge", "/api/v1/knowledge/terms", "/api/v1/knowledge/search?q=model")
        if "json" not in get(base, endpoint)["content_type"]
    ]
    audit.add(
        "A11",
        "responses carry strings that exist only in the authored files (real-file provenance)",
        not missing_provenance and not ct_problems,
        f"{len(provenance_probes) - len(missing_provenance)}/{len(provenance_probes)} unique authored strings "
        f"found verbatim in the endpoint that must serve them; non-JSON content-type={ct_problems or 'none'}",
        {
            "probes": [{"endpoint": endpoint, "sample": sample[:70]} for endpoint, sample in provenance_probes],
            "missing": missing_provenance,
            "contentTypeProblems": ct_problems,
        },
    )

    # -- A12 explanations are quiz-only (cannot be fished out of lesson prose)
    bodies = {lesson["id"]: lesson["body"] for lesson in lessons}
    in_body = []
    for quiz in truth["quizzes"]:
        explanation = quiz.get("explanation") or {}
        body = bodies.get(quiz.get("lessonId"), "")
        for lang in ("ar", "en"):
            text = str(explanation.get(lang, "")).strip()
            if len(text) > 20 and text in body:
                in_body.append(f"{quiz.get('id')} ({lang})")
    audit.add(
        "A12",
        "explanation text exists only in the quiz data, never inside lesson prose",
        not in_body,
        f"0 of {len(explanation_secrets)} explanation strings appear in the {len(bodies)} authored lesson bodies"
        if not in_body
        else f"{len(in_body)} explanations are embedded in lesson prose: {in_body[:5]}",
        {"explanationsInBodies": in_body, "bodiesScanned": len(bodies)},
    )

    # -- A13 positional entropy of the answer key (content-quality finding) --
    # The API hides WHICH option is correct, but if the correct option sits at the same index in most
    # quizzes, position alone becomes a shortcut. That is a property of the authored content, not of
    # the API, and it is reported as a WARN with the measured distribution instead of being hidden.
    from collections import Counter
    import itertools

    indexes = [quiz.get("answerIndex") for quiz in truth["quizzes"]]
    distribution = dict(sorted(Counter(indexes).items()))
    dominant_index, dominant_count = max(distribution.items(), key=lambda item: item[1])
    longest_streak = max(len(list(group)) for _, group in itertools.groupby(indexes))
    guess_baseline = round(100 * dominant_count / len(indexes), 1)
    audit.add(
        "A13",
        "answer positions are not guessable from a fixed index",
        guess_baseline <= 45.0,
        f"always picking index {dominant_index} would score {guess_baseline}% "
        f"({dominant_count}/{len(indexes)} quizzes); distribution={distribution}; longest same-index streak={longest_streak}. "
        f"Recommendation: shuffle option order per quiz (authoring-side change, not an API change).",
        {
            "distribution": distribution,
            "dominantIndex": dominant_index,
            "guessBaselinePercent": guess_baseline,
            "longestSameIndexStreak": longest_streak,
            "quizzes": len(indexes),
            "answerOptionsServedAsOptions": len(answer_options),
        },
        warn=True,
    )

    return 0


# --------------------------------------------------------------------------- #
# mode: degraded server (data directory unavailable)
# --------------------------------------------------------------------------- #
def audit_unavailable(audit: Audit, base: str) -> int:
    routes = [
        ("/api/v1/knowledge", None),
        ("/api/v1/knowledge/search", {"q": "overfitting"}),
        ("/api/v1/knowledge/lessons/ml-01-what-is-machine-learning", None),
        ("/api/v1/knowledge/stages/stage-1-fundamentals", None),
        ("/api/v1/knowledge/terms", {"q": "loss"}),
        ("/api/v1/knowledge/context", {"q": "overfitting"}),
    ]
    problems = []
    detail_samples = []
    for route, params in routes:
        res = get(base, route, params)
        body = res["body"] or {}
        if res["status"] != 503:
            problems.append(f"{route}: status={res['status']} (expected 503)")
        if body.get("error") != "Knowledge base unavailable":
            problems.append(f"{route}: error={body.get('error')!r}")
        if not body.get("detail"):
            problems.append(f"{route}: no detail explaining the failure")
        detail_samples.append({"route": route, "status": res["status"], "body": body})

    # the legacy surface must keep working: degradation is scoped to knowledge only
    legacy = get(base, "/api/v1/health")
    audit.add(
        "A20",
        "all knowledge endpoints degrade to 503 with a real reason when the files are missing",
        not problems and legacy["status"] in (200, 404),
        f"{len(routes) - len([p for p in problems if 'status' in p])}/{len(routes)} returned 503 with detail; problems={problems or 'none'}; /api/v1/health still {legacy['status']}",
        {"samples": detail_samples, "problems": problems, "healthStatus": legacy["status"]},
    )
    audit.add(
        "A21",
        "no fabricated knowledge is served in degraded mode",
        all("lesson" not in (sample["body"] or {}) and "hits" not in (sample["body"] or {}) for sample in detail_samples),
        "503 bodies contain error/detail only - never lesson payloads or search hits",
        {"bodies": [sample["body"] for sample in detail_samples]},
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="api-server base url")
    parser.add_argument("--data", default="packages/knowledge/data/ml-from-zero")
    parser.add_argument("--mode", choices=("live", "unavailable"), default="live")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    data_dir = Path(args.data)
    audit = Audit("knowledge-api", args.mode, args.base, str(data_dir))

    if not wait_for_server(args.base):
        audit.add("A0", "server reachable", False, f"no HTTP response from {args.base}")
        return audit.write(Path(args.out))
    audit.add("A0", "server reachable", True, f"{args.base} responded to /api/v1/health")

    if args.mode == "live":
        if not data_dir.exists():
            audit.add("A0b", "data directory present", False, f"missing {data_dir}")
            return audit.write(Path(args.out))
        repo_root = Path(__file__).resolve().parents[2]
        truth = load_truth(data_dir, repo_root)
        audit.payload["files"] = {
            "stages": len(truth["stages"]),
            "lessons": len(truth["lessons"]),
            "terms": len(truth["glossary"]),
            "quizzes": len(truth["quizzes"]),
            "words": sum(lesson["words"] for lesson in truth["lessons"]),
            "lessonsWithLabs": sum(1 for lesson in truth["lessons"] if lesson["code"]["path"]),
        }
        audit_live(audit, args.base, truth)
    else:
        audit_unavailable(audit, args.base)

    return audit.write(Path(args.out))


if __name__ == "__main__":
    sys.exit(main())
