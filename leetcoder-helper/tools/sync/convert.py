"""Turn a LeetCode `class Solution` into the single plain function Parsons drills."""
from __future__ import annotations

import ast
import builtins
import copy
import re
from dataclasses import dataclass

from leethub import Skip
from sync_constants import IMPLICIT_IMPORTS, UNSUPPORTED_NAMES, UNSUPPORTED_TYPES

BUILTIN_NAMES = set(dir(builtins))


@dataclass
class Converted:
    source: str
    entry: str
    params: list[str]
    # True for "modify nums in-place" problems; the function then returns its first argument
    in_place: bool


def to_function(solution_file: str) -> Converted:
    tree = ast.parse(solution_file)
    method = _the_one_method(tree)
    _refuse_unsupported(method)

    params = [argument.arg for argument in method.args.args][1:]  # drop self
    function = _as_plain_function(method, params)

    in_place = _is_in_place(method, function)
    if in_place:
        _return_first_argument(function, params)

    imports = _imports_needed(tree, function, params)
    function.body = [ast.parse(line).body[0] for line in imports] + function.body

    ast.fix_missing_locations(function)
    return Converted(ast.unparse(function), method.name, params, in_place)


def _the_one_method(tree: ast.Module) -> ast.FunctionDef:
    classes = [node for node in tree.body if isinstance(node, ast.ClassDef)]
    solution = next((c for c in classes if c.name == "Solution"), None)
    if solution is None:
        raise Skip("design problem (no `class Solution`)")
    if len(classes) > 1:
        raise Skip("defines extra classes")

    methods = [node for node in solution.body if isinstance(node, ast.FunctionDef)]
    if len(methods) != 1:
        raise Skip(f"Solution has {len(methods)} methods; only single-method solutions are supported")
    if methods[0].decorator_list:
        raise Skip("decorated method")
    return methods[0]


def _refuse_unsupported(method: ast.FunctionDef) -> None:
    uses_self = any(
        isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name) and node.value.id == "self"
        for node in ast.walk(method)
    )
    if uses_self:
        raise Skip("uses self.<something>")

    signature = ast.unparse(method.args) + (ast.unparse(method.returns) if method.returns else "")
    for type_name in UNSUPPORTED_TYPES:
        if re.search(rf"\b{type_name}\b", signature):
            raise Skip(f"takes or returns a {type_name}")

    unsupported = _names_in(method) & UNSUPPORTED_NAMES
    if unsupported:
        raise Skip(f"uses {', '.join(sorted(unsupported))}")


def _as_plain_function(method: ast.FunctionDef, params: list[str]) -> ast.FunctionDef:
    function = ast.FunctionDef(
        name=method.name,
        args=ast.arguments(
            posonlyargs=[],
            args=[ast.arg(arg=name) for name in params],
            kwonlyargs=[],
            kw_defaults=[],
            defaults=[],
            vararg=None,
            kwarg=None,
        ),
        body=copy.deepcopy(method.body),
        decorator_list=[],
        returns=None,
        type_comment=None,
    )
    function.type_params = []  # required on Python 3.12+, harmless before
    _strip_annotations(function)
    _drop_docstring(function)
    return function


def _strip_annotations(function: ast.FunctionDef) -> None:
    for node in ast.walk(function):
        if isinstance(node, (ast.FunctionDef, ast.Lambda)):
            for argument in node.args.posonlyargs + node.args.args + node.args.kwonlyargs:
                argument.annotation = None
        if isinstance(node, ast.FunctionDef):
            node.returns = None


def _drop_docstring(function: ast.FunctionDef) -> None:
    first = function.body[0]
    if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant) and isinstance(first.value.value, str):
        function.body = function.body[1:] or [ast.Pass()]


def _is_in_place(method: ast.FunctionDef, function: ast.FunctionDef) -> bool:
    declared_none = isinstance(method.returns, ast.Constant) and method.returns.value is None
    returns_value = any(isinstance(node, ast.Return) and node.value is not None for node in ast.walk(function))
    return declared_none or not returns_value


def _return_first_argument(function: ast.FunctionDef, params: list[str]) -> None:
    if not params:
        raise Skip("returns nothing")
    if any(isinstance(node, ast.Return) for node in ast.walk(function)):
        raise Skip("in-place solution with early returns")
    function.body.append(ast.Return(value=ast.Name(id=params[0], ctx=ast.Load())))


def _imports_needed(tree: ast.Module, function: ast.FunctionDef, params: list[str]) -> list[str]:
    """The file's own imports (minus typing) plus any names LeetCode provides implicitly."""
    needed = [
        ast.unparse(node)
        for node in tree.body
        if isinstance(node, (ast.Import, ast.ImportFrom)) and "typing" not in ast.unparse(node)
    ]
    assigned = {node.id for node in ast.walk(function) if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store)}
    free = _names_in(function) - assigned - set(params) - BUILTIN_NAMES
    needed += [IMPLICIT_IMPORTS[name] for name in sorted(free) if name in IMPLICIT_IMPORTS]
    return list(dict.fromkeys(needed))


def _names_in(node: ast.AST) -> set[str]:
    return {inner.id for inner in ast.walk(node) if isinstance(inner, ast.Name)}
