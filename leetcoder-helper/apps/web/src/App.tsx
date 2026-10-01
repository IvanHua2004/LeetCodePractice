import { useEffect, useState } from 'react';
import { buildQueue, problemsMatching, type Filters, type Problem } from '@parsons/shared';
import { loadHintsByTopic, loadProblems, recordAttempt, recordHint } from './api';
import { startLoadingPython } from './runner';
import { Setup } from './Setup';
import { Assemble, type Outcome } from './Assemble';
import { colors, fonts, label } from './theme';

type Screen =
  | { name: 'loading' }
  | { name: 'setup' }
  | { name: 'drill'; queue: Problem[]; at: number; solved: number }
  | { name: 'summary'; solved: number; total: number };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [problems, setProblems] = useState<Problem[]>([]);
  const [hintsByTopic, setHintsByTopic] = useState<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      const [loaded, hints] = await Promise.all([loadProblems(), loadHintsByTopic()]);
      setProblems(loaded);
      setHintsByTopic(hints);
      setScreen({ name: 'setup' });
      void startLoadingPython().catch(() => undefined);
    })();
  }, []);

  const start = (filters: Filters) => {
    const queue = buildQueue(problemsMatching(problems, filters), filters, hintsByTopic);
    if (queue.length === 0) return;
    setScreen({ name: 'drill', queue, at: 0, solved: 0 });
  };

  const finish = (outcome: Outcome, current: Problem) => {
    void recordAttempt({
      slug: current.slug,
      passed: outcome.passed,
      ms: outcome.ms,
      checksUsed: outcome.checksUsed,
      usedHint: outcome.usedHint,
      arrangement: outcome.placements,
    });

    setScreen((state) => {
      if (state.name !== 'drill') return state;
      const solved = state.solved + (outcome.passed ? 1 : 0);
      const next = state.at + 1;
      if (next >= state.queue.length) {
        return { name: 'summary', solved, total: state.queue.length };
      }
      return { ...state, at: next, solved };
    });
  };

  if (screen.name === 'loading') {
    return <Centered>loading problems…</Centered>;
  }

  if (screen.name === 'setup') {
    return <Setup problems={problems} lastSession={null} onStart={start} />;
  }

  if (screen.name === 'summary') {
    return (
      <Centered>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 52, fontWeight: 600, color: colors.lime, letterSpacing: '-0.03em' }}>
            {screen.solved} / {screen.total}
          </div>
          <div style={{ ...label, letterSpacing: '0.2em' }}>SOLVED</div>
          <button
            type="button"
            style={{
              marginTop: 10,
              fontFamily: fonts.sans,
              fontSize: 14,
              fontWeight: 600,
              background: colors.lime,
              color: colors.page,
              border: 'none',
              borderRadius: 999,
              padding: '14px 30px',
              cursor: 'pointer',
            }}
            onClick={() => {
              void loadHintsByTopic().then(setHintsByTopic);
              setScreen({ name: 'setup' });
            }}
          >
            New session
          </button>
        </div>
      </Centered>
    );
  }

  const current = screen.queue[screen.at];
  if (!current) return <Centered>nothing queued</Centered>;

  return (
    <Assemble
      key={current.slug}
      problem={current}
      position={screen.at + 1}
      total={screen.queue.length}
      onHintRevealed={() => {
        void recordHint({ slug: current.slug, topics: current.topics });
        setHintsByTopic((counts) => {
          const next = { ...counts };
          for (const topic of current.topics) next[topic] = (next[topic] ?? 0) + 1;
          return next;
        });
      }}
      onFinished={(outcome) => finish(outcome, current)}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.page,
        fontFamily: fonts.mono,
        fontSize: 12,
        letterSpacing: '0.14em',
        color: colors.textDim,
      }}
    >
      {children}
    </div>
  );
}
