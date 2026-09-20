import type { AttemptResult, TestCase } from '@parsons/shared';

const pyodideVersion = '0.26.4';
const pyodideUrl = `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/pyodide.js`;
const stepLimit = 300000;

type Pyodide = {
  runPython: (code: string) => unknown;
  globals: { get: (name: string) => ((arg: string) => string) | undefined };
};

declare global {
  interface Window {
    loadPyodide?: (options: { indexURL: string }) => Promise<Pyodide>;
  }
}

let loading: Promise<Pyodide> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = src;
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.append(tag);
  });
}

export function startLoadingPython(): Promise<Pyodide> {
  if (!loading) {
    loading = (async () => {
      if (!window.loadPyodide) await loadScript(pyodideUrl);
      if (!window.loadPyodide) throw new Error('Pyodide did not register itself');
      return window.loadPyodide({
        indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
      });
    })();
  }
  return loading;
}

const driver = `
import json, sys

def __install_guard(limit):
    state = {'steps': 0}
    def guard(frame, event, arg):
        state['steps'] += 1
        if state['steps'] > limit:
            raise RuntimeError('this ran for a very long time, which usually means a loop never ends')
        return guard
    sys.settrace(guard)

def __run(payload):
    request = json.loads(payload)
    fn = globals().get(request['entry'])
    if fn is None:
        return json.dumps({'status': 'error', 'message': 'no function of that name was defined'})
    __install_guard(${stepLimit})
    try:
        for case in request['tests']:
            got = fn(*case['args'])
            if got != case['expected']:
                return json.dumps({
                    'status': 'fail',
                    'args': case['args'],
                    'got': got,
                    'expected': case['expected'],
                })
    except Exception as err:
        return json.dumps({'status': 'error', 'message': type(err).__name__ + ': ' + str(err)})
    finally:
        sys.settrace(None)
    return json.dumps({'status': 'pass'})
`;

export async function runAgainstTests(
  source: string,
  entry: string,
  tests: TestCase[],
): Promise<AttemptResult> {
  const startedAt = performance.now();
  let python: Pyodide;
  try {
    python = await startLoadingPython();
  } catch {
    return { status: 'error', message: 'Python could not load — check your connection and refresh' };
  }

  try {
    python.runPython(source);
  } catch (err) {
    return { status: 'error', message: firstLineOf(err) };
  }

  try {
    python.runPython(driver);
    const run = python.globals.get('__run');
    if (!run) return { status: 'error', message: 'the runner failed to start' };

    const raw = run(JSON.stringify({ entry, tests }));
    const parsed = JSON.parse(raw) as
      | { status: 'pass' }
      | { status: 'fail'; args: unknown[]; got: unknown; expected: unknown }
      | { status: 'error'; message: string };

    if (parsed.status === 'pass') {
      return { status: 'pass', ms: Math.round(performance.now() - startedAt) };
    }
    return parsed;
  } catch (err) {
    return { status: 'error', message: firstLineOf(err) };
  }
}

function firstLineOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  const lines = text.trim().split('\n').filter(Boolean);
  return lines[lines.length - 1] ?? 'something went wrong';
}
