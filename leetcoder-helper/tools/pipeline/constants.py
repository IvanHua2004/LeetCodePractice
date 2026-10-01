"""Every tuning knob for the content pipeline, in one place.

Shared by build.py (the curated set) and tools/sync (your GitHub solutions).
"""
from __future__ import annotations

import ast
import pathlib

# --- paths -------------------------------------------------------------------

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONTENT_DIR = ROOT / "content"
CURATED_FILE = CONTENT_DIR / "problems.json"
CONTENT_VERSION = 1

# --- chunking ----------------------------------------------------------------

# Simple statements at the top of a body are grouped into one block, up to this many.
MAX_LEADING_RUN = 3
# Neighbouring simple blocks are folded together until a solution has at most this many.
MAX_CHUNKS = 8
# Statements whose header line becomes its own block, with the body indented below it.
COMPOUND_STATEMENTS = (ast.For, ast.While, ast.If, ast.With, ast.Try)

# --- distractors -------------------------------------------------------------

DISTRACTOR_BUDGET = {"Easy": 1, "Medium": 2, "Hard": 3}

# Tried in this order; earlier kinds are preferred when the budget is small.
MUTATION_KINDS = ["off-by-one", "cmp-boundary", "cmp-negate", "op-swap", "var-swap"]
# How many different sites of one kind to try inside a single block.
MAX_SITES_PER_KIND = 6

BOUNDARY_FLIP = {ast.Lt: ast.LtE, ast.LtE: ast.Lt, ast.Gt: ast.GtE, ast.GtE: ast.Gt}
NEGATION = {ast.Eq: ast.NotEq, ast.NotEq: ast.Eq, ast.In: ast.NotIn, ast.NotIn: ast.In}
OPPOSITE_OPERATOR = {ast.Add: ast.Sub, ast.Sub: ast.Add}
OPPOSITE_FUNCTION = {"min": "max", "max": "min"}

# --- running tests -----------------------------------------------------------

# Same budget as the in-browser runner (apps/web/src/constants.ts), so a solution
# that passes here does not time out there.
STEP_LIMIT = 300_000
