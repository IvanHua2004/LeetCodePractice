#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

import chunk as chunker
import mutate
from solutions import PROBLEMS

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "content" / "problems.json"
DISTRACTOR_BUDGET = {"Easy": 1, "Medium": 2, "Hard": 3}


def run_tests(source: str, entry: str, tests) -> tuple[bool, str]:
    namespace: dict = {}
    try:
        exec(compile(source, "<assembled>", "exec"), namespace)
    except Exception as error:
        return False, f"could not run: {error}"

    function = namespace.get(entry)
    if function is None:
        return False, f"no function named {entry}"

    for arguments, expected in tests:
        fresh = json.loads(json.dumps(arguments))
        try:
            produced = function(*fresh)
        except Exception as error:
            return False, f"{arguments!r} raised {error}"
        if produced != expected:
            return False, f"{arguments!r} gave {produced!r}, expected {expected!r}"
    return True, ""


def display_text(variant: str, chunk) -> str:
    return variant.splitlines()[0].rstrip() if chunk.header else variant


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

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"version": 1, "problems": built}, indent=2) + "\n")
    print(f"\n{len(built)} problems written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
