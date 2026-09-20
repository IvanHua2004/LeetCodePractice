from __future__ import annotations

import ast
import copy

KINDS = ["off-by-one", "cmp-boundary", "cmp-negate", "op-swap", "var-swap"]

BOUNDARY = {ast.Lt: ast.LtE, ast.LtE: ast.Lt, ast.Gt: ast.GtE, ast.GtE: ast.Gt}
NEGATION = {ast.Eq: ast.NotEq, ast.NotEq: ast.Eq, ast.In: ast.NotIn, ast.NotIn: ast.In}
OPPOSITE_OP = {ast.Add: ast.Sub, ast.Sub: ast.Add}
OPPOSITE_FN = {"min": "max", "max": "min"}


class SingleMutation(ast.NodeTransformer):
    def __init__(self, kind: str, which: int):
        self.kind = kind
        self.which = which
        self.passed = 0
        self.applied = False

    def take(self) -> bool:
        if self.applied:
            return False
        if self.passed == self.which:
            self.applied = True
            return True
        self.passed += 1
        return False

    def visit_Compare(self, node: ast.Compare):
        self.generic_visit(node)
        table = BOUNDARY if self.kind == "cmp-boundary" else NEGATION if self.kind == "cmp-negate" else None
        if table:
            for index, operator in enumerate(node.ops):
                if type(operator) in table and self.take():
                    node.ops[index] = table[type(operator)]()
                    break
        return node

    def visit_BinOp(self, node: ast.BinOp):
        if (
            self.kind == "off-by-one"
            and isinstance(node.op, (ast.Add, ast.Sub))
            and isinstance(node.right, ast.Constant)
            and isinstance(node.right.value, int)
            and self.take()
        ):
            return node.left
        self.generic_visit(node)
        if self.kind == "op-swap" and type(node.op) in OPPOSITE_OP and self.take():
            node.op = OPPOSITE_OP[type(node.op)]()
        return node

    def visit_UnaryOp(self, node: ast.UnaryOp):
        if self.kind == "off-by-one":
            return node
        self.generic_visit(node)
        return node

    def visit_Subscript(self, node: ast.Subscript):
        if self.kind == "off-by-one":
            node.value = self.visit(node.value)
            return node
        self.generic_visit(node)
        return node

    def visit_Constant(self, node: ast.Constant):
        if (
            self.kind == "off-by-one"
            and isinstance(node.value, int)
            and not isinstance(node.value, bool)
            and self.take()
        ):
            return ast.Constant(value=node.value + 1)
        return node

    def visit_Call(self, node: ast.Call):
        self.generic_visit(node)
        if (
            self.kind == "op-swap"
            and isinstance(node.func, ast.Name)
            and node.func.id in OPPOSITE_FN
            and self.take()
        ):
            node.func = ast.Name(id=OPPOSITE_FN[node.func.id], ctx=ast.Load())
        return node


class SwapNames(ast.NodeTransformer):
    def __init__(self, first: str, second: str):
        self.first = first
        self.second = second

    def visit_Name(self, node: ast.Name):
        if node.id == self.first:
            node.id = self.second
        elif node.id == self.second:
            node.id = self.first
        return node


def render(nodes: list) -> str:
    return "\n".join(ast.unparse(node) for node in nodes)


def name_pairs(nodes: list) -> list[tuple[str, str]]:
    names: list[str] = []
    for node in nodes:
        for inner in ast.walk(node):
            if isinstance(inner, ast.Name) and inner.id not in names:
                names.append(inner.id)
    return [(names[i], names[j]) for i in range(len(names)) for j in range(i + 1, len(names))]


def variants(nodes: list, kind: str) -> list[str]:
    if kind == "var-swap":
        produced = []
        for first, second in name_pairs(nodes):
            clone = copy.deepcopy(nodes)
            produced.append(render([SwapNames(first, second).visit(node) for node in clone]))
        return produced

    produced = []
    for which in range(6):
        clone = copy.deepcopy(nodes)
        mutation = SingleMutation(kind, which)
        rewritten = [mutation.visit(node) for node in clone]
        if not mutation.applied:
            break
        produced.append(render(rewritten))
    return produced


def is_bare_return(chunk) -> bool:
    if len(chunk.nodes) != 1 or not isinstance(chunk.nodes[0], ast.Return):
        return False
    value = chunk.nodes[0].value
    return (
        value is None
        or isinstance(value, ast.Constant)
        or (isinstance(value, ast.UnaryOp) and isinstance(value.operand, ast.Constant))
    )


def generate(chunks, budget: int, to_display):
    real = {chunk.code for chunk in chunks}
    picked: list[dict] = []

    candidates = [
        (index, chunk)
        for index, chunk in enumerate(chunks)
        if chunk.nodes and not is_bare_return(chunk)
    ]
    candidates.sort(key=lambda pair: -pair[0])

    for kind in KINDS:
        if len(picked) >= budget:
            break
        for index, chunk in candidates:
            if index == 0 and len(chunks) > 2:
                continue
            chosen = None
            for variant in variants(chunk.nodes, kind):
                text = to_display(variant, chunk)
                if not text.strip() or text in real or any(p["code"] == text for p in picked):
                    continue
                chosen = text
                break
            if chosen:
                picked.append({"code": chosen, "kind": kind, "from_chunk": index})
                break

    return picked[:budget]
