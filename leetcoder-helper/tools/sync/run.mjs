// Runs tools/sync/sync.py with whichever Python is installed.
//
//   node tools/sync/run.mjs [sync.py args]       one pass
//   node tools/sync/run.mjs --watch [minutes]    one pass now, then every N minutes (default 30)
//
// The web dev server imports startSyncLoop, so `pnpm dev` keeps you synced too.
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const script = resolve(here, 'sync.py');

const DEFAULT_INTERVAL_MINUTES = 30;
const MS_PER_MINUTE = 60_000;
// Tried in order until one exists. On Windows `py` is the launcher python.org installs.
const PYTHON_COMMANDS =
  process.platform === 'win32' ? [['py', '-3'], ['python'], ['python3']] : [['python3'], ['python']];

function pythons() {
  return process.env.PARSONS_PYTHON ? [[process.env.PARSONS_PYTHON]] : PYTHON_COMMANDS;
}

function runWith([command, ...prefix], args) {
  return new Promise((done) => {
    const child = spawn(command, [...prefix, script, ...args], { cwd: root, stdio: 'inherit' });
    child.on('error', () => done(null)); // not installed under this name
    child.on('exit', (code) => done(code ?? 1));
  });
}

let inFlight = null;

export function syncOnce(args = []) {
  // never run two passes at once; a timer tick during a slow pass just joins it
  inFlight ??= (async () => {
    for (const candidate of pythons()) {
      const code = await runWith(candidate, args);
      if (code !== null) return code;
    }
    console.error('[sync] no Python found. Set PARSONS_PYTHON to your python executable.');
    return 1;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function startSyncLoop(minutes = Number(process.env.PARSONS_SYNC_MINUTES ?? DEFAULT_INTERVAL_MINUTES), args = []) {
  const every = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_INTERVAL_MINUTES;
  console.log(`[sync] checking GitHub for new solutions now and every ${every} min`);
  void syncOnce(args);
  const timer = setInterval(() => void syncOnce(args), every * MS_PER_MINUTE);
  return () => clearInterval(timer);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter((arg) => arg !== '--'); // `pnpm sync -- -v`
  const at = args.indexOf('--watch');
  if (at >= 0) {
    const value = Number(args[at + 1]);
    const minutes = Number.isFinite(value) && value > 0 ? value : undefined;
    args.splice(at, minutes === undefined ? 1 : 2);
    startSyncLoop(minutes, args);
  } else {
    process.exitCode = await syncOnce(args);
  }
}
