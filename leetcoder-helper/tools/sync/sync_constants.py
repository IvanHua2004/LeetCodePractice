"""Settings for syncing your GitHub solutions into Parsons problems."""
from __future__ import annotations

import os
import pathlib

from constants import CONTENT_DIR, ROOT

# --- where things live ---------------------------------------------------------

DEFAULT_REPO = "https://github.com/IvanHua2004/leetcode-solutions"
REPO_ENV_VAR = "PARSONS_SOLUTIONS_REPO"

CACHE_DIR = pathlib.Path(os.environ.get("PARSONS_SYNC_CACHE", ROOT / ".cache" / "sync"))
REPO_DIR = CACHE_DIR / "repo"
STATE_FILE = CACHE_DIR / "state.json"
TOPICS_CACHE_FILE = CACHE_DIR / "leetcode-meta.json"

SYNCED_FILE = CONTENT_DIR / "synced.json"
OVERRIDES_FILE = CONTENT_DIR / "synced-overrides.json"

# Bump when this tool's output changes, so the next pass rebuilds even if the repo didn't.
SYNC_VERSION = 2

# --- what becomes a problem ----------------------------------------------------

SLUG_PREFIX = "mine-"  # keeps your versions apart from curated problems with the same name
LIST_KEY = "mine"
FALLBACK_TOPIC = "Uncategorized"

PROBLEM_FOLDER_PATTERN = r"^\d+-"  # LeetHub folders look like 0088-merge-sorted-array
MIN_CHUNKS = 3  # shorter than this isn't worth reassembling
MAX_CHUNKS = 16  # longer than this is a slog to drag around

# Swapping two names in code nobody hand-picked mostly yields giveaways like
# `result(int)` or `k[dp]`, so synced problems only use the operator mutations.
EXCLUDED_MUTATIONS = {"var-swap"}

# Solutions that use these can't run from plain JSON arguments.
UNSUPPORTED_TYPES = ("TreeNode", "ListNode", "Node")
UNSUPPORTED_NAMES = {"SortedList", "SortedDict", "SortedSet", *UNSUPPORTED_TYPES}

# --- LeetCode -------------------------------------------------------------------

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"
LEETCODE_TOPICS_QUERY = "query q($s: String!) { question(titleSlug: $s) { topicTags { name } } }"
HTTP_TIMEOUT_SECONDS = 10
DOWNLOAD_TIMEOUT_SECONDS = 60

# Names LeetCode puts in scope without an import. A solution that uses one gets
# the import added as its first statement so it runs anywhere.
IMPLICIT_IMPORTS = {
    "collections": "import collections",
    "Counter": "from collections import Counter",
    "defaultdict": "from collections import defaultdict",
    "deque": "from collections import deque",
    "OrderedDict": "from collections import OrderedDict",
    "heapq": "import heapq",
    "heappush": "from heapq import heappush",
    "heappop": "from heapq import heappop",
    "heapify": "from heapq import heapify",
    "heappushpop": "from heapq import heappushpop",
    "nlargest": "from heapq import nlargest",
    "nsmallest": "from heapq import nsmallest",
    "math": "import math",
    "inf": "from math import inf",
    "gcd": "from math import gcd",
    "lcm": "from math import lcm",
    "comb": "from math import comb",
    "perm": "from math import perm",
    "factorial": "from math import factorial",
    "sqrt": "from math import sqrt",
    "isqrt": "from math import isqrt",
    "floor": "from math import floor",
    "ceil": "from math import ceil",
    "log2": "from math import log2",
    "bisect": "import bisect",
    "bisect_left": "from bisect import bisect_left",
    "bisect_right": "from bisect import bisect_right",
    "insort": "from bisect import insort",
    "itertools": "import itertools",
    "accumulate": "from itertools import accumulate",
    "permutations": "from itertools import permutations",
    "combinations": "from itertools import combinations",
    "product": "from itertools import product",
    "pairwise": "from itertools import pairwise",
    "chain": "from itertools import chain",
    "groupby": "from itertools import groupby",
    "zip_longest": "from itertools import zip_longest",
    "functools": "import functools",
    "cache": "from functools import cache",
    "lru_cache": "from functools import lru_cache",
    "reduce": "from functools import reduce",
    "cmp_to_key": "from functools import cmp_to_key",
    "string": "import string",
    "ascii_lowercase": "from string import ascii_lowercase",
    "re": "import re",
    "random": "import random",
    "operator": "import operator",
}
