import { useEffect, useMemo, useRef, useState } from 'react';
import {
  assembleSource,
  blocksFor,
  clampIndent,
  indentWidthPx,
  maxChecks,
  shuffle,
  type AttemptResult,
  type BlockId,
  type DropTarget,
  type Placement,
  type Problem,
} from '@parsons/shared';
import { colors, fonts, label } from './theme';
import { CodeLines } from './Code';
import { runAgainstTests } from './runner';

type Drag = {
  id: BlockId;
  from: 'pool' | 'solution';
  x: number;
  y: number;
  grabX: number;
  grabY: number;
  width: number;
};

type Props = {
  problem: Problem;
  position: number;
  total: number;
  onFinished: (outcome: { passed: boolean; usedHint: boolean; checksUsed: number; ms: number; placements: Placement[] }) => void;
  onHintRevealed: () => void;
};

export function Assemble({ problem, position, total, onFinished, onHintRevealed }: Props) {
  const blocks = useMemo(() => {
    const map = new Map<BlockId, { code: string; isReal: boolean }>();
    for (const block of blocksFor(problem)) map.set(block.id, block);
    return map;
  }, [problem]);

  const [pool, setPool] = useState<BlockId[]>(() =>
    shuffle(blocksFor(problem).map((block) => block.id), problem.slug),
  );
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [checksLeft, setChecksLeft] = useState(maxChecks);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [flash, setFlash] = useState<'pass' | 'fail' | null>(null);

  const solutionRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<BlockId, HTMLDivElement>());
  const pendingTimer = useRef<number | null>(null);

  const clearPending = () => {
    if (pendingTimer.current !== null) {
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
  };

  useEffect(() => clearPending, []);

  const busy = running || flash !== null;

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setPool(shuffle(blocksFor(problem).map((block) => block.id), problem.slug));
    setPlacements([]);
    setChecksLeft(maxChecks);
    setHintRevealed(false);
    setHintShown(false);
    setResult(null);
    setSeconds(0);
    setFlash(null);
    clearPending();
  }, [problem]);

  const codeFor = (id: BlockId) => blocks.get(id)?.code ?? '';
  const opensBlock = (id: BlockId) => codeFor(id).trimEnd().endsWith(':');

  useEffect(() => {
    if (!drag) return;

    const move = (event: PointerEvent) => {
      const panel = solutionRef.current;
      if (!panel) return;
      const bounds = panel.getBoundingClientRect();

      const visible = placements.filter((p) => !(drag.from === 'solution' && p.id === drag.id));
      let index = visible.length;
      for (let i = 0; i < visible.length; i++) {
        const row = rowRefs.current.get(visible[i]!.id);
        if (!row) continue;
        const box = row.getBoundingClientRect();
        if (event.clientY < box.top + box.height / 2) {
          index = i;
          break;
        }
      }

      if (event.clientX < bounds.left - 24) {
        setTarget(null);
      } else {
        const wanted = Math.round((event.clientX - bounds.left - 8) / indentWidthPx);
        const previous = visible[index - 1];
        const indent = clampIndent(
          wanted,
          previous,
          previous ? opensBlock(previous.id) : false,
          problem.maxIndent,
        );
        setTarget({ index, indent });
      }

      setDrag({ ...drag, x: event.clientX, y: event.clientY });
    };

    const drop = () => {
      const landing = target;
      setDrag(null);
      setTarget(null);

      if (!landing) {
        if (drag.from === 'solution') {
          setPlacements((current) => current.filter((p) => p.id !== drag.id));
          setPool((current) => [...current, drag.id]);
        }
        return;
      }

      setPlacements((current) => {
        const without = current.filter((p) => p.id !== drag.id);
        const next = [...without];
        next.splice(landing.index, 0, { id: drag.id, indent: landing.indent });
        return next;
      });
      if (drag.from === 'pool') setPool((current) => current.filter((id) => id !== drag.id));
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', drop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', drop);
    };
  }, [drag, target, placements, problem.maxIndent]);

  const startDrag = (id: BlockId, from: Drag['from']) => (event: React.PointerEvent) => {
    if (busy) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setDrag({
      id,
      from,
      x: event.clientX,
      y: event.clientY,
      grabX: event.clientX - box.left,
      grabY: event.clientY - box.top,
      width: box.width,
    });
    setResult(null);
  };

  const revealHint = () => {
    if (!hintRevealed) onHintRevealed();
    setHintRevealed(true);
    setHintShown(true);
  };

  const check = async () => {
    if (busy || placements.length === 0) return;
    setRunning(true);
    const source = assembleSource(problem.signature, placements, codeFor);
    const outcome = await runAgainstTests(source, problem.entry, problem.tests);
    setRunning(false);
    setResult(outcome);

    const spent = maxChecks - checksLeft + 1;

    if (outcome.status === 'pass') {
      setFlash('pass');
      pendingTimer.current = window.setTimeout(() => {
        onFinished({
          passed: true,
          usedHint: hintRevealed,
          checksUsed: spent,
          ms: outcome.ms,
          placements,
        });
      }, 1600);
      return;
    }

    setFlash('fail');
    const remaining = checksLeft - 1;
    setChecksLeft(remaining);

    if (remaining <= 0) {
      pendingTimer.current = window.setTimeout(() => {
        onFinished({
          passed: false,
          usedHint: hintRevealed,
          checksUsed: maxChecks,
          ms: seconds * 1000,
          placements,
        });
      }, 1400);
    } else {
      pendingTimer.current = window.setTimeout(() => setFlash(null), 900);
    }
  };

  const reset = () => {
    setPool(shuffle(blocksFor(problem).map((block) => block.id), problem.slug));
    setPlacements([]);
    setResult(null);
  };

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const visible = placements.filter((p) => !(drag?.from === 'solution' && p.id === drag.id));

  return (
    <div style={page}>
      <style>{flashKeyframes}</style>

      <header style={header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...label, letterSpacing: '0.2em', color: colors.textDim }}>
            {String(position).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </div>
          <h1 style={title}>{problem.title}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, paddingBottom: 4 }}>
          <span style={difficultyChip(problem.difficulty)}>{problem.difficulty.toUpperCase()}</span>
          <span style={{ fontFamily: fonts.mono, fontSize: 11.5, color: colors.textDim }}>
            {problem.pattern}
          </span>
        </div>
      </header>

      <p style={statement}>{problem.statement}</p>

      <div style={body}>
        <div style={leftColumn}>
          <div style={poolCard}>
            <div style={cardHead}>
              <span style={label}>POOL</span>
              <span style={{ ...label, fontSize: 10, letterSpacing: '0.16em', color: colors.textDim }}>
                {pool.length} LEFT
              </span>
            </div>
            <div style={poolScroll}>
              {pool.length === 0 && <div style={emptyPool}>empty</div>}
              {pool.map((id) => (
                <div key={id} style={poolBlock} onPointerDown={startDrag(id, 'pool')}>
                  <Grip />
                  <div style={{ fontFamily: fonts.mono, fontSize: 13, lineHeight: 1.75 }}>
                    <CodeLines text={codeFor(id)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flexShrink: 0, paddingTop: 12 }}>
            {!hintRevealed && (
              <button type="button" style={hintClosed} onClick={revealHint}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bulb />
                  <span style={{ ...label, color: colors.lime }}>HINT</span>
                </span>
                <span style={{ ...label, fontSize: 10, letterSpacing: '0.18em', color: colors.textDim }}>
                  REVEAL
                </span>
              </button>
            )}
            {hintRevealed && hintShown && (
              <div style={card}>
                <div style={cardHead}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Bulb />
                    <span style={{ ...label, color: colors.lime }}>HINT</span>
                  </span>
                  <button type="button" style={ghostText} onClick={() => setHintShown(false)}>
                    HIDE
                  </button>
                </div>
                <p style={hintText}>{problem.hint}</p>
              </div>
            )}
            {hintRevealed && !hintShown && (
              <button type="button" style={hintClosed} onClick={() => setHintShown(true)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bulb />
                  <span style={{ ...label, color: colors.lime }}>HINT</span>
                </span>
                <span style={{ ...label, fontSize: 10, letterSpacing: '0.18em', color: colors.textDim }}>
                  SHOW
                </span>
              </button>
            )}
          </div>
        </div>

        <div style={{ width: 1, background: colors.lineSoft }} />

        <div style={rightColumn}>
          <div style={cardHead}>
            <span style={label}>SOLUTION</span>
            <span style={{ ...label, fontSize: 10, letterSpacing: '0.14em', color: colors.textDim }}>
              {placements.length} / {problem.chunks.length} PLACED
            </span>
          </div>

          <div style={signatureLine}>
            <CodeLines text={problem.signature} />
          </div>

          <div ref={solutionRef} style={solutionArea}>
            {visible.length === 0 && !target && <div style={emptySolution}>drag a block here</div>}

            {visible.map((placement, i) => (
              <div key={placement.id}>
                {target?.index === i && <DropSlot indent={target.indent} />}
                <div
                  ref={(node) => {
                    if (node) rowRefs.current.set(placement.id, node);
                    else rowRefs.current.delete(placement.id);
                  }}
                  style={{ ...placedBlock, marginLeft: placement.indent * indentWidthPx }}
                  onPointerDown={startDrag(placement.id, 'solution')}
                >
                  <div style={{ fontFamily: fonts.mono, fontSize: 13, lineHeight: 1.8 }}>
                    <CodeLines text={codeFor(placement.id)} />
                  </div>
                </div>
              </div>
            ))}
            {target?.index === visible.length && <DropSlot indent={target.indent} />}
          </div>

          {result && result.status !== 'pass' && (
            <div style={resultBox}>
              {result.status === 'fail' ? (
                <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>
                  <span style={{ color: colors.textDim }}>{JSON.stringify(result.args).slice(1, -1)}</span>
                  <span style={{ color: colors.textFaint }}> → got </span>
                  <span style={{ color: '#F08A6C' }}>{JSON.stringify(result.got)}</span>
                  <span style={{ color: colors.textFaint }}>, expected </span>
                  <span style={{ color: colors.tealSoft }}>{JSON.stringify(result.expected)}</span>
                </span>
              ) : (
                <span style={{ fontFamily: fonts.mono, fontSize: 12, color: '#F08A6C' }}>
                  {result.message}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <footer style={footer}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 16 }}>{clock}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...label, fontSize: 10, letterSpacing: '0.18em', color: colors.textDim }}>
              CHECKS
            </span>
            <span style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: maxChecks }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: i < checksLeft ? colors.lime : colors.line,
                  }}
                />
              ))}
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" style={ghostButton} onClick={reset}>
            Reset
          </button>
          <button type="button" style={primaryButton} onClick={check} disabled={busy}>
            {running ? 'Running…' : 'Run tests'}
            <span style={keycap}>⌘ + ENTER</span>
          </button>
        </div>
      </footer>

      {drag && (
        <div
          style={{
            position: 'fixed',
            left: drag.x - drag.grabX,
            top: drag.y - drag.grabY,
            width: drag.width,
            pointerEvents: 'none',
            zIndex: 50,
            background: '#1E1E24',
            border: `1px solid ${colors.line}`,
            borderRadius: 8,
            padding: '12px 14px',
            boxShadow: '0 26px 56px rgba(0,0,0,0.7)',
            fontFamily: fonts.mono,
            fontSize: 13,
            lineHeight: 1.75,
          }}
        >
          <CodeLines text={codeFor(drag.id)} />
        </div>
      )}

      {flash && (
        <div style={flash === 'pass' ? passWash : failWash}>
          {flash === 'pass' && (
            <div style={{ textAlign: 'center', animation: 'flashRise 500ms ease-out' }}>
              <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.03em', color: colors.lime }}>
                Solved
              </div>
              <div style={{ ...label, marginTop: 10, letterSpacing: '0.24em', color: colors.limeDeep }}>
                {clock} · {maxChecks - checksLeft + 1} CHECK{checksLeft === maxChecks ? '' : 'S'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const flashKeyframes = `
@keyframes flashPass {
  0% { opacity: 0 }
  10% { opacity: 1 }
  70% { opacity: 1 }
  100% { opacity: 0 }
}
@keyframes flashFail {
  0% { opacity: 0 }
  8% { opacity: 1 }
  55% { opacity: 1 }
  100% { opacity: 0 }
}
@keyframes flashRise {
  0% { opacity: 0; transform: translateY(10px) }
  100% { opacity: 1; transform: translateY(0) }
}
`;

const wash: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const passWash: React.CSSProperties = {
  ...wash,
  animation: 'flashPass 1600ms ease-out forwards',
  background:
    'radial-gradient(ellipse at center, rgba(201,247,90,0.16), rgba(201,247,90,0.04) 55%, transparent 78%)',
  boxShadow: 'inset 0 0 180px rgba(201,247,90,0.38), inset 0 0 0 2px rgba(201,247,90,0.45)',
};

const failWash: React.CSSProperties = {
  ...wash,
  animation: 'flashFail 900ms ease-out forwards',
  background:
    'radial-gradient(ellipse at center, rgba(240,110,90,0.14), rgba(240,110,90,0.04) 55%, transparent 78%)',
  boxShadow: 'inset 0 0 180px rgba(240,110,90,0.34), inset 0 0 0 2px rgba(240,110,90,0.4)',
};

function DropSlot({ indent }: { indent: number }) {
  return (
    <div
      style={{
        marginLeft: indent * indentWidthPx,
        height: 44,
        marginBottom: 9,
        borderRadius: 9,
        border: `1px dashed ${colors.teal}88`,
        background: 'rgba(94,234,212,0.07)',
        boxShadow: '0 0 30px rgba(94,234,212,0.18)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        fontFamily: fonts.mono,
        fontSize: 10.5,
        letterSpacing: '0.16em',
        color: colors.tealSoft,
      }}
    >
      INDENT {indent}
    </div>
  );
}

function Grip() {
  return (
    <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 2.5px)', gap: 3, flexShrink: 0 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} style={{ width: 2.5, height: 2.5, borderRadius: 999, background: '#4A4A54' }} />
      ))}
    </span>
  );
}

function Bulb() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.lime} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2z" />
    </svg>
  );
}

