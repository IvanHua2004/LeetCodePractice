"""Running a candidate solution against its tests, the same way the browser does."""
from __future__ import annotations

import contextlib
import io
import json
import sys

from constants import STEP_LIMIT


class _RanTooLong(Exception):
    pass


def _json_round_trip(value):
    return json.loads(json.dumps(value))


def _step_guard():
    steps = 0

    def guard(frame, event, arg):
        nonlocal steps
        steps += 1
        if steps > STEP_LIMIT:
            raise _RanTooLong()
        return guard

    return guard


def run_tests(source: str, entry: str, tests) -> tuple[bool, str]:
    """Return (passed, reason). `tests` is a list of (args, expected) pairs."""
    namespace: dict = {}
    try:
        exec(compile(source, "<solution>", "exec"), namespace)
    except Exception as error:
        return False, f"could not run: {error}"

    function = namespace.get(entry)
    if function is None:
        return False, f"no function named {entry}"

    for arguments, expected in tests:
        sys.settrace(_step_guard())
        try:
            # solutions sometimes print while debugging; keep that out of the log
            with contextlib.redirect_stdout(io.StringIO()):
                produced = function(*_json_round_trip(arguments))
        except _RanTooLong:
            return False, f"{arguments!r} ran too long"
        except RecursionError:
            return False, f"{arguments!r} recursed too deep"
        except Exception as error:
            return False, f"{arguments!r} raised {type(error).__name__}: {error}"
        finally:
            sys.settrace(None)

        try:
            produced = _json_round_trip(produced)
        except (TypeError, ValueError):
            return False, f"{arguments!r} returned {produced!r}, which isn't JSON"
        if produced != expected:
            return False, f"{arguments!r} gave {produced!r}, expected {expected!r}"

    return True, ""


def display_text(variant: str, chunk) -> str:
    """How a mutated block is shown: header blocks show only their first line."""
    if not chunk.header:
        return variant
    line = variant.splitlines()[0].rstrip()
    if chunk.code.startswith("elif ") and line.startswith("if "):
        return "el" + line
    return line
