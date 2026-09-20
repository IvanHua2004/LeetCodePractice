import { syntax } from './theme';

const keywords = new Set([
  'and', 'as', 'break', 'continue', 'def', 'elif', 'else', 'except', 'False', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'not', 'or',
  'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield',
]);

const builtins = new Set([
  'abs', 'all', 'any', 'bool', 'dict', 'enumerate', 'filter', 'float', 'int', 'len',
  'list', 'map', 'max', 'min', 'print', 'range', 'reversed', 'set', 'sorted', 'str',
  'sum', 'tuple', 'zip',
]);

const pattern =
  /(\s+)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([^\sA-Za-z_0-9])/g;

function colorOf(text: string, kind: number, next: string): string {
  if (kind === 2) return syntax.string;
  if (kind === 3) return syntax.number;
  if (kind === 4) {
    if (keywords.has(text)) return syntax.keyword;
    if (builtins.has(text) || next === '(') return syntax.builtin;
    return syntax.plain;
  }
  if (kind === 5) return syntax.operator;
  return syntax.plain;
}

export function Code({ text }: { text: string }) {
  const parts: { text: string; color: string }[] = [];
  const matches = [...text.matchAll(pattern)];

  matches.forEach((match, i) => {
    const kind = match.findIndex((group, index) => index > 0 && group !== undefined);
    const nextMatch = matches[i + 1];
    const next = nextMatch?.[0]?.trim() ?? '';
    parts.push({ text: match[0], color: colorOf(match[0], kind, next) });
  });

  return (
    <>
      {parts.map((part, i) =>
        part.color === syntax.plain ? (
          <span key={i}>{part.text}</span>
        ) : (
          <span key={i} style={{ color: part.color }}>
            {part.text}
          </span>
        ),
      )}
    </>
  );
}

export function CodeLines({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <div key={i}>
          <Code text={line} />
        </div>
      ))}
    </>
  );
}
