import { PYTHON_BUILTINS, PYTHON_KEYWORDS } from './constants';
import { syntax } from './theme';

// One alternative per token kind; the index of the group that matched is the kind.
const TOKEN = {
  whitespace: 1,
  string: 2,
  number: 3,
  word: 4,
  operator: 5,
} as const;

const tokenPattern =
  /(\s+)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([^\sA-Za-z_0-9])/g;

function colorOf(text: string, kind: number, next: string): string {
  switch (kind) {
    case TOKEN.string:
      return syntax.string;
    case TOKEN.number:
      return syntax.number;
    case TOKEN.operator:
      return syntax.operator;
    case TOKEN.word:
      if (PYTHON_KEYWORDS.has(text)) return syntax.keyword;
      if (PYTHON_BUILTINS.has(text) || next === '(') return syntax.builtin;
      return syntax.plain;
    default:
      return syntax.plain;
  }
}

export function Code({ text }: { text: string }) {
  const parts: { text: string; color: string }[] = [];
  const matches = [...text.matchAll(tokenPattern)];

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
