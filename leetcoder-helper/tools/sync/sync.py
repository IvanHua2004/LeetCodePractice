#!/usr/bin/env python3
"""Turn a LeetHub-style GitHub repo of your own solutions into Parsons problems.

One pass:
  1. clone or fast-forward the repo into .cache/sync/repo
  2. for every <id>-<slug>/ folder with a .py solution and a README.md:
       - read title, difficulty, statement and worked examples from the README
       - turn the examples into tests and run YOUR solution against them
       - convert the `class Solution` method into a plain function, chunk it,
         and check the reassembled chunks still pass
       - generate distractors and keep only ones that actually fail a test
  3. write content/synced.json (only if something changed) and, if the
     Postgres container is up, reseed the database

Anything that can't be checked automatically (trees, linked lists, design
classes, "return in any order" answers, SQL...) is skipped and reported, never
guessed at. Per-problem hints, topics or extra tests go in
content/synced-overrides.json.

Usage:  python tools/sync/sync.py [--force] [--repo URL] [--no-seed] [-v]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
import socket
import subprocess
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "pipeline")]

import chunk as chunker  # noqa: E402
import mutate  # noqa: E402
from checks import display_text, run_tests  # noqa: E402
from constants import CONTENT_VERSION, DISTRACTOR_BUDGET, ROOT  # noqa: E402
from convert import to_function  # noqa: E402
from leethub import Skip, leetcode_topics, parse_inputs, parse_readme, parse_value  # noqa: E402
from repo import fetch_repo  # noqa: E402
from sync_constants import (  # noqa: E402
    DEFAULT_REPO,
    EXCLUDED_MUTATIONS,
    FALLBACK_TOPIC,
    LIST_KEY,
    MAX_CHUNKS,
    MIN_CHUNKS,
    OVERRIDES_FILE,
    PROBLEM_FOLDER_PATTERN,
    REPO_DIR,
    REPO_ENV_VAR,
    SLUG_PREFIX,
    STATE_FILE,
    SYNC_VERSION,
    SYNCED_FILE,
    TOPICS_CACHE_FILE,
)

POSTGRES_ADDRESS = ("127.0.0.1", 5432)
SEED_COMMAND = "pnpm --filter api seed"


def log(message: str) -> None:
    print(f"[sync] {message}", flush=True)


def read_json(path: pathlib.Path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


# --- one problem ----------------------------------------------------------------------

def tests_from_examples(examples, params: list[str]) -> list[tuple[list, object]]:
    tests = []
    for raw_input, raw_output in examples:
        try:
            pairs = parse_inputs(raw_input)
            expected = parse_value(raw_output)
        except Skip:
            continue  # one unreadable example doesn't sink the others
        if len(pairs) != len(params):
            continue
        by_name = dict(pairs)
        if set(by_name) == set(params):
            args = [by_name[name] for name in params]
        else:
            args = [value for _, value in pairs]
        tests.append((args, expected))
    return tests


def pick_distractors(chunks, signature: str, entry: str, tests, budget: int) -> list[dict]:
    """Near-miss blocks, each verified to break at least one test when swapped in."""
    kept: list[dict] = []
    for candidate in mutate.generate(chunks, len(chunks) * 5, display_text):
        if len(kept) >= budget:
            break
        if candidate["kind"] in EXCLUDED_MUTATIONS:
            continue
        swapped = [
            (candidate["code"] if i == candidate["from_chunk"] else chunk.code, chunk.depth)
            for i, chunk in enumerate(chunks)
        ]
        still_passes, _ = run_tests(chunker.assemble(signature, swapped), entry, tests)
        if not still_passes:
            kept.append({"code": candidate["code"], "kind": candidate["kind"]})
    return kept


def build_problem(folder: pathlib.Path, topics_cache: dict, overrides: dict) -> dict:
    solutions = sorted(folder.glob("*.py"))
    if not solutions:
        other = sorted(path.suffix for path in folder.iterdir() if path.name != "README.md")
        raise Skip(f"no Python solution ({', '.join(other) or 'empty'})")
    readme_path = folder / "README.md"
    if not readme_path.exists():
        raise Skip("no README.md")

    slug = re.sub(PROBLEM_FOLDER_PATTERN, "", folder.name)
    extra = overrides.get(slug, {})
    if extra.get("skip"):
        raise Skip("skipped in synced-overrides.json")

    readme = parse_readme(readme_path.read_text(encoding="utf-8"))
    try:
        solution = to_function(solutions[0].read_text(encoding="utf-8"))
    except SyntaxError as error:
        raise Skip(f"solution doesn't parse: {error}") from None

    tests = tests_from_examples(readme.examples, solution.params)
    tests += [(test["args"], test["expected"]) for test in extra.get("tests", [])]
    if not tests:
        raise Skip("couldn't turn any README example into a test")

    passed, reason = run_tests(solution.source, solution.entry, tests)
    if not passed:
        raise Skip(f"your solution doesn't match the README examples: {reason}")

    function, chunks = chunker.chunk_solution(solution.source)
    if len(chunks) > MAX_CHUNKS:
        raise Skip(f"{len(chunks)} blocks is too many to drill (max {MAX_CHUNKS})")
    if len(chunks) < MIN_CHUNKS:
        raise Skip("too short to be worth reassembling")

    signature = chunker.signature(function)
    rebuilt = chunker.assemble(signature, [(chunk.code, chunk.depth) for chunk in chunks])
    passed, reason = run_tests(rebuilt, solution.entry, tests)
    if not passed:
        raise Skip(f"chunks don't reassemble: {reason}")

    budget = DISTRACTOR_BUDGET[readme.difficulty]
    distractors = pick_distractors(chunks, signature, solution.entry, tests, budget)

    topics = extra.get("topics") or leetcode_topics(slug, topics_cache) or [FALLBACK_TOPIC]
    default_pattern = "" if topics == [FALLBACK_TOPIC] else re.sub(r"[^a-z0-9]+", "-", topics[0].lower()).strip("-")
    statement = readme.statement
    if solution.in_place:
        statement += f" (Here the function returns {solution.params[0]} after modifying it.)"

    return {
        "slug": SLUG_PREFIX + slug,
        "title": readme.title,
        "difficulty": readme.difficulty,
        "pattern": extra.get("pattern", default_pattern),
        "topics": topics,
        "lists": [LIST_KEY],
        "statement": statement,
        "entry": solution.entry,
        "signature": signature,
        "hint": extra.get("hint", ""),
        "invariant": extra.get("invariant", ""),
        "maxIndent": max(chunk.depth for chunk in chunks),
        "chunks": [
            {"id": f"c{i}", "order": i, "indent": chunk.depth, "code": chunk.code, "header": chunk.header}
            for i, chunk in enumerate(chunks)
        ],
        "distractors": [{"id": f"x{i}", **d} for i, d in enumerate(distractors)],
        "tests": [{"args": args, "expected": expected} for args, expected in tests],
    }


# --- the whole repo -------------------------------------------------------------------

def build_all(topics_cache: dict, overrides: dict) -> tuple[list[dict], list[tuple[str, str]]]:
    built, skipped = [], []
    folders = sorted(p for p in REPO_DIR.iterdir() if p.is_dir() and re.match(PROBLEM_FOLDER_PATTERN, p.name))
    for folder in folders:
        try:
            built.append(build_problem(folder, topics_cache, overrides))
        except Skip as reason:
            skipped.append((folder.name, str(reason)))
        except Exception as error:  # one odd file must never kill the sync
            skipped.append((folder.name, f"unexpected {type(error).__name__}: {error}"))
    return built, skipped


def write_if_changed(problems: list[dict]) -> tuple[list[str], list[str], list[str]]:
    """Write SYNCED_FILE and return the (added, changed, removed) slugs."""
    before = {p["slug"]: p for p in read_json(SYNCED_FILE, {"problems": []})["problems"]}
    after = {p["slug"]: p for p in problems}

    content = json.dumps({"version": CONTENT_VERSION, "problems": problems}, indent=2, ensure_ascii=False) + "\n"
    if not SYNCED_FILE.exists() or SYNCED_FILE.read_text(encoding="utf-8") != content:
        SYNCED_FILE.parent.mkdir(parents=True, exist_ok=True)
        SYNCED_FILE.write_text(content, encoding="utf-8")

    added = sorted(after.keys() - before.keys())
    removed = sorted(before.keys() - after.keys())
    changed = sorted(slug for slug in after.keys() & before.keys() if after[slug] != before[slug])
    return added, changed, removed


def postgres_is_up() -> bool:
    try:
        with socket.create_connection(POSTGRES_ADDRESS, timeout=1):
            return True
    except OSError:
        return False


def report(repo: str, head: str, built, skipped, diff, seconds: float, verbose: bool) -> None:
    added, changed, removed = diff
    log(f"{repo} @ {head[:7]}: {len(built)} problems ready, {len(skipped)} skipped ({seconds:.1f}s)")
    for sign, slugs in (("+", added), ("~", changed), ("-", removed)):
        for slug in slugs:
            log(f"  {sign} {slug}")

    untopiced = sum(1 for p in built if p["topics"] == [FALLBACK_TOPIC])
    if untopiced:
        log(f"  {untopiced} without topics (LeetCode unreachable); will retry next pass")

    if verbose:
        for name, reason in skipped:
            log(f"  skip {name}: {reason}")
    else:
        log("  run with -v to see why problems were skipped")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", default=os.environ.get(REPO_ENV_VAR, DEFAULT_REPO))
    parser.add_argument("--force", action="store_true", help="rebuild even if nothing changed")
    parser.add_argument("--no-seed", action="store_true", help="don't reseed postgres afterwards")
    parser.add_argument("-v", "--verbose", action="store_true", help="list every skipped problem")
    options = parser.parse_args()

    started = time.time()
    try:
        head = fetch_repo(options.repo)
    except Exception as error:
        log(f"could not fetch {options.repo}: {error}")
        return 1

    overrides = read_json(OVERRIDES_FILE, {})
    state = read_json(STATE_FILE, {})
    fingerprint = {
        "head": head,
        "overrides": hashlib.sha1(json.dumps(overrides, sort_keys=True).encode()).hexdigest(),
        "version": SYNC_VERSION,
    }
    nothing_new = state.get("fingerprint") == fingerprint and SYNCED_FILE.exists()
    if nothing_new and not options.force and not state.get("missingTopics"):
        log(f"up to date ({head[:7]})")
        return 0

    topics_cache = read_json(TOPICS_CACHE_FILE, {})
    built, skipped = build_all(topics_cache, overrides)
    TOPICS_CACHE_FILE.write_text(json.dumps(topics_cache, indent=1, sort_keys=True))
    diff = write_if_changed(built)

    STATE_FILE.write_text(json.dumps({
        "fingerprint": fingerprint,
        "missingTopics": sum(1 for p in built if p["topics"] == [FALLBACK_TOPIC]),
        "syncedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "skipped": skipped,
    }, indent=1))

    report(options.repo, head, built, skipped, diff, time.time() - started, options.verbose)

    if any(diff) and not options.no_seed and postgres_is_up():
        log("postgres is up, reseeding")
        subprocess.run(SEED_COMMAND, shell=True, cwd=ROOT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
