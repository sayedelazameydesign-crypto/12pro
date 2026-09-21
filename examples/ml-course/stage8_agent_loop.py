#!/usr/bin/env python3
"""
Stage 8 — From Model to Agent: plan, act, observe, verify, correct.

Lesson ref: ml-16-from-model-to-agent

An agent is not a smarter model; it is engineering *around* a model. This lab is
a miniature of the CeliaOS mission loop, with the four things that turn a
prediction into a system:

    tools      — act on the world instead of only talking about it
    policies   — some actions need approval, and there is a step/cost budget
    verification — every step is checked with an independent method
    correction — a failed check re-plans instead of pretending success

The mission is deliberately small so the loop is visible:

    "Compute the average price of houses larger than 120 m², verify the result
     independently, then write a report."

Watch what happens: the naive tool selector picks the wrong tool (sum instead of
mean), verification catches it, the agent corrects, a destructive tool call is
blocked pending approval, and the mission finishes with an auditable ledger.

Run:  python3 examples/ml-course/stage8_agent_loop.py
"""

from __future__ import annotations

import json
from typing import Any, Callable

# ---------------------------------------------------------------------------
# World: a tiny dataset the agent can act on
# ---------------------------------------------------------------------------

HOUSES = [
    {"id": "h1", "area_m2": 80, "rooms": 2, "price": 900_000},
    {"id": "h2", "area_m2": 100, "rooms": 2, "price": 1_150_000},
    {"id": "h3", "area_m2": 120, "rooms": 3, "price": 1_400_000},
    {"id": "h4", "area_m2": 140, "rooms": 3, "price": 1_700_000},
    {"id": "h5", "area_m2": 160, "rooms": 4, "price": 2_000_000},
    {"id": "h6", "area_m2": 200, "rooms": 5, "price": 2_600_000},
]

MISSION = (
    "احسب متوسط سعر البيوت التي مساحتها أكبر من 120 مترًا، "
    "ثم تحقق من النتيجة بطريقة مستقلة، واكتب تقريرًا."
)

POLICY = {
    "max_steps": 12,
    "max_corrections_per_step": 2,
    "max_cost": 0.0,          # zero-cost policy: local tools only (ADR-0005)
    "approval_required": ["filesystem.delete", "network.post"],
}


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

class ToolError(Exception):
    pass


COMPARISONS: dict[str, Callable[[Any, Any], bool]] = {
    ">": lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<": lambda a, b: a < b,
    "==": lambda a, b: a == b,
}


def tool_dataset_filter(args: dict[str, Any]) -> list[dict[str, Any]]:
    field, op, value = args["field"], args["op"], args["value"]
    if op not in COMPARISONS:
        raise ToolError(f"unsupported operator {op}")
    if any(field not in row for row in HOUSES):
        raise ToolError(f"unknown field {field}")
    compare = COMPARISONS[op]
    return [row for row in HOUSES if compare(row[field], value)]


def tool_math_sum(args: dict[str, Any]) -> float:
    return float(sum(args["values"]))


def tool_math_mean(args: dict[str, Any]) -> float:
    values = args["values"]
    if not values:
        raise ToolError("mean of an empty list is undefined")
    return float(sum(values) / len(values))


def tool_report_write(args: dict[str, Any]) -> str:
    title, facts = args["title"], args["facts"]
    body = "\n".join(f"- {key}: {value}" for key, value in facts.items())
    return f"artifact://report/{title}\n{body}"


def tool_filesystem_delete(args: dict[str, Any]) -> str:
    # Never reached in this run: policy blocks it pending human approval.
    raise ToolError(f"refused to delete {args.get('path')}")


TOOLS: dict[str, dict[str, Any]] = {
    "dataset.filter": {
        "handler": tool_dataset_filter,
        "keywords": ["بيوت", "فلتر", "تصفية", "houses", "filter", "مسطح", "مساحة"],
        "description": "Filter the house dataset by a field comparison.",
    },
    "math.sum": {
        "handler": tool_math_sum,
        "keywords": ["احسب", "مجموع", "sum", "total"],
        "description": "Sum a list of numbers.",
    },
    "math.mean": {
        # NOTE: "متوسط" is deliberately missing from the selector vocabulary below.
        # Incomplete tool descriptions are a real agent failure mode: the selector
        # cannot see the synonym, so sum and mean tie — and verification saves us.
        "handler": tool_math_mean,
        "keywords": ["احسب", "average", "mean"],
        "description": "Average a list of numbers.",
    },
    "report.write": {
        "handler": tool_report_write,
        "keywords": ["تقرير", "اكتب", "report", "write", "artifact"],
        "description": "Write a small report artifact.",
    },
    "filesystem.delete": {
        "handler": tool_filesystem_delete,
        "keywords": ["احذف", "delete"],
        "description": "Delete a path — requires human approval.",
    },
}


# ---------------------------------------------------------------------------
# Planning: a model would produce this; here a deterministic policy does
# ---------------------------------------------------------------------------

