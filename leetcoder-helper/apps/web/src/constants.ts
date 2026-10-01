import type { Difficulty, Filters, SessionOrder } from '@parsons/shared';

// --- API ---------------------------------------------------------------------

// VITE_API_URL="" (the static GitHub Pages build) means there is no API at all.
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
export const HAS_API = API_URL !== '';
export const API_TIMEOUT_MS = 2500;

// Problems built from your GitHub solutions, served next to the app by the
// Vite plugin in vite.config.ts.
export const SYNCED_CONTENT_URL = `${import.meta.env.BASE_URL}synced.json`;

// --- Python in the browser ---------------------------------------------------

export const PYODIDE_VERSION = '0.26.4';
export const PYODIDE_BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
export const PYODIDE_SCRIPT_URL = `${PYODIDE_BASE_URL}pyodide.js`;

// Interpreter steps before a run is treated as an infinite loop. Matches
// STEP_LIMIT in tools/pipeline/constants.py.
export const PYTHON_STEP_LIMIT = 300_000;

// --- Drill timing ------------------------------------------------------------

export const PASS_FLASH_MS = 1600; // "Solved" overlay before moving on
export const OUT_OF_CHECKS_MS = 1400; // red flash before a failed problem moves on
export const FAIL_FLASH_MS = 900; // red flash when checks remain
export const MINUTES_PER_PROBLEM = 2.5; // for the session estimate on the setup screen

// --- Drag and drop -----------------------------------------------------------

// Dropping this far left of the solution panel sends a block back to the pool.
export const RETURN_TO_POOL_MARGIN_PX = 24;
// Left padding inside the solution panel before indent level 0 starts.
export const SOLUTION_GUTTER_PX = 8;

// --- Setup screen ------------------------------------------------------------

export const DIFFICULTY_CHOICES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export const SESSION_LENGTHS = [5, 10, 20, 0]; // 0 means every problem in the pool

export const ORDER_CHOICES: { key: SessionOrder; name: string; note: string }[] = [
  { key: 'weakest', name: 'Weakest', note: 'Topics where you have spent the most hints come first.' },
  { key: 'random', name: 'Random', note: 'Shuffled across everything selected.' },
  { key: 'inorder', name: 'In order', note: 'List order, easiest first.' },
];

export const LIST_CHOICES: { key: Filters['list']; name: string }[] = [
  { key: 'blind75', name: 'Blind 75' },
  { key: 'neetcode150', name: 'NeetCode 150' },
  { key: 'mine', name: 'My solutions' },
  { key: 'all', name: 'Everything' },
];

// --- Syntax highlighting -----------------------------------------------------

export const PYTHON_KEYWORDS = new Set([
  'and', 'as', 'break', 'continue', 'def', 'elif', 'else', 'except', 'False', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not',
  'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield',
]);

export const PYTHON_BUILTINS = new Set([
  'abs', 'all', 'any', 'bool', 'dict', 'enumerate', 'filter', 'float', 'int', 'len',
  'list', 'map', 'max', 'min', 'print', 'range', 'reversed', 'set', 'sorted', 'str',
  'sum', 'tuple', 'zip',
]);
