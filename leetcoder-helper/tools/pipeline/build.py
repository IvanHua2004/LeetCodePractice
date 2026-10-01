#!/usr/bin/env python3
"""Build content/problems.json from the curated solutions in solutions.py."""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

import chunk as chunker  # noqa: E402
import mutate  # noqa: E402
from checks import display_text, run_tests  # noqa: E402
from constants import CONTENT_VERSION, CURATED_FILE, DISTRACTOR_BUDGET, ROOT  # noqa: E402
from solutions import PROBLEMS  # noqa: E402


def build_one(problem: dict) -> dict:
    function, chunks = chunker.chunk_solution(problem["src"])
    signature = chunker.signature(function)

    rebuilt = chunker.assemble(signature, [(c.code, c.depth) for c in chunks])
    ok, reason = run_tests(rebuilt, problem["entry"], problem["tests"])
    if not ok:
        raise SystemExit(f"[{problem['slug']}] chunks do not reassemble: {reason}\n\n{rebuilt}")

    handwritten = problem.get("extra_distractors", [])
    budget = DISTRACTOR_BUDGET[problem["difficulty"]] - len(handwritten)
    generated = mutate.generate(chunks, max(0, budget), display_text)
    distractors = [{"id": f"x{i}", **d} for i, d in enumerate(handwritten + generated)]

    return {
        "slug": problem["slug"],
        "title": problem["title"],
        "difficulty": problem["difficulty"],
        "pattern": problem["pattern"],
        "topics": problem["topics"],
        "lists": problem["lists"],
        "statement": problem["statement"],
        "entry": problem["entry"],
        "signature": signature,
        "hint": problem["hint"],
        "invariant": problem["invariant"],
        "maxIndent": max(c.depth for c in chunks),
        "chunks": [
            {"id": f"c{i}", "order": i, "indent": c.depth, "code": c.code, "header": c.header}
            for i, c in enumerate(chunks)
        ],
        "distractors": distractors,
        "tests": [{"args": args, "expected": expected} for args, expected in problem["tests"]],
    }


def main() -> None:
    built = [build_one(problem) for problem in PROBLEMS]

    for one in built:
        kinds = ", ".join(d["kind"] for d in one["distractors"]) or "none"
        print(
            f"  {one['slug']:<52} {len(one['chunks'])} chunks  "
            f"depth {one['maxIndent']}  {kinds}"
        )

    CURATED_FILE.parent.mkdir(parents=True, exist_ok=True)
    CURATED_FILE.write_text(json.dumps({"version": CONTENT_VERSION, "problems": built}, indent=2) + "\n")
    print(f"\n{len(built)} problems written to {CURATED_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
