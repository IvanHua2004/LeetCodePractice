import { useMemo, useState } from 'react';
import {
  DEFAULT_FILTERS,
  countByTopic,
  everyTopic,
  problemsMatching,
  type Difficulty,
  type Filters,
  type Problem,
} from '@parsons/shared';
import {
  DIFFICULTY_CHOICES,
  LIST_CHOICES,
  MINUTES_PER_PROBLEM,
  ORDER_CHOICES,
  SESSION_LENGTHS,
} from './constants';
import { colors, fonts, label } from './theme';
import { useSubmitShortcut } from './useSubmitShortcut';

type Props = {
  problems: Problem[];
  lastSession: string | null;
  onStart: (filters: Filters) => void;
};

export function Setup({ problems, lastSession, onStart }: Props) {
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    difficulties: [...DEFAULT_FILTERS.difficulties],
    topics: [],
  });

  const topics = useMemo(() => everyTopic(problems), [problems]);
  const counts = useMemo(() => countByTopic(problems, filters), [problems, filters]);
  const pool = useMemo(() => problemsMatching(problems, filters), [problems, filters]);

  const sessionSize = filters.length === 0 ? pool.length : Math.min(filters.length, pool.length);
  const minutes = Math.round(sessionSize * MINUTES_PER_PROBLEM);
  const everythingOn = filters.topics.length === topics.length;

  const start = () => {
    if (pool.length > 0) onStart(filters);
  };
  useSubmitShortcut(start);

  const toggleTopic = (topic: string) =>
    setFilters((current) => ({
      ...current,
      topics: current.topics.includes(topic)
        ? current.topics.filter((t) => t !== topic)
        : [...current.topics, topic],
    }));

  const toggleDifficulty = (difficulty: Difficulty) =>
    setFilters((current) => ({
      ...current,
      difficulties: current.difficulties.includes(difficulty)
        ? current.difficulties.filter((d) => d !== difficulty)
        : [...current.difficulties, difficulty],
    }));

  return (
    <div style={page}>
      <header style={header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...label, fontSize: 10, letterSpacing: '0.24em', color: colors.textDim }}>
            NEW SESSION
          </div>
          <h1 style={title}>What are we drilling?</h1>
        </div>
        {lastSession && (
          <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.16em', color: colors.textDim }}>
            {lastSession}
          </span>
        )}
      </header>

      <div style={body}>
        <div style={leftColumn}>
          <div style={card}>
            <div style={cardHead}>
              <span style={{ ...label, letterSpacing: '0.24em' }}>TOPICS</span>
              <button
                type="button"
                style={ghostText}
                onClick={() =>
                  setFilters((current) => ({ ...current, topics: everythingOn ? [] : [...topics] }))
                }
              >
                {everythingOn ? 'NONE' : 'ALL'}
              </button>
            </div>

            <div style={{ lineHeight: 0 }}>
              {topics.map((topic) => {
                const count = counts.get(topic) ?? 0;
                const on = filters.topics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    style={{ ...chip, ...(count === 0 ? dead : on ? limeOn : off) }}
                  >
                    <span>{topic}</span>
                    <span style={{ fontFamily: fonts.mono, fontSize: 10, color: on && count > 0 ? colors.limeDeep : colors.textFaint }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: '0.2em', color: colors.textFaint, marginTop: 14 }}>
              {filters.topics.length} OF {topics.length} SELECTED
            </div>
          </div>

          <div style={footnote}>
            A problem carries more than one topic, so these do not add up.
            <br />
            Selecting several widens the pool, it does not stack it.
          </div>
        </div>

        <div style={{ width: 1, background: colors.lineSoft }} />

        <div style={rightColumn}>
          <Group name="LIST">
            {LIST_CHOICES.map((choice) => {
              const on = filters.list === choice.key;
              const count = problemsMatching(problems, { ...filters, list: choice.key, topics: [] }).length;
              return (
                <button
                  key={choice.key}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, list: choice.key }))}
                  style={{ ...row, ...(on ? tealOn : off) }}
                >
                  <span>{choice.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {on && <Check />}
                    <span style={{ fontFamily: fonts.mono, fontSize: 10, color: on ? colors.tealDeep : colors.textFaint }}>
                      {count}
                    </span>
                  </span>
                </button>
              );
            })}
          </Group>

          <Group name="DIFFICULTY">
            <div style={{ display: 'flex', gap: 7 }}>
              {DIFFICULTY_CHOICES.map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => toggleDifficulty(difficulty)}
                  style={{ ...pill, ...(filters.difficulties.includes(difficulty) ? tealOn : off) }}
                >
                  {difficulty}
                </button>
              ))}
            </div>
          </Group>

          <Group name="LENGTH">
            <div style={{ display: 'flex', gap: 7 }}>
              {SESSION_LENGTHS.map((length) => (
                <button
                  key={length}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, length }))}
                  style={{ ...pill, ...(filters.length === length ? tealOn : off) }}
                >
                  {length === 0 ? 'ALL' : length}
                </button>
              ))}
            </div>
          </Group>

          <Group name="ORDER">
            <div style={{ display: 'flex', gap: 7 }}>
              {ORDER_CHOICES.map((order) => (
                <button
                  key={order.key}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, order: order.key }))}
                  style={{ ...pill, ...(filters.order === order.key ? tealOn : off) }}
                >
                  {order.name}
                </button>
              ))}
            </div>
            <span style={{ fontFamily: fonts.mono, fontSize: 9.5, lineHeight: 1.8, color: colors.textFaint }}>
              {ORDER_CHOICES.find((order) => order.key === filters.order)?.note}
            </span>
          </Group>

          <div style={summaryCard}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1, color: colors.lime }}>
                {pool.length}
              </span>
              <span style={{ ...label, fontSize: 9.5, letterSpacing: '0.2em', color: colors.textDim }}>
                IN POOL
              </span>
            </div>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>
              {sessionSize} this session · about {minutes} min
            </span>
            <button
              type="button"
              disabled={pool.length === 0}
              onClick={start}
              style={{ ...startButton, opacity: pool.length === 0 ? 0.35 : 1 }}
            >
              Start
              <span style={keycap}>⌘ + ENTER</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
      <span style={{ ...label, fontSize: 9.5, letterSpacing: '0.24em' }}>{name}</span>
      {children}
    </div>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.tealDeep} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6.5" />
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
  padding: '30px 38px 26px',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 28,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  fontWeight: 600,
  letterSpacing: '-0.025em',
  color: colors.textBright,
};