PLAN = [
    {"id": "step_1", "task": "صفِّ البيوت التي مساحتها أكبر من 120", "expect": "dataset.filter"},
    {"id": "step_2", "task": "احسب متوسط الأسعار للمجموعة المصفاة", "expect": "math.mean"},
    {"id": "step_3", "task": "اكتب تقريرًا بالنتيجة والأدلة", "expect": "report.write"},
    {"id": "step_4", "task": "احذف الملفات المؤقتة", "expect": "filesystem.delete"},
]


def select_tool(task: str) -> list[str]:
    """Naive keyword selector — the agent's first guess, ranked.

    Deliberately imperfect: `math.sum` shares the keyword "احسب" with `math.mean`
    and can win the ranking. That is why verification exists.
    """
    scored = []
    for order, (name, tool) in enumerate(TOOLS.items()):
        score = sum(1 for keyword in tool["keywords"] if keyword in task)
        if score > 0:
            scored.append((-score, order, name))
    scored.sort()
    return [name for _, _, name in scored]


# ---------------------------------------------------------------------------
# Verification: independent checks, not the model's own opinion
# ---------------------------------------------------------------------------

def verify_step(step_id: str, tool_name: str, args: dict[str, Any], result: Any) -> tuple[bool, str]:
    if step_id == "step_1":
        if not isinstance(result, list) or not result:
            return False, "empty filter result"
        bad = [row["id"] for row in result if row["area_m2"] <= args["value"]]
        if bad:
            return False, f"rows violating the predicate: {bad}"
        return True, f"{len(result)} rows, all satisfy area_m2 > {args['value']}"

    if step_id == "step_2":
        values = args["values"]
        if not (min(values) <= result <= max(values)):
            return False, f"average {result} outside [{min(values)}, {max(values)}] — impossible"
        independent = sum(values) / len(values)
        if abs(independent - result) > 1e-6:
            return False, f"independent recomputation {independent} != {result}"
        return True, f"within bounds and matches independent recomputation {independent:,.0f}"

    if step_id == "step_3":
        text = str(result)
        if not text.startswith("artifact://"):
            return False, "not an artifact reference"
        if str(args["facts"].get("average_price")) not in text:
            return False, "artifact does not contain the verified number"
        return True, "artifact written and contains the verified number"

    return False, f"no verification rule for {step_id}"


def oracle_answer() -> float:
    """Ground truth computed by a completely separate path."""
    prices = [house["price"] for house in HOUSES if house["area_m2"] > 120]
    return sum(prices) / len(prices)


# ---------------------------------------------------------------------------
# The loop
# ---------------------------------------------------------------------------

class Agent:
    def __init__(self, policy: dict[str, Any]):
        self.policy = policy
        self.ledger: list[dict[str, Any]] = []
        self.state: dict[str, Any] = {}
        self.steps_used = 0
        self.corrections = 0
        self.blocked = 0
        self.cost = 0.0
        self.seq = 0

    def record(self, **entry: Any) -> None:
        self.seq += 1
        self.ledger.append({"seq": self.seq, **entry})

    def run(self, mission: str) -> dict[str, Any]:
        self.record(phase="mission.started", mission=mission, policy=self.policy)

        for step in PLAN:
            if self.steps_used >= self.policy["max_steps"]:
                self.record(phase="mission.aborted", reason="step budget exhausted")
                return self.finish(success=False, reason="step budget exhausted")

            candidates = select_tool(step["task"])
            self.record(
                phase="plan.step",
                step=step["id"],
                task=step["task"],
                tool_candidates=candidates,
            )

            attempt = 0
            step_done = False
            deferred = False
            while attempt <= self.policy["max_corrections_per_step"] and not step_done:
                tool_name = candidates[attempt] if attempt < len(candidates) else None
                if tool_name is None:
                    self.record(phase="step.failed", step=step["id"], reason="no tool candidate left")
                    break

                # ---- policy gate (governance) ----
                if tool_name in self.policy["approval_required"]:
                    self.blocked += 1
                    self.record(
                        phase="approval.required",
                        step=step["id"],
                        tool=tool_name,
                        decision="blocked",
                        reason="destructive action requires human approval",
                    )
                    self.steps_used += 1
                    deferred = True
                    break

                args = self.build_args(step["id"], tool_name)
                self.steps_used += 1

                # ---- act (sandboxed: exceptions become observations) ----
                try:
                    result = TOOLS[tool_name]["handler"](args)
                    observation_error = None
                except ToolError as exc:
                    result = None
                    observation_error = str(exc)

                self.record(
                    phase="act",
                    step=step["id"],
                    tool=tool_name,
                    args=self.summarize_args(args),
                    status="error" if observation_error else "ok",
                    error=observation_error,
                )

                if observation_error is not None:
                    attempt += 1
                    self.corrections += 1
                    continue

                # ---- observe + verify ----
                ok, note = verify_step(step["id"], tool_name, args, result)
                self.record(
                    phase="verify",
                    step=step["id"],
                    tool=tool_name,
                    passed=ok,
                    evidence=note,
                )

                if not ok:
                    attempt += 1
                    self.corrections += 1
                    self.record(
                        phase="correct",
                        step=step["id"],
                        attempt=attempt,
                        next_tool=candidates[attempt] if attempt < len(candidates) else None,
                        reason=note,
                    )
                    continue

                self.state[step["id"]] = result
                step_done = True

            if not step_done and not deferred:
                return self.finish(success=False, reason=f"{step['id']} never passed verification")

        # ---- mission-level verification against an independent oracle ----
        computed = self.state.get("step_2")
        expected = oracle_answer()
        matches = computed is not None and abs(computed - expected) < 1e-6
        self.record(
            phase="mission.verify",
            computed=computed,
            oracle=expected,
            passed=matches,
        )
        return self.finish(success=matches, reason=None if matches else "oracle mismatch")

    def build_args(self, step_id: str, tool_name: str) -> dict[str, Any]:
        if step_id == "step_1":
            return {"field": "area_m2", "op": ">", "value": 120}
        if step_id == "step_2":
            prices = [row["price"] for row in self.state["step_1"]]
            return {"values": prices}
        if step_id == "step_3":
            return {
                "title": "avg-price-over-120m2",
                "facts": {
                    "mission": MISSION,
                    "houses_matched": len(self.state["step_1"]),
                    "average_price": self.state["step_2"],
                    "verified_by": "independent recomputation + oracle",
                },
            }
        if step_id == "step_4":
            return {"path": "/tmp/mission-cache"}
        raise ToolError(f"no argument builder for {step_id}")

    @staticmethod
    def summarize_args(args: dict[str, Any]) -> dict[str, Any]:
        summary = {}
        for key, value in args.items():
            if isinstance(value, list) and len(value) > 4:
                summary[key] = f"list[{len(value)}]"
            else:
                summary[key] = value
        return summary

    def finish(self, success: bool, reason: str | None) -> dict[str, Any]:
        self.record(
            phase="mission.finished",
            status="completed" if success else "failed",
            reason=reason,
            steps_used=self.steps_used,
            corrections=self.corrections,
            blocked_actions=self.blocked,
            cost=self.cost,
        )
        return {
            "success": success,
            "reason": reason,
            "answer": self.state.get("step_2"),
            "oracle": oracle_answer(),
            "artifact": self.state.get("step_3"),
            "steps_used": self.steps_used,
            "corrections": self.corrections,
            "blocked_actions": self.blocked,
            "cost": self.cost,
            "ledger": self.ledger,
        }


