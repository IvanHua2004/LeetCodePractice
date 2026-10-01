#!/usr/bin/env python3
import json
import pathlib
import sys

here = pathlib.Path(__file__).parent
cases = json.loads((here / "assembled.json").read_text())

failures = []
for case in cases:
    namespace = {}
    try:
        exec(compile(case["source"], case["slug"], "exec"), namespace)
    except Exception as error:
        failures.append((case["slug"], f"did not run: {error}"))
        continue

    function = namespace.get(case["entry"])
    if function is None:
        failures.append((case["slug"], "entry function missing"))
        continue

    for test in case["tests"]:
        arguments = json.loads(json.dumps(test["args"]))
        try:
            produced = function(*arguments)
        except Exception as error:
            failures.append((case["slug"], f"{test['args']!r} raised {error}"))
            break
        if produced != test["expected"]:
            failures.append(
                (case["slug"], f"{test['args']!r} gave {produced!r}, expected {test['expected']!r}")
            )
            break
    else:
        print(f"  ok  {case['slug']}")

if failures:
    print("\nfailures:")
    for slug, reason in failures:
        print(f"  {slug}: {reason}")
    sys.exit(1)

print(f"\nall {len(cases)} problems pass when assembled by the TypeScript code path")