const page: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: colors.page,
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  padding: '28px 36px 14px',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 28,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 27,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  color: colors.textBright,
};

const statement: React.CSSProperties = {
  margin: '0 36px 20px',
  fontSize: 14,
  lineHeight: 1.6,
  color: colors.textMuted,
  maxWidth: 820,
};

const body: React.CSSProperties = {
  flexGrow: 1,
  display: 'flex',
  minHeight: 0,
  padding: '0 36px',
};

const leftColumn: React.CSSProperties = {
  width: 360,
  flexShrink: 0,
  paddingRight: 30,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const poolCard: React.CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.line}`,
  borderRadius: 12,
  padding: 15,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  flexShrink: 1,
};

const poolScroll: React.CSSProperties = {
  overflowY: 'auto',
  minHeight: 0,
  paddingRight: 4,
};

const rightColumn: React.CSSProperties = {
  flexGrow: 1,
  paddingLeft: 30,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
  overflowY: 'auto',
};

const card: React.CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.line}`,
  borderRadius: 12,
  padding: 15,
};

const cardHead: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 13,
};

const poolBlock: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: colors.surfaceRaised,
  border: `1px solid #26262E`,
  borderRadius: 8,
  padding: '12px 13px',
  marginBottom: 9,
  cursor: 'grab',
  touchAction: 'none',
  userSelect: 'none',
};