def main() -> int:
    print("Stage 8 — Agent loop: plan → select tool → act → observe → verify → correct")
    print("=" * 76)
    print(f"Mission: {MISSION}")
    print(f"Policy:  max_steps={POLICY['max_steps']} "
          f"max_corrections={POLICY['max_corrections_per_step']} "
          f"approval_required={POLICY['approval_required']} max_cost={POLICY['max_cost']}\n")

    agent = Agent(POLICY)
    outcome = agent.run(MISSION)

    for entry in outcome["ledger"]:
        phase = entry["phase"]
        detail = {k: v for k, v in entry.items() if k not in ("seq", "phase")}
        print(f"  [{entry['seq']:>2}] {phase:<18} {json.dumps(detail, ensure_ascii=False, default=str)[:150]}")

    answer = outcome["answer"]
    print(f"\nAnswer:   {answer:,.0f} EGP" if answer is not None else "\nAnswer:   <none — mission failed>")
    print(f"Oracle:   {outcome['oracle']:,.0f} EGP")
    print(f"Artifact: {str(outcome['artifact']).splitlines()[0] if outcome['artifact'] else None}")
    print(f"Steps used: {outcome['steps_used']}  corrections: {outcome['corrections']}  "
          f"blocked: {outcome['blocked_actions']}  cost: ${outcome['cost']:.2f}")

    print("\nWhat made this an *agent* and not a model call:")
    print("  1. the wrong tool was chosen first, and verification caught it")
    print("  2. the agent corrected itself instead of reporting success")
    print("  3. a destructive action was blocked by policy pending approval")
    print("  4. the final answer was checked against an independent oracle")
    print("  5. every step left an auditable ledger entry (evidence, not claims)")

    phases = [entry["phase"] for entry in outcome["ledger"]]
    assert outcome["success"], f"mission must complete, got: {outcome['reason']}"
    assert answer is not None and abs(answer - outcome["oracle"]) < 1e-6, "answer must match the oracle"
    assert outcome["corrections"] >= 1, "the loop must demonstrate at least one self-correction"
    assert outcome["blocked_actions"] >= 1, "policy must block the destructive action"
    assert "verify" in " ".join(phases), "verification must appear in the ledger"
    assert outcome["cost"] <= POLICY["max_cost"], "zero-cost policy must hold"
    assert outcome["steps_used"] <= POLICY["max_steps"], "step budget must hold"

    print("\nRESULT " + json.dumps({
        "stage": 8,
        "name": "agent_loop",
        "status": "PASS",
        "answer": outcome["answer"],
        "oracle": outcome["oracle"],
        "steps_used": outcome["steps_used"],
        "corrections": outcome["corrections"],
        "blocked_actions": outcome["blocked_actions"],
        "cost": outcome["cost"],
        "ledger_entries": len(outcome["ledger"]),
        "phases": sorted(set(phases)),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