const body: React.CSSProperties = {
  flexGrow: 1,
  display: 'flex',
  minHeight: 0,
  padding: '0 38px',
};

const leftColumn: React.CSSProperties = {
  flexGrow: 1,
  paddingRight: 32,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  overflowY: 'auto',
};

const rightColumn: React.CSSProperties = {
  width: 324,
  flexShrink: 0,
  paddingLeft: 32,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
};

const card: React.CSSProperties = {
  background: '#0F0F12',
  border: '1px solid #1F1F26',
  borderRadius: 12,
  padding: '18px 18px 15px',
};

const cardHead: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
};

const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  borderRadius: 999,
  padding: '10px 15px',
  margin: '0 7px 7px 0',
  cursor: 'pointer',
  fontFamily: fonts.sans,
  fontSize: 12.5,
  fontWeight: 500,
  lineHeight: 1,
};

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  width: '100%',
  textAlign: 'left',
  borderRadius: 8,
  padding: '13px 14px',
  marginBottom: 8,
  cursor: 'pointer',
  fontFamily: fonts.mono,
  fontSize: 12,
};

const pill: React.CSSProperties = {
  flexGrow: 1,
  textAlign: 'center',
  borderRadius: 8,
  padding: '11px 5px',
  cursor: 'pointer',
  fontFamily: fonts.mono,
  fontSize: 11,
};

const limeOn: React.CSSProperties = {
  background: 'rgba(201,247,90,0.07)',
  border: '1px solid rgba(201,247,90,0.5)',
  color: colors.limeSoft,
  boxShadow: '0 0 16px rgba(201,247,90,0.16)',
};

const tealOn: React.CSSProperties = {
  background: 'rgba(94,234,212,0.07)',
  border: '1px solid rgba(94,234,212,0.42)',
  color: colors.tealSoft,
  boxShadow: '0 0 16px rgba(94,234,212,0.13)',
};

const off: React.CSSProperties = {
  background: '#141418',
  border: '1px solid #24242B',
  color: '#9C9CA6',
};

const dead: React.CSSProperties = {
  background: '#0D0D10',
  border: '1px solid #1A1A20',
  color: '#4A4A54',
};

const summaryCard: React.CSSProperties = {
  marginTop: 'auto',
  marginBottom: 30,
  background: '#0F0F12',
  border: '1px solid #1F1F26',
  borderRadius: 12,
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 13,
};

const startButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 11,
  width: '100%',
  fontFamily: fonts.sans,
  fontSize: 14.5,
  fontWeight: 600,
  background: colors.lime,
  color: colors.page,
  border: 'none',
  borderRadius: 999,
  padding: '15px 20px',
  cursor: 'pointer',
  boxShadow: '0 0 52px rgba(201,247,90,0.45)',
};

const keycap: React.CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: 10.5,
  background: 'rgba(10,10,12,0.16)',
  borderRadius: 999,
  padding: '4px 10px',
};

const footnote: React.CSSProperties = {
  marginTop: 'auto',
  paddingBottom: 30,
  fontFamily: fonts.mono,
  fontSize: 10,
  lineHeight: 2,
  color: colors.textFaint,
};

const ghostText: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '4px 0 4px 12px',
  cursor: 'pointer',
  fontFamily: fonts.mono,
  fontSize: 10,
  letterSpacing: '0.2em',
  color: colors.textDim,
};
