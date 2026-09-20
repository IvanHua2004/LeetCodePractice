from __future__ import annotations

import ast
from dataclasses import dataclass, field

MAX_LEADING_RUN = 3
MAX_CHUNKS = 8

COMPOUND = (ast.For, ast.While, ast.If, ast.With, ast.Try)


@dataclass
class Chunk:
    depth: int
    code: str
    nodes: list = field(default_factory=list)
    header: bool = False


def header_line(node: ast.AST) -> str:
    clone = ast.parse(ast.unparse(node)).body[0]
    clone.body = [ast.Pass()]
    for attribute in ("orelse", "handlers", "finalbody"):
        if hasattr(clone, attribute):
            setattr(clone, attribute, [])
    return ast.unparse(clone).splitlines()[0].rstrip()


def chunk_block(statements: list, depth: int, collected: list[Chunk]) -> None:
    position = 0
    at_start_of_block = True

    while position < len(statements):
        statement = statements[position]

        if isinstance(statement, COMPOUND):
            collected.append(Chunk(depth, header_line(statement), [statement], header=True))
            chunk_block(statement.body, depth + 1, collected)

            alternative = getattr(statement, "orelse", [])
            if alternative:
                if len(alternative) == 1 and isinstance(alternative[0], ast.If):
                    chunk_block(alternative, depth, collected)
                else:
                    collected.append(Chunk(depth, "else:", [], header=True))
                    chunk_block(alternative, depth + 1, collected)

            at_start_of_block = False
            position += 1
            continue

        if at_start_of_block:
            run = []
            while (
                position < len(statements)
                and not isinstance(statements[position], COMPOUND)
                and len(run) < MAX_LEADING_RUN
            ):
                run.append(statements[position])
                position += 1
            collected.append(Chunk(depth, "\n".join(ast.unparse(s) for s in run), list(run)))
            at_start_of_block = False
        else:
            collected.append(Chunk(depth, ast.unparse(statement), [statement]))
            position += 1


def fold_until_small_enough(chunks: list[Chunk]) -> list[Chunk]:
    while len(chunks) > MAX_CHUNKS:
        foldable = -1
        for i in range(len(chunks) - 1):
            first, second = chunks[i], chunks[i + 1]
            if first.header or second.header or first.depth != second.depth:
                continue
            if len(first.code.splitlines()) + len(second.code.splitlines()) > MAX_LEADING_RUN:
                continue
            foldable = i
            break
        if foldable < 0:
            break
        first, second = chunks[foldable], chunks[foldable + 1]
        folded = Chunk(first.depth, first.code + "\n" + second.code, first.nodes + second.nodes)
        chunks = chunks[:foldable] + [folded] + chunks[foldable + 2:]
    return chunks


def chunk_solution(source: str) -> tuple[ast.FunctionDef, list[Chunk]]:
    function = ast.parse(source.strip()).body[0]
    if not isinstance(function, ast.FunctionDef):
        raise ValueError("a solution must be a single function")
    collected: list[Chunk] = []
    chunk_block(function.body, 0, collected)
    return function, fold_until_small_enough(collected)


def signature(function: ast.FunctionDef) -> str:
    parameters = ", ".join(argument.arg for argument in function.args.args)
    return f"def {function.name}({parameters}):"


def assemble(signature_line: str, placements: list[tuple[str, int]]) -> str:
    lines = [signature_line]
    for code, depth in placements:
        padding = "    " * (depth + 1)
        for line in code.splitlines():
            lines.append(padding + line)
    return "\n".join(lines)
