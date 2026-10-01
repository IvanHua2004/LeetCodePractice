"""Reading what LeetHub puts next to each solution: the problem README.

Also looks up topic tags from LeetCode, since LeetHub doesn't record them.
"""
from __future__ import annotations

import ast
import html
import json
import re
import urllib.request
from dataclasses import dataclass

from sync_constants import HTTP_TIMEOUT_SECONDS, LEETCODE_GRAPHQL_URL, LEETCODE_TOPICS_QUERY


class Skip(Exception):
    """This problem can't be synced; the message says why."""


@dataclass
class Readme:
    title: str
    difficulty: str
    statement: str
    examples: list[tuple[str, str]]  # raw (input, output) text


# --- README ----------------------------------------------------------------------

def parse_readme(text: str) -> Readme:
    title = re.search(r"<h2>.*?>\s*\d+\.\s*(.*?)</a>", text, re.S)
    difficulty = re.search(r"<h3>(Easy|Medium|Hard)</h3>", text)
    if not title or not difficulty:
        raise Skip("README has no title/difficulty header")

    body = text.split("<hr>", 1)[-1]
    return Readme(
        title=html.unescape(title[1]).strip(),
        difficulty=difficulty[1],
        statement=_statement(body),
        examples=_examples(body),
    )


def _strip_html(fragment: str) -> str:
    fragment = re.sub(r"<sup>(.*?)</sup>", r"^\1", fragment, flags=re.S)
    fragment = re.sub(r"<(br|/p|/li|/pre|/div)\s*/?>", "\n", fragment, flags=re.I)
    fragment = re.sub(r"<li[^>]*>", "\n- ", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return html.unescape(fragment).replace("\xa0", " ")


def _statement(body: str) -> str:
    """Everything before "Example 1", as one paragraph."""
    first_example = re.search(r"<strong[^>]*>\s*Example\s*1", body)
    intro = body[: first_example.start()] if first_example else body
    lines = (re.sub(r"[ \t]+", " ", line).strip() for line in _strip_html(intro).split("\n"))
    return " ".join(line for line in lines if line)


def _examples(body: str) -> list[tuple[str, str]]:
    text = _strip_html(body).split("Constraints:", 1)[0]
    examples = []
    for block in re.split(r"Example\s*\d+\s*:", text)[1:]:
        found = re.search(r"Input:\s*(.*?)\s*Output:\s*(.*?)\s*(?:Explanation:|$)", block, re.S)
        if found:
            examples.append((" ".join(found[1].split()), " ".join(found[2].split())))
    return examples


# --- example values -----------------------------------------------------------------

def parse_value(raw: str):
    """Read a LeetCode example value (JSON-ish, sometimes Python-ish) as plain JSON data."""
    raw = raw.strip()
    try:
        return json.loads(raw)
    except ValueError:
        pass
    pythonish = re.sub(r"\bnull\b", "None", raw)
    pythonish = re.sub(r"\btrue\b", "True", pythonish)
    pythonish = re.sub(r"\bfalse\b", "False", pythonish)
    try:
        return json.loads(json.dumps(ast.literal_eval(pythonish)))
    except Exception:
        raise Skip(f"can't read value {raw!r}") from None


def parse_inputs(raw: str) -> list[tuple[str, object]]:
    """`nums = [1,2], target = 3` -> [("nums", [1, 2]), ("target", 3)]"""
    assignments: list[str] = []
    for piece in _split_top_level_commas(raw):
        starts_new = re.match(r"\s*[A-Za-z_]\w*\s*=", piece)
        if starts_new or not assignments:
            assignments.append(piece)
        else:
            assignments[-1] += "," + piece

    pairs = []
    for assignment in assignments:
        name, equals, value = assignment.partition("=")
        if not equals:
            raise Skip(f"can't read input {raw!r}")
        pairs.append((name.strip(), parse_value(value)))
    return pairs


def _split_top_level_commas(text: str) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    depth = 0
    quote = None
    for i, ch in enumerate(text):
        if quote:
            current.append(ch)
            if ch == quote and text[i - 1] != "\\":
                quote = None
            continue
        if ch in "\"'":
            quote = ch
        elif ch in "[({":
            depth += 1
        elif ch in "])}":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append("".join(current))
            current = []
            continue
        current.append(ch)
    parts.append("".join(current))
    return parts


# --- topics ----------------------------------------------------------------------------

_leetcode_unreachable = False


def leetcode_topics(slug: str, cache: dict) -> list[str] | None:
    """Topic tags for a problem, or None if LeetCode can't be reached (retried next pass)."""
    global _leetcode_unreachable
    if slug in cache:
        return cache[slug]
    if _leetcode_unreachable:
        return None  # one failure per pass is enough; don't wait on 50 timeouts

    request = urllib.request.Request(
        LEETCODE_GRAPHQL_URL,
        data=json.dumps({"query": LEETCODE_TOPICS_QUERY, "variables": {"s": slug}}).encode(),
        headers={
            "content-type": "application/json",
            "referer": f"https://leetcode.com/problems/{slug}/",
            "user-agent": "Mozilla/5.0 parsons-sync",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read())
        tags = [tag["name"] for tag in body["data"]["question"]["topicTags"]]
    except Exception:
        _leetcode_unreachable = True
        return None

    cache[slug] = tags
    return tags