const placedBlock: React.CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.line}`,
  borderRadius: 9,
  padding: '13px 16px',
  marginBottom: 9,
  cursor: 'grab',
  touchAction: 'none',
  userSelect: 'none',
};

const signatureLine: React.CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: 13,
  color: colors.textDim,
  paddingBottom: 2,
};

const solutionArea: React.CSSProperties = {
  flexGrow: 1,
  minHeight: 120,
  paddingTop: 2,
};

const emptySolution: React.CSSProperties = {
  height: 60,
  borderRadius: 9,
  border: `1px dashed ${colors.line}`,
  display: 'flex',
  alignItems: 'center',
  padding: '0 16px',
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: '0.14em',
  color: colors.textFaint,
};

const emptyPool: React.CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: 11,
  color: colors.textFaint,
  padding: '10px 0',
};

const resultBox: React.CSSProperties = {
  border: `1px solid ${colors.line}`,
  background: colors.surface,
  borderRadius: 9,
  padding: '12px 14px',
  marginBottom: 8,
};

const footer: React.CSSProperties = {
  margin: '14px 36px 0',
  borderTop: `1px solid ${colors.lineSoft}`,
  padding: '18px 0 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const ghostButton: React.CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 13.5,
  fontWeight: 500,
  background: 'transparent',
  border: `1px solid #26262E`,
  borderRadius: 999,
  padding: '13px 26px',
  cursor: 'pointer',
};

const primaryButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  fontFamily: fonts.sans,
  fontSize: 14,
  fontWeight: 600,
  background: colors.lime,
  color: colors.page,
  border: 'none',
  borderRadius: 999,
  padding: '13px 15px 13px 26px',
  cursor: 'pointer',
  boxShadow: '0 0 44px rgba(201,247,90,0.38)',
};

const keycap: React.CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: 10.5,
  background: 'rgba(10,10,12,0.16)',
  borderRadius: 999,
  padding: '4px 10px',
};

const hintClosed: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  background: colors.surface,
  border: `1px solid ${colors.line}`,
  borderRadius: 12,
  padding: '16px 17px',
  cursor: 'pointer',
};

const hintText: React.CSSProperties = {
  margin: 0,
  fontSize: 15.5,
  lineHeight: 1.5,
  color: '#EAEAEE',
};

const ghostText: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 4,
  cursor: 'pointer',
  fontFamily: fonts.mono,
  fontSize: 10,
  letterSpacing: '0.18em',
  color: colors.textDim,
};

function difficultyChip(difficulty: string): React.CSSProperties {
  const tone =
    difficulty === 'Easy' ? colors.tealDeep : difficulty === 'Hard' ? '#F08A6C' : colors.amber;
  return {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: '0.14em',
    padding: '5px 11px',
    borderRadius: 5,
    background: `${tone}22`,
    color: tone,
  };
}
